import { join, resolve } from 'path';

/**
 * Dossier persistant des fichiers envoyes par les utilisateurs.
 * En local, conserve le comportement historique avec `<projet>/uploads`.
 */
export function resolveUploadsRoot(): string {
  const configured = `${process.env.UPLOADS_DIR || ''}`.trim();
  return configured ? resolve(configured) : join(process.cwd(), 'uploads');
}
