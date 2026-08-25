import { hostname } from 'node:os';

const numberFromEnvironment = (name: string, fallback: number): number =>
  Number(process.env[name] ?? fallback);

const resolveInstanceId = (): string => {
  const configured = process.env.INSTANCE_ID?.trim();
  const processSlot = process.env.NODE_APP_INSTANCE?.trim() || `${process.pid}`;
  if (configured) return `${configured}-${processSlot}`.slice(0, 96);

  return `${hostname()}-${processSlot}`.slice(0, 96);
};

export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: numberFromEnvironment('PORT', 3000),
  mongodbUri: process.env.MONGODB_URI,
  mongodbDbName: process.env.MONGODB_DB_NAME ?? 'onehealth',
  mongodbMaxPoolSize: numberFromEnvironment('MONGODB_MAX_POOL_SIZE', 10),
  hubMongodbUri: process.env.HUB_MONGODB_URI || process.env.MONGODB_URI,
  hubMongodbDbName: process.env.HUB_MONGODB_DB_NAME ?? 'onehealth_hub',
  hubMongodbMaxPoolSize: numberFromEnvironment('HUB_MONGODB_MAX_POOL_SIZE', 10),
  webConcurrency: numberFromEnvironment('WEB_CONCURRENCY', 2),
  clusterSecurityReady:
    (process.env.CLUSTER_SECURITY_READY ?? 'false').toLowerCase() === 'true',
  instanceId: resolveInstanceId(),
  trustedProxyHops: numberFromEnvironment('TRUSTED_PROXY_HOPS', 1),
  shutdownTimeoutMs: numberFromEnvironment('SHUTDOWN_TIMEOUT_MS', 15_000),
  readinessProbeIntervalMs: numberFromEnvironment(
    'READINESS_PROBE_INTERVAL_MS',
    2_000,
  ),
  readinessProbeTimeoutMs: numberFromEnvironment(
    'READINESS_PROBE_TIMEOUT_MS',
    1_500,
  ),
  readinessFailureThreshold: numberFromEnvironment(
    'READINESS_FAILURE_THRESHOLD',
    3,
  ),
  readinessRetryAfterSeconds: numberFromEnvironment(
    'READINESS_RETRY_AFTER_SECONDS',
    5,
  ),
  rateLimitKeySecret:
    process.env.RATE_LIMIT_KEY_SECRET || process.env.JWT_SECRET || '',
  mediaUrlTtlMs: numberFromEnvironment('MEDIA_URL_TTL_MS', 604_800_000),
  rateLimitCleanupGraceMs: numberFromEnvironment(
    'RATE_LIMIT_CLEANUP_GRACE_MS',
    3_600_000,
  ),
  distributedLeaseTtlMs: numberFromEnvironment(
    'DISTRIBUTED_LEASE_TTL_MS',
    75_000,
  ),
  distributedLeaseAcquireTimeoutMs: numberFromEnvironment(
    'DISTRIBUTED_LEASE_ACQUIRE_TIMEOUT_MS',
    1_500,
  ),
  distributedLeaseRetryMs: numberFromEnvironment(
    'DISTRIBUTED_LEASE_RETRY_MS',
    75,
  ),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  corsOrigin: process.env.CORS_ORIGIN,
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
  uploadsDir: process.env.UPLOADS_DIR ?? '',
  frontendPublicUrl: process.env.FRONTEND_PUBLIC_URL ?? '',
  siteName: process.env.SITE_NAME ?? 'One Health Network',
  siteDefaultDescription:
    process.env.SITE_DEFAULT_DESCRIPTION ??
    'One Health Network réunit les acteurs de la santé humaine, animale, végétale et environnementale : publications, profils professionnels, alertes sanitaires cartographiées, messagerie et Rudolf AI, l’assistant spécialisé One Health.',
  defaultShareImage: process.env.DEFAULT_SHARE_IMAGE ?? '',
  twitterSiteHandle: process.env.TWITTER_SITE_HANDLE ?? '',
  swaggerEnabled:
    (process.env.SWAGGER_ENABLED ?? 'true').toLowerCase() === 'true',
  swaggerPath: process.env.SWAGGER_PATH ?? 'api/docs',
  swaggerTitle: process.env.SWAGGER_TITLE ?? '',
  swaggerDescription: process.env.SWAGGER_DESCRIPTION ?? '',
  swaggerVersion: process.env.SWAGGER_VERSION ?? '1.0.0',
  frontendResetPasswordUrl: process.env.FRONTEND_RESET_PASSWORD_URL ?? '',
  resetPasswordTokenTtlMinutes: Number(
    process.env.RESET_PASSWORD_TOKEN_TTL_MINUTES ?? 30,
  ),
  exposeResetTokenForDebug:
    (process.env.EXPOSE_RESET_TOKEN_FOR_DEBUG ?? 'false').toLowerCase() ===
    'true',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  mailFrom: process.env.MAIL_FROM ?? '',
});
