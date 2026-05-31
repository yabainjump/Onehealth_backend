import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { UserRole } from '../users/schemas/user.schema';

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: MailService, useValue: mailServiceMock },
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
});
