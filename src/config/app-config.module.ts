import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import configuration from './configuration';

export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  MONGODB_URI: Joi.string()
    .pattern(/^mongodb(\+srv)?:\/\/.+$/)
    .required(),
  MONGODB_DB_NAME: Joi.string().trim().min(1).max(64).default('onehealth'),
  MONGODB_MAX_POOL_SIZE: Joi.number().integer().min(1).max(100).default(10),
  HUB_MONGODB_URI: Joi.string()
    .allow('')
    .pattern(/^mongodb(\+srv)?:\/\/.+$/)
    .optional(),
  HUB_MONGODB_DB_NAME: Joi.string()
    .trim()
    .min(1)
    .max(64)
    .default('onehealth_hub'),
  HUB_MONGODB_MAX_POOL_SIZE: Joi.number().integer().min(1).max(100).default(10),
  WEB_CONCURRENCY: Joi.number().integer().min(1).max(8).default(2),
  CLUSTER_SECURITY_READY: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  INSTANCE_ID: Joi.string()
    .trim()
    .min(1)
    .max(96)
    .pattern(/^[A-Za-z0-9._:-]+$/)
    .optional(),
  TRUSTED_PROXY_HOPS: Joi.number().integer().min(0).max(8).default(1),
  SHUTDOWN_TIMEOUT_MS: Joi.number()
    .integer()
    .min(5_000)
    .max(120_000)
    .default(15_000),
  READINESS_PROBE_INTERVAL_MS: Joi.number()
    .integer()
    .min(500)
    .max(60_000)
    .default(2_000),
  READINESS_PROBE_TIMEOUT_MS: Joi.number()
    .integer()
    .min(100)
    .max(10_000)
    .default(1_500),
  READINESS_FAILURE_THRESHOLD: Joi.number().integer().min(1).max(20).default(3),
  READINESS_RETRY_AFTER_SECONDS: Joi.number()
    .integer()
    .min(1)
    .max(300)
    .default(5),
  RATE_LIMIT_KEY_SECRET: Joi.string()
    .min(32)
    .max(512)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required().invalid(Joi.ref('JWT_SECRET')),
      otherwise: Joi.optional(),
    }),
  RATE_LIMIT_CLEANUP_GRACE_MS: Joi.number()
    .integer()
    .min(60_000)
    .max(86_400_000)
    .default(3_600_000),
  DISTRIBUTED_LEASE_TTL_MS: Joi.number()
    .integer()
    .min(10_000)
    .max(300_000)
    .default(75_000),
  DISTRIBUTED_LEASE_ACQUIRE_TIMEOUT_MS: Joi.number()
    .integer()
    .min(0)
    .max(10_000)
    .default(1_500),
  DISTRIBUTED_LEASE_RETRY_MS: Joi.number()
    .integer()
    .min(25)
    .max(1_000)
    .default(75),
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
  // Signature des medias prives. Absente, elle est derivee de JWT_SECRET par
  // separation de domaine : aucun changement de deploiement n'est requis.
  MEDIA_URL_SECRET: Joi.string().min(32).optional(),
  MEDIA_URL_TTL_MS: Joi.number()
    .integer()
    .min(60_000)
    .max(2_592_000_000)
    .default(604_800_000),
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
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').optional(),
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
  RUDOLF_DAILY_LIMIT: Joi.number().integer().min(1).max(10_000).default(100),
}).custom((environment: Record<string, unknown>, helpers) => {
  if (
    environment.NODE_ENV === 'production' &&
    Number(environment.WEB_CONCURRENCY ?? 2) > 1 &&
    environment.CLUSTER_SECURITY_READY !== true
  ) {
    return helpers.error('any.custom', {
      message:
        'CLUSTER_SECURITY_READY must be true before enabling multiple production workers',
    });
  }

  const probeInterval = Number(
    environment.READINESS_PROBE_INTERVAL_MS ?? 2_000,
  );
  const probeTimeout = Number(environment.READINESS_PROBE_TIMEOUT_MS ?? 1_500);
  if (probeTimeout >= probeInterval) {
    return helpers.error('any.custom', {
      message:
        'READINESS_PROBE_TIMEOUT_MS must be shorter than READINESS_PROBE_INTERVAL_MS',
    });
  }

  const providerTimeout = Number(environment.GROQ_TIMEOUT_MS ?? 30_000);
  const leaseTtl = Number(environment.DISTRIBUTED_LEASE_TTL_MS ?? 75_000);
  if (leaseTtl < providerTimeout + 5_000) {
    return helpers.error('any.custom', {
      message:
        'DISTRIBUTED_LEASE_TTL_MS must exceed GROQ_TIMEOUT_MS by at least 5000 ms',
    });
  }
  return environment;
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [configuration],
      validationSchema: environmentValidationSchema,
    }),
  ],
})
export class AppConfigModule {}
