import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import configuration from './configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [configuration],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().port().default(3000),
        MONGODB_URI: Joi.string()
          .pattern(/^mongodb(\+srv)?:\/\/.+$/)
          .required(),
        JWT_SECRET: Joi.string().min(32).required(),
        JWT_EXPIRES_IN: Joi.string().default('1h'),
        // Client ID OAuth Web (Google Cloud Console). Optionnel : si absent,
        // POST /auth/google répond 501 au lieu de planter le démarrage.
        GOOGLE_CLIENT_ID: Joi.string().optional(),
        CORS_ORIGIN: Joi.string().optional(),
        PUBLIC_BASE_URL: Joi.string()
          .uri({ scheme: ['http', 'https'] })
          .optional(),
        UPLOADS_DIR: Joi.string().trim().min(1).optional(),
        FRONTEND_PUBLIC_URL: Joi.string()
          .uri({ scheme: ['http', 'https'] })
          .optional(),
        SITE_NAME: Joi.string().min(2).max(120).optional(),
        SITE_DEFAULT_DESCRIPTION: Joi.string().min(10).max(300).optional(),
        DEFAULT_SHARE_IMAGE: Joi.string()
          .uri({ scheme: ['http', 'https'] })
          .optional(),
        TWITTER_SITE_HANDLE: Joi.string()
          .pattern(/^@?[A-Za-z0-9_]{1,15}$/)
          .optional(),
        SWAGGER_ENABLED: Joi.boolean()
          .truthy('true')
          .falsy('false')
          .optional(),
        SWAGGER_PATH: Joi.string().trim().min(1).default('api/docs'),
        SWAGGER_TITLE: Joi.string().min(2).max(120).optional(),
        SWAGGER_DESCRIPTION: Joi.string().min(10).max(400).optional(),
        SWAGGER_VERSION: Joi.string().trim().min(1).default('1.0.0'),
        FRONTEND_RESET_PASSWORD_URL: Joi.string()
          .uri({ scheme: ['http', 'https'] })
          .optional(),
        RESET_PASSWORD_TOKEN_TTL_MINUTES: Joi.number()
          .integer()
          .min(5)
          .max(180)
          .default(30),
        EXPOSE_RESET_TOKEN_FOR_DEBUG: Joi.boolean()
          .truthy('true')
          .falsy('false')
          .default(false),
        SMTP_HOST: Joi.string().optional(),
        SMTP_PORT: Joi.number().port().optional(),
        SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').optional(),
        SMTP_USER: Joi.string().optional(),
        SMTP_PASS: Joi.string().optional(),
        MAIL_FROM: Joi.string().optional(),
        GROQ_API_KEY: Joi.string()
          .trim()
          .allow('')
          .min(20)
          .pattern(/^gsk_/)
          .optional(),
        GROQ_MODEL: Joi.string()
          .trim()
          .min(3)
          .max(120)
          .default('llama-3.3-70b-versatile'),
        GROQ_TIMEOUT_MS: Joi.number()
          .integer()
          .min(5_000)
          .max(60_000)
          .default(30_000),
        RUDOLF_RATE_LIMIT_PER_10_MIN: Joi.number()
          .integer()
          .min(1)
          .max(100)
          .default(12),
        RUDOLF_DAILY_LIMIT: Joi.number()
          .integer()
          .min(1)
          .max(10_000)
          .default(100),
      }),
    }),
  ],
})
export class AppConfigModule {}
