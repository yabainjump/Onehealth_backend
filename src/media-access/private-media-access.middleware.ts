import { NextFunction, Request, Response } from 'express';
import { MediaSignatureService } from './media-signature.service';

export const PRIVATE_MEDIA_CACHE_CONTROL = 'private, no-store, max-age=0';

function reject(
  res: Response,
  statusCode: 400 | 403,
  error: 'Bad Request' | 'Forbidden',
  message: string,
): void {
  res.setHeader('Cache-Control', 'no-store');
  res.status(statusCode).json({ statusCode, error, message });
}

/**
 * Barrière placée avant le serveur statique des uploads.
 *
 * Elle refuse les chemins mal encodés, vérifie la signature des pièces jointes
 * privées et interdit leur mise en cache au-delà de la durée d'autorisation.
 */
export function createPrivateMediaAccessMiddleware(
  mediaSignature: MediaSignatureService,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let pathname: string;

    try {
      pathname = decodeURIComponent(req.path || '').toLowerCase();
    } catch {
      reject(res, 400, 'Bad Request', 'Le chemin de la requête est invalide.');
      return;
    }

    if (!MediaSignatureService.isProtectedPath(pathname)) {
      next();
      return;
    }

    const query = req.query as Record<string, unknown>;
    const expiresAt = typeof query.exp === 'string' ? query.exp : undefined;
    const signature = typeof query.sig === 'string' ? query.sig : undefined;

    if (!mediaSignature.verify(pathname, expiresAt, signature)) {
      reject(res, 403, 'Forbidden', 'Lien de media expire ou invalide.');
      return;
    }

    res.setHeader('Cache-Control', PRIVATE_MEDIA_CACHE_CONTROL);
    next();
  };
}
