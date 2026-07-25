import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { UserRole } from '../users/schemas/user.schema';
import { GoogleAvatarService } from './google-avatar.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;

  const usersServiceMock = {
    findByEmail: jest.fn(),
    toPublicUser: jest.fn(),
    markOnline: jest.fn().mockResolvedValue(null),
    markOffline: jest.fn().mockResolvedValue(undefined),
  };

  const jwtServiceMock = {
    signAsync: jest.fn().mockResolvedValue('mocked-token'),
  };

  const configServiceMock = {
    get: jest.fn().mockReturnValue('1h'),
  };

  const mailServiceMock = {
    sendPasswordReset: jest.fn().mockResolvedValue(true),
  };

  const googleAvatarServiceMock = {
    mirror: jest.fn(),
    isGoogleHostedURL: jest.fn(),
    isManagedAvatarAvailable: jest.fn(),
    removePreviousManagedAvatar: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: MailService, useValue: mailServiceMock },
        {
          provide: GoogleAvatarService,
          useValue: googleAvatarServiceMock,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('should login successfully with valid credentials', async () => {
    const user = {
      _id: { toString: () => 'user-id-1' },
      email: 'john.doe@example.com',
      passwordHash: 'hashed-password',
      firstName: 'John',
      lastName: 'Doe',
      institution: 'One Health',
      role: UserRole.USER,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    const publicUser = {
      id: 'user-id-1',
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      institution: user.institution,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    usersServiceMock.findByEmail.mockResolvedValue(user);
    usersServiceMock.toPublicUser.mockReturnValue(publicUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await authService.login({
      email: 'john.doe@example.com',
      password: 'clear-password',
    });

    expect(result.accessToken).toBe('mocked-token');
    expect(result.tokenType).toBe('Bearer');
    expect(result.user).toEqual(publicUser);
  });

  it('should throw UnauthorizedException when password is invalid', async () => {
    usersServiceMock.findByEmail.mockResolvedValue({
      passwordHash: 'hashed-password',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      authService.login({
        email: 'john.doe@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('migrates a legacy Google avatar to local storage on login', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const user = {
      _id: { toString: () => 'user-id-1' },
      email: 'google@example.com',
      googleId: 'google-sub-1',
      photoURL: 'https://lh3.googleusercontent.com/a/legacy-avatar',
      photoSource: undefined,
      googlePhotoURL: '',
      save,
    };
    const publicUser = {
      id: 'user-id-1',
      photoURL: '/uploads/profile/google.webp',
    };

    jest.spyOn(authService as any, 'verifyGoogleIdToken').mockResolvedValue({
      sub: 'google-sub-1',
      email: 'google@example.com',
      email_verified: true,
      picture: 'https://lh3.googleusercontent.com/a/current-avatar',
    });
    usersServiceMock.findByEmail.mockResolvedValue(user);
    usersServiceMock.toPublicUser.mockReturnValue(publicUser);
    googleAvatarServiceMock.isGoogleHostedURL.mockReturnValue(true);
    googleAvatarServiceMock.mirror.mockResolvedValue({
      photoURL: '/uploads/profile/google-local.webp',
      sourceURL: 'https://lh3.googleusercontent.com/a/current-avatar',
    });

    const result = await authService.loginWithGoogle({
      idToken: 'valid-token',
    });

    expect(googleAvatarServiceMock.mirror).toHaveBeenCalledWith(
      'https://lh3.googleusercontent.com/a/current-avatar',
      'google-sub-1',
    );
    expect(user.photoURL).toBe('/uploads/profile/google-local.webp');
    expect(user.photoSource).toBe('google');
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.user).toEqual(publicUser);
  });

  it('does not overwrite an avatar manually selected by the user', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const user = {
      _id: { toString: () => 'user-id-2' },
      email: 'custom@example.com',
      googleId: 'google-sub-2',
      photoURL: '/uploads/profile/custom.webp',
      photoSource: 'user',
      googlePhotoURL: '',
      save,
    };

    jest.spyOn(authService as any, 'verifyGoogleIdToken').mockResolvedValue({
      sub: 'google-sub-2',
      email: 'custom@example.com',
      email_verified: true,
      picture: 'https://lh3.googleusercontent.com/a/google-avatar',
    });
    usersServiceMock.findByEmail.mockResolvedValue(user);
    usersServiceMock.toPublicUser.mockReturnValue({ id: 'user-id-2' });

    await authService.loginWithGoogle({ idToken: 'valid-token' });

    expect(googleAvatarServiceMock.mirror).not.toHaveBeenCalled();
    expect(user.photoURL).toBe('/uploads/profile/custom.webp');
    expect(save).not.toHaveBeenCalled();
  });
});
