import { accessSync, constants, mkdirSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

/**
 * Dossier persistant des fichiers envoyes par les utilisateurs.
 * En local, conserve le comportement historique avec `<projet>/uploads`.
 */
export function resolveUploadsRoot(): string {
  const configured = `${process.env.UPLOADS_DIR || ''}`.trim();

  if (process.env.NODE_ENV === 'production') {
    if (!configured) {
      throw new Error(
        'UPLOADS_DIR must identify the shared media directory in production.',
      );
    }
    if (!isAbsolute(configured)) {
      throw new Error('UPLOADS_DIR must be an absolute path in production.');
    }
  }

  return configured ? resolve(configured) : join(process.cwd(), 'uploads');
}

/**
 * Prépare le stockage commun avant l'ouverture du port HTTP. Un échec est
 * volontairement bloquant : accepter des uploads sur un disque local ou non
 * inscriptible rendrait les médias aléatoires entre workers.
 */
export function ensureUploadsRootReady(): string {
  const root = resolveUploadsRoot();

  try {
    mkdirSync(root, { recursive: true });
    if (!statSync(root).isDirectory()) {
      throw new Error('the configured path is not a directory');
    }
    accessSync(root, constants.R_OK | constants.W_OK);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    throw new Error(`UPLOADS_DIR is not a writable directory: ${reason}`);
  }

  return root;
}
