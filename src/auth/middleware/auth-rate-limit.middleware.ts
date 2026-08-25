import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { CoordinationUnavailableError } from '../../coordination/coordination.errors';
import { DistributedRateLimitService } from '../../coordination/distributed-rate-limit.service';
import { RateLimitPolicy } from '../../coordination/schemas/rate-limit-bucket.schema';

const WINDOW_MS = 15 * 60 * 1000;
const ROUTE_POLICIES: Record<
  string,
  { policy: RateLimitPolicy; limit: number }
> = {
  '/auth/login': { policy: 'auth-login', limit: 10 },
  '/auth/register': { policy: 'auth-register', limit: 5 },
  '/auth/google': { policy: 'auth-google', limit: 10 },
  '/auth/forgot-password': { policy: 'auth-forgot-password', limit: 5 },
  '/auth/reset-password': { policy: 'auth-reset-password', limit: 10 },
};

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  constructor(
    private readonly distributedRateLimit: DistributedRateLimitService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const routeKey = this.resolveRouteKey(req);
    const routePolicy = ROUTE_POLICIES[routeKey];

    if (!routePolicy) {
      next();
      return;
    }

    try {
      const rateLimit = await this.distributedRateLimit.consume({
        policy: routePolicy.policy,
        subject: this.resolveClientId(req),
        limit: routePolicy.limit,
        windowMs: WINDOW_MS,
      });

      if (!rateLimit.allowed) {
        res.setHeader('Retry-After', `${rateLimit.retryAfterSeconds}`);
        res.status(429).json({
          statusCode: 429,
          message: 'Too many attempts. Please try again later.',
        });
        return;
      }

      next();
    } catch (error: unknown) {
      if (error instanceof CoordinationUnavailableError) {
        res.status(503).json({
          statusCode: 503,
          message: 'Security controls temporarily unavailable.',
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Express route sans tenir compte de la casse, des barres obliques
   * redondantes ni des segments « . » : `/api/AUTH/LOGIN`, `/api/auth/login/`
   * et `/api/auth/./login` atteignent tous le contrôleur de connexion. La clé
   * de politique doit être normalisée de la même façon, sinon ces variantes
   * traversent le middleware sans aucune limitation de débit.
   */
  private resolveRouteKey(request: Request): string {
    const url = request.originalUrl || request.url || '';
    const [pathWithoutQuery] = url.split('?');
    const segments: string[] = [];

    for (const segment of pathWithoutQuery.toLowerCase().split('/')) {
      if (!segment || segment === '.') {
        continue;
      }
      if (segment === '..') {
        segments.pop();
        continue;
      }
      segments.push(segment);
    }

    return `/${segments.join('/')}`.replace(/^\/api(?=\/|$)/, '') || '/';
  }

  private resolveClientId(request: Request): string {
    // `req.ip` est resolu par Express via le proxy de confiance
    // (`trust proxy: 1` configure dans main.ts) : c'est la vraie IP client,
    // NON usurpable via un header `X-Forwarded-For` falsifie (contrairement a
    // un parsing manuel de l'en-tete, qui prend la valeur la plus a gauche
    // controlee par le client).
    return request.ip || request.socket.remoteAddress || 'unknown';
  }
}
