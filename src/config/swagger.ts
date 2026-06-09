import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService,
): void {
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const swaggerEnabledRaw =
    configService.get<boolean | string>('SWAGGER_ENABLED');

  // Defaut SECURISE : si SWAGGER_ENABLED n'est pas defini, la doc est active en
  // developpement mais DESACTIVEE en production (on n'expose pas publiquement le
  // schema complet de l'API). Pour l'activer en prod : SWAGGER_ENABLED=true.
  const swaggerEnabled =
    swaggerEnabledRaw === undefined ||
    swaggerEnabledRaw === null ||
    `${swaggerEnabledRaw}`.trim() === ''
      ? nodeEnv !== 'production'
      : typeof swaggerEnabledRaw === 'boolean'
        ? swaggerEnabledRaw
        : `${swaggerEnabledRaw}`.toLowerCase() === 'true';

  if (!swaggerEnabled) {
    return;
  }

  const siteName = configService.get<string>('SITE_NAME') ?? 'One Health Network';
  const swaggerTitle =
    configService.get<string>('SWAGGER_TITLE') ?? `${siteName} API`;
  const swaggerVersion = configService.get<string>('SWAGGER_VERSION') ?? '1.0.0';
  const swaggerPath = (configService.get<string>('SWAGGER_PATH') ?? 'api/docs')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  const baseDescription =
    configService.get<string>('SWAGGER_DESCRIPTION') ??
    `Documentation de l'API REST de ${siteName}.`;

  const description = [
    baseDescription,
    '',
    '### Authentification',
    'La plupart des endpoints nécessitent un jeton **JWT (Bearer)**.',
    '',
    '1. Appelez **`POST /api/auth/login`** (ou `/api/auth/register`) et copiez le champ **`accessToken`** de la réponse.',
    '2. Cliquez sur **Authorize** 🔓 (en haut à droite) et collez ce jeton.',
    '3. Vos requêtes « Try it out » enverront alors automatiquement l\'en-tête `Authorization: Bearer <token>`.',
    '',
    'ℹ️ Toutes les routes sont préfixées par **`/api`**.',
  ].join('\n');

  const config = new DocumentBuilder()
    .setTitle(swaggerTitle)
    .setDescription(description)
    .setVersion(swaggerVersion)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Collez votre accessToken JWT (sans le préfixe « Bearer »).',
      },
      'access-token',
    )
    .addTag('Auth', 'Inscription, connexion, profil courant, mot de passe oublié / réinitialisé')
    .addTag('Users', 'Profils, recherche d\'utilisateurs, abonnements (follow / unfollow)')
    .addTag('Posts', 'Publications, commentaires et likes')
    .addTag('Chat', 'Salons de discussion et messages')
    .addTag('Upload', 'Téléversement de fichiers (photo de profil, médias de post / message)')
    .addTag('Media', 'Miniatures et posters générés à la volée (WebP / images)')
    .addTag('Share', 'Pages HTML de partage pour les aperçus réseaux sociaux (SSR)')
    .addTag('Health', 'Vérification de disponibilité du service')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(swaggerPath, app, document, {
    customSiteTitle: `${swaggerTitle} — Swagger`,
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
