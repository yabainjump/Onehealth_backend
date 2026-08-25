import { ConfigService } from '@nestjs/config';
import { MediaSignatureService } from './media-signature.service';

describe('MediaSignatureService', () => {
  const construire = (valeurs: Record<string, unknown> = {}) =>
    new MediaSignatureService({
      get: (cle: string) =>
        ({
          JWT_SECRET: 'j'.repeat(48),
          ...valeurs,
        })[cle],
    } as unknown as ConfigService);

  let service: MediaSignatureService;

  beforeEach(() => {
    service = construire();
  });

  describe('périmètre protégé', () => {
    it('protège les pièces jointes de conversation', () => {
      expect(
        MediaSignatureService.isProtectedPath('/uploads/message/a.webp'),
      ).toBe(true);
    });

    it('laisse publics les médias de profil et de publication', () => {
      expect(
        MediaSignatureService.isProtectedPath('/uploads/profile/a.webp'),
      ).toBe(false);
      expect(
        MediaSignatureService.isProtectedPath('/uploads/post/a.webp'),
      ).toBe(false);
    });
  });

  describe('signature', () => {
    it('n’ajoute rien à une URL publique', () => {
      const url = 'https://api.test/uploads/post/a.webp';
      expect(service.sign(url)).toBe(url);
    });

    it('signe une pièce jointe privée et la validation réussit', () => {
      const signee = service.sign('https://api.test/uploads/message/a.webp');
      const params = new URL(signee).searchParams;

      expect(params.get('sig')).toMatch(/^[a-f0-9]{64}$/);
      expect(
        service.verify(
          '/uploads/message/a.webp',
          params.get('exp') ?? undefined,
          params.get('sig') ?? undefined,
        ),
      ).toBe(true);
    });

    it('fonctionne aussi sur un chemin relatif', () => {
      const signee = service.sign('/uploads/message/a.webp');
      expect(signee).toContain('sig=');
      expect(signee.startsWith('/uploads/message/a.webp?')).toBe(true);
    });
  });

  // Le client renvoie l'URL signee qu'il a recue, et elle est stockee telle
  // quelle : re-signer ne doit jamais empiler deux `sig`.
  describe('idempotence', () => {
    it('ne signe pas deux fois la même URL', () => {
      const une = service.sign('https://api.test/uploads/message/a.webp');
      const deux = service.sign(une);
      const params = new URL(deux).searchParams;

      expect(params.getAll('sig').length).toBe(1);
      expect(params.getAll('exp').length).toBe(1);
      expect(
        service.verify(
          '/uploads/message/a.webp',
          params.get('exp') ?? undefined,
          params.get('sig') ?? undefined,
        ),
      ).toBe(true);
    });

    it('conserve les autres paramètres de requête', () => {
      const signee = service.sign(
        'https://api.test/uploads/message/a.webp?v=3',
      );
      expect(new URL(signee).searchParams.get('v')).toBe('3');
    });
  });

  describe('vérification', () => {
    const signature = () => {
      const signee = service.sign('/uploads/message/a.webp');
      const params = new URLSearchParams(signee.split('?')[1]);
      return {
        exp: params.get('exp') as string,
        sig: params.get('sig') as string,
      };
    };

    it('refuse une signature absente', () => {
      expect(
        service.verify(
          '/uploads/message/a.webp',
          `${Date.now() + 1000}`,
          undefined,
        ),
      ).toBe(false);
    });

    it('refuse une signature malformée', () => {
      expect(
        service.verify(
          '/uploads/message/a.webp',
          `${Date.now() + 1000}`,
          'zzz',
        ),
      ).toBe(false);
    });

    // Le coeur du controle : une signature valide ne doit pas ouvrir un AUTRE
    // fichier, sinon il suffirait d'un lien legitime pour tout lire.
    it('refuse une signature rejouée sur un autre fichier', () => {
      const { exp, sig } = signature();
      expect(service.verify('/uploads/message/autre.webp', exp, sig)).toBe(
        false,
      );
    });

    it('refuse une échéance prolongée après coup', () => {
      const { exp, sig } = signature();
      const prolongee = `${Number(exp) + 86_400_000}`;
      expect(service.verify('/uploads/message/a.webp', prolongee, sig)).toBe(
        false,
      );
    });

    it('refuse une signature expirée', () => {
      const { exp, sig } = signature();
      const apres = Number(exp) + 1;
      expect(service.verify('/uploads/message/a.webp', exp, sig, apres)).toBe(
        false,
      );
    });

    it('refuse la signature émise avec un autre secret', () => {
      const { exp, sig } = signature();
      const autre = construire({ MEDIA_URL_SECRET: 'x'.repeat(48) });
      expect(autre.verify('/uploads/message/a.webp', exp, sig)).toBe(false);
    });
  });
});
