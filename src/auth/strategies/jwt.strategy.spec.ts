import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/schemas/user.schema';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const secondes = (date: Date): number => Math.floor(date.getTime() / 1000);

  const construire = (utilisateur: Record<string, unknown> | null) => {
    const findById = jest.fn().mockResolvedValue(utilisateur);
    const touchPresenceForValidSession = jest
      .fn()
      .mockImplementation(
        (_id: string, passwordChangeBeforeExclusive?: Date) => {
          if (!utilisateur || utilisateur.isBanned) {
            return Promise.resolve(null);
          }

          const passwordChangedAt =
            utilisateur.passwordChangedAt as Date | null;
          if (
            passwordChangedAt &&
            (!passwordChangeBeforeExclusive ||
              passwordChangedAt >= passwordChangeBeforeExclusive)
          ) {
            return Promise.resolve(null);
          }

          return Promise.resolve(utilisateur);
        },
      );
    const toPublicUser = jest.fn().mockReturnValue({ id: 'user-1' });
    const usersService = {
      findById,
      touchPresenceForValidSession,
      toPublicUser,
    } as unknown as UsersService;
    const configService = {
      get: jest.fn().mockReturnValue('a'.repeat(48)),
    } as unknown as ConfigService;
    return {
      strategy: new JwtStrategy(configService, usersService),
      findById,
      touchPresenceForValidSession,
      toPublicUser,
    };
  };

  const payload = (iat?: number): JwtPayload => ({
    sub: 'user-1',
    email: 'a@b.test',
    role: UserRole.USER,
    iat,
  });

  const utilisateur = (passwordChangedAt: Date | null) => ({
    _id: { toString: () => 'user-1' },
    isBanned: false,
    passwordChangedAt,
  });

  it('accepte un jeton quand aucun changement de mot de passe n’est enregistré', async () => {
    const { strategy } = construire(utilisateur(null));
    await expect(
      strategy.validate(payload(secondes(new Date()))),
    ).resolves.toEqual({
      id: 'user-1',
    });
  });

  it('accepte un jeton émis après le changement de mot de passe', async () => {
    const changement = new Date('2026-01-01T10:00:00.000Z');
    const { strategy } = construire(utilisateur(changement));
    const apres = secondes(new Date(changement.getTime() + 60_000));
    await expect(strategy.validate(payload(apres))).resolves.toEqual({
      id: 'user-1',
    });
  });

  // Cœur du correctif : un jeton volé ne doit pas survivre à la reprise en
  // main du compte par la victime.
  it('refuse un jeton émis avant le changement de mot de passe', async () => {
    const changement = new Date('2026-01-01T10:00:00.000Z');
    const { strategy, toPublicUser } = construire(utilisateur(changement));
    const avant = secondes(new Date(changement.getTime() - 60_000));
    await expect(strategy.validate(payload(avant))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(toPublicUser).not.toHaveBeenCalled();
  });

  it('refuse un jeton sans date d’émission dès qu’un changement existe', async () => {
    const { strategy, toPublicUser } = construire(
      utilisateur(new Date('2026-01-01T10:00:00.000Z')),
    );
    await expect(strategy.validate(payload(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(toPublicUser).not.toHaveBeenCalled();
  });

  it('refuse un compte banni', async () => {
    const { strategy, toPublicUser } = construire({
      _id: { toString: () => 'user-1' },
      isBanned: true,
      passwordChangedAt: null,
    });
    await expect(
      strategy.validate(payload(secondes(new Date()))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(toPublicUser).not.toHaveBeenCalled();
  });

  it('refuse un utilisateur introuvable', async () => {
    const { strategy, toPublicUser } = construire(null);
    await expect(
      strategy.validate(payload(secondes(new Date()))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(toPublicUser).not.toHaveBeenCalled();
  });

  it('met à jour la présence seulement après validation de la session', async () => {
    const { strategy, findById, touchPresenceForValidSession } = construire(
      utilisateur(null),
    );

    await strategy.validate(payload(secondes(new Date())));

    expect(touchPresenceForValidSession).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
    );
    expect(findById).not.toHaveBeenCalled();
  });
});
