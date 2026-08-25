import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? '',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.touchPresence(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid token');
    }
    if (user.isBanned) {
      throw new UnauthorizedException('Account suspended');
    }
    if (this.isIssuedBeforePasswordChange(payload, user.passwordChangedAt)) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }

    return this.usersService.toPublicUser(user, user._id.toString());
  }

  /**
   * Une reinitialisation de mot de passe doit fermer les sessions deja
   * ouvertes : sans cela, un jeton vole reste valide jusqu'a son expiration
   * naturelle, meme apres que la victime a repris la main sur son compte.
   */
  private isIssuedBeforePasswordChange(
    payload: JwtPayload,
    passwordChangedAt?: Date | null,
  ): boolean {
    if (!passwordChangedAt) {
      return false;
    }
    if (typeof payload.iat !== 'number') {
      // Jeton sans date d'emission : impossible de le situer, on refuse.
      return true;
    }

    // `iat` est en secondes : on tolere la seconde en cours pour ne pas
    // rejeter un jeton emis dans la meme seconde que le changement.
    return payload.iat * 1000 + 1000 < passwordChangedAt.getTime();
  }
}
