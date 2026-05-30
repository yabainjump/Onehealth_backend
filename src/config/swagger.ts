import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService,
): void {
  const swaggerEnabledRaw =
    configService.get<boolean | string>('SWAGGER_ENABLED') ??
    configService.get<boolean | string>('swaggerEnabled') ??
    true;
  const swaggerEnabled =
    typeof swaggerEnabledRaw === 'boolean'
      ? swaggerEnabledRaw
      : `${swaggerEnabledRaw}`.toLowerCase() === 'true';

  if (!swaggerEnabled) {
    return;
  }

  const siteName = configService.get<string>('SITE_NAME') ?? 'One Health Network';
  const swaggerTitle =
    configService.get<string>('SWAGGER_TITLE') ?? `${siteName} API`;
  const swaggerDescription =
    configService.get<string>('SWAGGER_DESCRIPTION') ??
    'REST API documentation for One Health Network.';
  const swaggerVersion = configService.get<string>('SWAGGER_VERSION') ?? '1.0.0';
  const swaggerPath = (configService.get<string>('SWAGGER_PATH') ?? 'api/docs')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  const config = new DocumentBuilder()
    .setTitle(swaggerTitle)
    .setDescription(swaggerDescription)
    .setVersion(swaggerVersion)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT access token',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(swaggerPath, app, document, {
    customSiteTitle: `${swaggerTitle} - Swagger`,
    jsonDocumentUrl: `${swaggerPath}-json`,
    swaggerOptions: {
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
