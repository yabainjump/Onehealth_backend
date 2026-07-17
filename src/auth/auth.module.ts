import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthRateLimitMiddleware } from './middleware/auth-rate-limit.middleware';

function parseJwtExpiresInToSeconds(rawValue?: string): number {
  if (!rawValue) {
    return 3600;
  }

  const value = rawValue.trim().toLowerCase();
  const match = value.match(/^(\d+)(s|m|h|d)?$/);
  if (!match) {
    return 3600;
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? 's';

  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 3600;
  if (unit === 'd') return amount * 86400;
  return amount;
}

@Module({
  imports: [
    UsersModule,
    MailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const rawExpiresIn =
          configService.get<string>('JWT_EXPIRES_IN') ?? '1h';
        const expiresInSeconds = parseJwtExpiresInToSeconds(rawExpiresIn);

        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expiresInSeconds,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuthRateLimitMiddleware).forRoutes(
      { path: 'auth/login', method: RequestMethod.POST },
      { path: 'auth/register', method: RequestMethod.POST },
      { path: 'auth/google', method: RequestMethod.POST },
      { path: 'auth/forgot-password', method: RequestMethod.POST },
      { path: 'auth/reset-password', method: RequestMethod.POST },
    );
  }
}
