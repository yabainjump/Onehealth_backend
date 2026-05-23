export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  corsOrigin: process.env.CORS_ORIGIN,
  frontendResetPasswordUrl: process.env.FRONTEND_RESET_PASSWORD_URL ?? '',
  resetPasswordTokenTtlMinutes: Number(
    process.env.RESET_PASSWORD_TOKEN_TTL_MINUTES ?? 30,
  ),
});
