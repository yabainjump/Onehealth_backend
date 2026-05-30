export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  corsOrigin: process.env.CORS_ORIGIN,
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
  frontendPublicUrl: process.env.FRONTEND_PUBLIC_URL ?? '',
  siteName: process.env.SITE_NAME ?? 'One Health Network',
  siteDefaultDescription:
    process.env.SITE_DEFAULT_DESCRIPTION ??
    'A global collaboration network for human, animal, and environmental health.',
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
});
