import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Les fichiers de `/uploads/message/` sont des pieces jointes de conversations
 * privees. Ils etaient servis en statique, donc lisibles par quiconque
 * connaissait l'URL. On exige desormais une signature a duree limitee, emise
 * par le serveur au moment ou l'utilisateur autorise lit la conversation.
 *
 * La signature couvre le chemin ET l'expiration : elle n'est pas transferable
 * a un autre fichier et cesse de fonctionner apres son echeance.
 */
@Injectable()
export class MediaSignatureService {
  /** Prefixes dont la lecture exige une signature valide. */
  static readonly PROTECTED_PREFIXES = ['/uploads/message/'];

  private static readonly DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  private readonly secret: string;
  private readonly ttlMs: number;

  constructor(configService: ConfigService) {
    const configured =
      `${configService.get<string>('MEDIA_URL_SECRET') ?? ''}`.trim();

    // Sans secret dedie, on en derive un par separation de domaine plutot que
    // de reutiliser tel quel le secret JWT pour un autre usage.
    this.secret = configured
      ? configured
      : createHmac('sha256', `${configService.get<string>('JWT_SECRET') ?? ''}`)
          .update('media-url-signature-v1')
          .digest('hex');

    this.ttlMs =
      configService.get<number>('mediaUrlTtlMs') ??
      MediaSignatureService.DEFAULT_TTL_MS;
  }

  /** Indique si ce chemin ne peut etre servi que signe. */
  static isProtectedPath(pathname: string): boolean {
    const normalized = `${pathname || ''}`.toLowerCase();
    return MediaSignatureService.PROTECTED_PREFIXES.some((prefix) =>
      normalized.startsWith(prefix),
    );
  }

  /**
   * Renvoie l'URL signee si le chemin est protege, l'URL inchangee sinon.
   * Une URL deja signee n'est pas resignee.
   */
  sign(rawUrl: string, now = Date.now()): string {
    const value = `${rawUrl || ''}`.trim();
    if (!value) {
      return '';
    }

    const pathname = this.extractPathname(value);
    if (!pathname || !MediaSignatureService.isProtectedPath(pathname)) {
      return value;
    }

    // Le client renvoie l'URL qu'il a recue (deja signee) et elle est stockee
    // telle quelle : sans ce nettoyage, la relecture produirait `sig` en
    // double, qu'Express expose alors comme un tableau et que la barriere
    // rejetterait. `sign` doit donc rester idempotente.
    const canonique = this.stripSignature(value);
    const expiresAt = now + this.ttlMs;
    const signature = this.compute(pathname, expiresAt);
    const separator = canonique.includes('?') ? '&' : '?';
    return `${canonique}${separator}exp=${expiresAt}&sig=${signature}`;
  }

  /** Verifie une signature presentee pour un chemin donne. */
  verify(
    pathname: string,
    expiresAt: string | undefined,
    signature: string | undefined,
    now = Date.now(),
  ): boolean {
    const expiry = Number(expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now) {
      return false;
    }
    if (!signature || !/^[a-f0-9]{64}$/.test(signature)) {
      return false;
    }

    const expected = this.compute(pathname, expiry);
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  }

  /** Retire une eventuelle signature precedente en conservant le reste. */
  private stripSignature(value: string): string {
    const [chemin, requete] = value.split('?');
    if (!requete) {
      return chemin;
    }

    const restant: string[] = [];
    for (const couple of requete.split('&')) {
      const cle = couple.split('=')[0].toLowerCase();
      if (cle !== 'exp' && cle !== 'sig' && couple.length > 0) {
        restant.push(couple);
      }
    }

    return restant.length ? `${chemin}?${restant.join('&')}` : chemin;
  }

  private compute(pathname: string, expiresAt: number): string {
    return createHmac('sha256', this.secret)
      .update(`${pathname.toLowerCase()}|${expiresAt}`)
      .digest('hex');
  }

  private extractPathname(value: string): string {
    if (value.startsWith('/')) {
      return value.split('?')[0];
    }
    try {
      return new URL(value).pathname;
    } catch {
      return '';
    }
  }
}
