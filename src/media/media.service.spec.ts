import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { join, sep } from 'path';
import { MediaService } from './media.service';

describe('MediaService', () => {
  const uploadsRoot = join(process.cwd(), 'uploads');
  let service: MediaService;

  beforeEach(() => {
    service = new MediaService();
  });

  describe('confinement des chemins source', () => {
    const resolve = (value: string): string =>
      (
        service as unknown as { resolveSourcePath(v: string): string }
      ).resolveSourcePath(value);

    it('accepte un chemin /uploads légitime', () => {
      expect(resolve('/uploads/post/image.webp')).toBe(
        join(uploadsRoot, 'post', 'image.webp'),
      );
    });

    // La propriete de securite est le confinement : soit le chemin est refuse,
    // soit il reste sous la racine des uploads. Les deux issues sont sures ;
    // seule une resolution hors racine acceptee serait une faille.
    it.each([
      '../../../../etc/passwd',
      '/uploads/../../.env',
      '/uploads/post/../../../../../../etc/shadow',
      '....//....//.env',
      '/uploads//////../../../.env',
      '/uploads/./post/../post/ok.webp',
      '/etc/passwd',
      'uploads/../../../.env',
    ])('ne sort jamais de la racine des uploads pour %s', (hostile) => {
      let resolved: string;
      try {
        resolved = resolve(hostile);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        return;
      }
      expect(
        resolved === uploadsRoot || resolved.startsWith(uploadsRoot + sep),
      ).toBe(true);
    });
  });

  // `/api/media/*` est public : sans plafond, un afflux de requêtes non
  // authentifiées pourrait occuper tout le CPU avec sharp/ffmpeg.
  describe('plafond de générations simultanées', () => {
    const begin = (): void =>
      (service as unknown as { beginGeneration(): void }).beginGeneration();
    const end = (): void =>
      (service as unknown as { endGeneration(): void }).endGeneration();

    it('refuse la génération au-delà du plafond', () => {
      for (let i = 0; i < 4; i += 1) {
        expect(() => begin()).not.toThrow();
      }
      expect(() => begin()).toThrow(ServiceUnavailableException);
    });

    it('libère le jeton après chaque génération', () => {
      for (let i = 0; i < 4; i += 1) begin();
      end();
      expect(() => begin()).not.toThrow();
    });

    it('ne descend jamais sous zéro', () => {
      end();
      end();
      for (let i = 0; i < 4; i += 1) {
        expect(() => begin()).not.toThrow();
      }
      expect(() => begin()).toThrow(ServiceUnavailableException);
    });
  });
});
