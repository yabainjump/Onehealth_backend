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
        JWT_SECRET: Joi.string().min(16).required(),
        JWT_EXPIRES_IN: Joi.string().default('1h'),
        CORS_ORIGIN: Joi.string().optional(),
        PUBLIC_BASE_URL: Joi.string().uri().optional(),
        FRONTEND_PUBLIC_URL: Joi.string().uri().optional(),
        SITE_NAME: Joi.string().min(2).max(120).optional(),
        SITE_DEFAULT_DESCRIPTION: Joi.string().min(10).max(300).optional(),
        DEFAULT_SHARE_IMAGE: Joi.string().uri().optional(),
        TWITTER_SITE_HANDLE: Joi.string()
          .pattern(/^@?[A-Za-z0-9_]{1,15}$/)
          .optional(),
        FRONTEND_RESET_PASSWORD_URL: Joi.string().uri().optional(),
        RESET_PASSWORD_TOKEN_TTL_MINUTES: Joi.number()
          .integer()
          .min(5)
          .max(180)
          .default(30),
        EXPOSE_RESET_TOKEN_FOR_DEBUG: Joi.boolean()
          .truthy('true')
          .falsy('false')
          .default(false),
      }),
    }),
  ],
})
export class AppConfigModule {}
