import { NestFactory } from '@nestjs/core';
import { NextFunction, Request, Response } from 'express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { ServerResponse } from 'http';
import { extname, join } from 'path';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger';
import { ensureUploadsRootReady } from './config/uploads-path';
import { RuntimeLifecycleService } from './runtime/runtime-lifecycle.service';
import { RuntimeReadinessService } from './runtime/runtime-readiness.service';
import { MediaSignatureService } from './media-access/media-signature.service';

const DEFAULT_DEV_CORS_ORIGINS = [
  'http://localhost:8100',
  'http://127.0.0.1:8100',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
];

function parseAllowedCorsOrigins(
  rawValue: string | undefined,
  nodeEnv: string,
): string[] {
  const fromEnv = (rawValue || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (fromEnv.length > 0) {
    return fromEnv;
  }

  if (nodeEnv === 'development') {
    return DEFAULT_DEV_CORS_ORIGINS;
  }

  return [];
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const lifecycle = app.get(RuntimeLifecycleService);
  const readiness = app.get(RuntimeReadinessService);
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  app.disable('x-powered-by');
  app.set('trust proxy', configService.get<number>('trustedProxyHops') ?? 1);
  app.setGlobalPrefix('api');

  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  const allowedCorsOrigins = parseAllowedCorsOrigins(corsOrigin, nodeEnv);

  if (nodeEnv === 'production' && allowedCorsOrigins.length === 0) {
    throw new Error(
      'CORS_ORIGIN must be configured in production to prevent permissive cross-origin access.',
    );
  }

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
  });

  const uploadsRoot = ensureUploadsRootReady();

  // Les pieces jointes de conversations privees ne doivent pas etre lisibles
  // par simple connaissance de l'URL : elles exigent une signature a duree
  // limitee, emise cote serveur pour un membre de la conversation. Ce
  // middleware doit rester AVANT `useStaticAssets`, qui sert sans controle.
  const mediaSignature = app.get(MediaSignatureService);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const pathname = decodeURIComponent((req.path || '').toLowerCase());
    if (!MediaSignatureService.isProtectedPath(pathname)) {
      next();
      return;
    }

    const query = req.query as Record<string, unknown>;
    const expiresAt = typeof query.exp === 'string' ? query.exp : undefined;
    const signature = typeof query.sig === 'string' ? query.sig : undefined;

    if (!mediaSignature.verify(pathname, expiresAt, signature)) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(403).json({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Lien de media expire ou invalide.',
      });
      return;
    }

    next();
  });

  app.useStaticAssets(uploadsRoot, {
    prefix: '/uploads/',
    maxAge: '30d',
    etag: true,
    lastModified: true,
    immutable: true,
    setHeaders: (res: ServerResponse, path: string) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const extension = extname(path).toLowerCase();
      if (['.html', '.js', '.mjs', '.cjs', '.svg'].includes(extension)) {
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  });

  // Fichiers statiques applicatifs (servis en ligne) : image de partage par
  // defaut, etc. Heberges sur le backend pour etre toujours joignables par les
  // robots sociaux (meme domaine que /api/share).
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/public/',
    maxAge: '30d',
    etag: true,
    lastModified: true,
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), fullscreen=(self)',
    );

    // API dynamique : ne JAMAIS laisser un proxy/CDN (LiteSpeed) la mettre en
    // cache (sinon fil/likes/medias servis perimes). Les endpoints qui veulent
    // du cache (media images, share) reecrivent ce header ensuite.
    res.setHeader('Cache-Control', 'no-store');

    if (nodeEnv === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }

    next();
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!lifecycle.canAccept(req.originalUrl)) {
      res.setHeader(
        'Retry-After',
        `${configService.get<number>('readinessRetryAfterSeconds') ?? 5}`,
      );
      res.status(503).json({
        statusCode: 503,
        error: 'Service Unavailable',
        message: "L'instance ne peut pas accepter de nouvelle requête.",
      });
      return;
    }

    if (lifecycle.isHealthRequest(req.originalUrl)) {
      next();
      return;
    }

    const finish = lifecycle.trackRequest();
    res.once('finish', finish);
    res.once('close', finish);
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  setupSwagger(app, configService);

  app.enableShutdownHooks();
  await app.listen(configService.get<number>('PORT') ?? 3000);

  if (!(await readiness.initialize())) {
    await app.close();
    throw new Error(
      'The application started but an essential dependency is not ready.',
    );
  }

  if (typeof process.send === 'function') {
    process.send('ready');
  }
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  Logger.error(message, undefined, 'Bootstrap');
  process.exitCode = 1;
});
