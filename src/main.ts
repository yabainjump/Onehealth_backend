import { NestFactory } from '@nestjs/core';
import { NextFunction, Request, Response } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { extname, join } from 'path';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger';

const DEFAULT_DEV_CORS_ORIGINS = [
  'http://localhost:8100',
  'http://127.0.0.1:8100',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
];

function parseAllowedCorsOrigins(rawValue: string | undefined, nodeEnv: string): string[] {
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
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    maxAge: '30d',
    etag: true,
    lastModified: true,
    immutable: true,
    setHeaders: (res, path) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const extension = extname(path).toLowerCase();
      if (['.html', '.js', '.mjs', '.cjs', '.svg'].includes(extension)) {
        res.setHeader('Content-Disposition', 'attachment');
      }
    },
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), fullscreen=(self)',
    );

    if (nodeEnv === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    }

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

  setupSwagger(app, configService);

  await app.listen(configService.get<number>('PORT') ?? 3000);
}

void bootstrap();

