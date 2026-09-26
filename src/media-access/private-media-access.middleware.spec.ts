import { NextFunction, Request, Response } from 'express';
import express from 'express';
import { request as httpRequest } from 'node:http';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  rmdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  it('refuse aussi un justificatif de certification sans signature', () => {
    const { middleware, response, next, status } = construire(false);
    middleware(
      { path: '/uploads/certification/diplome.pdf', query: {} } as Request,
      response,
      next,
    );
    expect(status).toHaveBeenCalledWith(403);
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

  it('blocks an encoded parent segment before express.static can reach private evidence', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ohn-private-media-'));
    const privateDir = join(root, 'certification');
    mkdirSync(privateDir);
    const evidence = join(privateDir, 'evidence.pdf');
    writeFileSync(evidence, 'PRIVATE-EVIDENCE');
    try {
      const app = express();
      const { middleware } = construire(false);
      app.use(middleware);
      app.use('/uploads', express.static(root));
      const server = app.listen(0, '127.0.0.1');
      try {
        await new Promise<void>((resolve) => server.once('listening', resolve));
        const address = server.address();
        if (!address || typeof address === 'string')
          throw new Error('Missing test port');
        const response = await new Promise<{ status: number; body: string }>(
          (resolve, reject) => {
            const outgoing = httpRequest(
              {
                hostname: '127.0.0.1',
                port: address.port,
                method: 'GET',
                path: '/uploads/post/%2e%2e/certification/evidence.pdf',
              },
              (incoming) => {
                const chunks: Buffer[] = [];
                incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
                incoming.on('end', () =>
                  resolve({
                    status: incoming.statusCode ?? 0,
                    body: Buffer.concat(chunks).toString(),
                  }),
                );
                incoming.on('error', reject);
              },
            );
            outgoing.on('error', reject);
            outgoing.end();
          },
        );
        expect(response.status).toBe(400);
        expect(response.body).not.toContain('PRIVATE-EVIDENCE');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      unlinkSync(evidence);
      rmdirSync(privateDir);
      rmdirSync(root);
    }
  });
});
