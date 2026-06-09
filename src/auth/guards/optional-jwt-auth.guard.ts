import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Auth JWT *optionnelle* : ne bloque jamais la requete.
 * - Token valide present -> `req.user` est rempli.
 * - Aucun token (ou token invalide) -> on laisse passer en invite (`req.user` = undefined).
 *
 * A utiliser sur les endpoints de LECTURE publique (fil, post, profil) pour que
 * les visiteurs non connectes puissent consulter, tout en personnalisant la
 * reponse (ex. "j'aime") quand un utilisateur est connecte.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(_err: unknown, user: TUser): TUser {
    return (user || undefined) as TUser;
  }
}
