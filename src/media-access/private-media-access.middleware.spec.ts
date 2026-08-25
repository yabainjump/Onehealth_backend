import { NextFunction, Request, Response } from 'express';
import { MediaSignatureService } from './media-signature.service';
import {
  createPrivateMediaAccessMiddleware,
  PRIVATE_MEDIA_CACHE_CONTROL,
} from './private-media-access.middleware';

describe('createPrivateMediaAccessMiddleware', () => {
  const construire = (verification: boolean) => {
    const verify = jest.fn().mockReturnValue(verification);
    const mediaSignature = {
      verify,
    } as unknown as MediaSignatureService;
    const middleware = createPrivateMediaAccessMiddleware(mediaSignature);
    const setHeader = jest.fn();
    const status = jest.fn();
    const json = jest.fn();
    const response = {
      setHeader,
      status,
      json,
    } as unknown as Response;
    status.mockReturnValue(response);
    const next = jest.fn() as NextFunction;

    return { verify, middleware, response, next, setHeader, status, json };
  };

  it('laisse passer un média public sans modifier son cache', () => {
    const { verify, middleware, response, next, setHeader } = construire(false);

    middleware(
      { path: '/uploads/profile/avatar.webp', query: {} } as Request,
      response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(verify).not.toHaveBeenCalled();
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('sert un média privé valide sans autoriser sa mise en cache', () => {
    const { middleware, response, next, setHeader } = construire(true);

    middleware(
      {
        path: '/uploads/message/document.pdf',
        query: { exp: '2000000000000', sig: 'a'.repeat(64) },
      } as unknown as Request,
      response,
      next,
    );

    expect(setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      PRIVATE_MEDIA_CACHE_CONTROL,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('refuse un média privé dont la signature est invalide', () => {
    const { middleware, response, next, setHeader, status } = construire(false);

    middleware(
      { path: '/uploads/message/document.pdf', query: {} } as Request,
      response,
      next,
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(next).not.toHaveBeenCalled();
  });

  it('répond 400 à un chemin dont l’encodage est invalide', () => {
    const { middleware, response, next, status, json } = construire(false);

    middleware(
      { path: '/uploads/message/%E0%A4%A', query: {} } as Request,
      response,
      next,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Le chemin de la requête est invalide.',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
