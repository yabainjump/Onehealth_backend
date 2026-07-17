import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
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
  private googleClient: OAuth2Client | null = null;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
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

    // E-mail de bienvenue (best-effort : ne bloque ni ne ralentit l'inscription).
    const welcomeName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    void this.mailService.sendWelcome(user.email, welcomeName);

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

  /**
   * Connexion / inscription via Google. Vérifie l'ID token émis par Google
   * Identity Services (audience = notre Client ID), puis relie ou crée le
   * compte correspondant à l'e-mail Google.
   */
  async loginWithGoogle(dto: GoogleLoginDto): Promise<AuthResponse> {
    const payload = await this.verifyGoogleIdToken(dto.idToken);

    const email = (payload.email || '').toLowerCase().trim();
    if (!email || !payload.email_verified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    let user = await this.usersService.findByEmail(email);

    if (!user) {
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
      user = await this.usersService.create({
        email,
        passwordHash,
        username: await this.generateUsernameFromEmail(email),
        firstName: payload.given_name || 'Utilisateur',
        lastName: payload.family_name || 'OneHealth',
        photoURL: payload.picture ?? '',
        googleId: payload.sub,
      });

      const welcomeName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      void this.mailService.sendWelcome(user.email, welcomeName);
    } else if (!user.googleId) {
      // Compte existant (créé par e-mail/mot de passe) : on relie Google.
      user.googleId = payload.sub;
      await user.save();
    }

    return this.buildAuthResponse(user);
  }

  private async verifyGoogleIdToken(idToken: string) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new NotImplementedException('Google sign-in is not configured');
    }
    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(clientId);
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Empty Google token payload');
      }
      return payload;
    } catch (error) {
      this.logger.warn(`Google ID token verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  /** Génère un pseudo lisible et raisonnablement unique à partir de l'e-mail. */
  private async generateUsernameFromEmail(email: string): Promise<string> {
    const base =
      email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 30) || 'user';
    const suffix = randomBytes(2).toString('hex');
    const candidate = `${base}${suffix}`.slice(0, 40);
    return candidate.length >= 3 ? candidate : `user${suffix}`;
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

    const resetUrl = this.buildResetUrl(resetToken);

    // Envoi de l'email de reinitialisation (best-effort : ne bloque jamais le flux).
    const emailSent = await this.mailService.sendPasswordReset(
      user.email,
      resetUrl,
      tokenTtlMinutes,
    );

    const isProduction =
      (this.configService.get<string>('NODE_ENV') ?? 'development') ===
      'production';

    const exposeResetTokenForDebug =
      this.configService.get<boolean>('EXPOSE_RESET_TOKEN_FOR_DEBUG') ?? false;

    if (!isProduction && exposeResetTokenForDebug) {
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

    if (!emailSent) {
      this.logger.warn(
        `Password reset requested for ${user.email} but no email was sent (SMTP not configured or send failed).`,
      );
    } else if (!isProduction) {
      this.logger.log(`Password reset email sent to ${user.email}.`);
    } else {
      this.logger.log(
        `Password reset email sent to user ${user._id.toString()}.`,
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
    if (user.isBanned) {
      throw new UnauthorizedException('Account suspended');
    }

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
      user: this.usersService.toPublicUser(
        onlineUser,
        onlineUser._id.toString(),
      ),
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
