import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UsersService } from '../users/users.service';
import { PublicUser } from '../users/interfaces/public-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UserDocument } from '../users/schemas/user.schema';

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: PublicUser;
}

export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
  resetUrl?: string;
  expiresInMinutes?: number;
}

@Injectable()
export class AuthService {
  private static readonly DEFAULT_RESET_TOKEN_TTL_MINUTES = 30;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);

    const user = await this.usersService.create({
      email: registerDto.email,
      passwordHash,
      username: registerDto.username,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      institution: registerDto.institution,
      typeMedecin: registerDto.typeMedecin,
      country: registerDto.country,
      city: registerDto.city,
      phone: (registerDto.phone || '').trim(),
      bio: registerDto.bio,
      photoURL: registerDto.photoURL ?? '',
    });

    return this.buildAuthResponse(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginDto.email, true);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildAuthResponse(user);
  }

  async logout(userId: string): Promise<{ success: boolean }> {
    await this.usersService.markOffline(userId);
    return { success: true };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<ForgotPasswordResponse> {
    const tokenTtlMinutes = this.getResetTokenTtlMinutes();
    const expiresAt = new Date(Date.now() + tokenTtlMinutes * 60_000);
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenHash = this.hashResetToken(resetToken);

    const user = await this.usersService.setPasswordResetTokenByEmail(
      forgotPasswordDto.email,
      resetTokenHash,
      expiresAt,
    );

    const message =
      'If an account exists for this email, reset instructions have been sent.';

    if (!user) {
      return { message };
    }

    const isProduction =
      (this.configService.get<string>('NODE_ENV') ?? 'development') ===
      'production';

    const exposeResetTokenForDebug =
      this.configService.get<boolean>('EXPOSE_RESET_TOKEN_FOR_DEBUG') ?? false;

    if (!isProduction && exposeResetTokenForDebug) {
      const resetUrl = this.buildResetUrl(resetToken);
      this.logger.log(
        `Password reset link generated for ${user.email}: ${resetUrl}`,
      );

      return {
        message,
        resetToken,
        resetUrl,
        expiresInMinutes: tokenTtlMinutes,
      };
    }

    if (!isProduction) {
      this.logger.log(
        `Password reset requested for ${user.email}. Debug token exposure is disabled.`,
      );
    } else {
      this.logger.log(
        `Password reset requested for user ${user._id.toString()} (${user.email}).`,
      );
    }

    return { message };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const tokenHash = this.hashResetToken(resetPasswordDto.token);
    const newPasswordHash = await bcrypt.hash(resetPasswordDto.password, 12);

    const updatedUser = await this.usersService.resetPasswordByTokenHash(
      tokenHash,
      newPasswordHash,
      new Date(),
    );

    if (!updatedUser) {
      throw new BadRequestException(
        'Reset token is invalid or expired. Please request a new one.',
      );
    }

    return {
      message: 'Password reset successful. You can now sign in.',
    };
  }

  private async buildAuthResponse(user: UserDocument): Promise<AuthResponse> {
    const onlineUser = (await this.usersService.markOnline(
      user._id.toString(),
    )) ?? user;

    const payload: JwtPayload = {
      sub: onlineUser._id.toString(),
      email: onlineUser.email,
      role: onlineUser.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') ?? '1h',
      user: this.usersService.toPublicUser(onlineUser),
    };
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getResetTokenTtlMinutes(): number {
    const rawValue = Number(
      this.configService.get<string>('RESET_PASSWORD_TOKEN_TTL_MINUTES') ??
        AuthService.DEFAULT_RESET_TOKEN_TTL_MINUTES,
    );

    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      return AuthService.DEFAULT_RESET_TOKEN_TTL_MINUTES;
    }

    return Math.min(Math.floor(rawValue), 180);
  }

  private buildResetUrl(resetToken: string): string {
    const configuredUrl = (
      this.configService.get<string>('FRONTEND_RESET_PASSWORD_URL') ?? ''
    ).trim();

    const fallbackBase = this.getFallbackResetPasswordUrl();
    const baseUrl = configuredUrl || fallbackBase;
    const separator = baseUrl.includes('?') ? '&' : '?';

    return `${baseUrl}${separator}token=${encodeURIComponent(resetToken)}`;
  }

  private getFallbackResetPasswordUrl(): string {
    const corsOrigins = this.configService.get<string>('CORS_ORIGIN') ?? '';
    const firstOrigin = corsOrigins
      .split(',')
      .map((origin) => origin.trim())
      .find((origin) => origin.length > 0);

    const origin = firstOrigin ?? 'http://localhost:8100';
    return `${origin.replace(/\/+$/, '')}/reset-password`;
  }
}
