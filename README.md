# OneHealth Backend (NestJS + MongoDB)

Backend API NestJS de One Health Network avec MongoDB, authentification JWT, validation globale et module institutionnel séparé pour le Hub régional CEEAC.

## Stack

- NestJS 11
- MongoDB + Mongoose
- JWT (`@nestjs/jwt` + `passport-jwt`)
- Validation (`class-validator` + `class-transformer`)

## Prérequis

- Node.js 20+
- npm 10+
- MongoDB accessible (local ou distant)

## Setup

1. Installer les dépendances:

```bash
npm install
```

2. Créer le fichier d'environnement:

```bash
cp .env.example .env
```

3. Adapter les variables dans `.env`.

## Variables d'environnement

Voir `.env.example`:

- `NODE_ENV`: `development | production | test`
- `PORT`: port HTTP API
- `MONGODB_URI`: URI MongoDB
- `HUB_MONGODB_URI`: URI facultative du cluster Hub ; si vide, le cluster principal est réutilisé
- `HUB_MONGODB_DB_NAME`: base logique du Hub, `onehealth_hub` par défaut
- `JWT_SECRET`: secret JWT (minimum 32 caractères)
- `JWT_EXPIRES_IN`: durée token access (ex: `1h`, `15m`)
- `CORS_ORIGIN`: origines autorisées séparées par virgules
- `WEB_CONCURRENCY`: fixé à `2` pour le premier cluster validé
- `CLUSTER_SECURITY_READY`: verrou de production ; reste `false` jusqu'aux exercices cluster des
  limites partagées, des médias et du bail Rudolf
- `TRUSTED_PROXY_HOPS`: nombre exact de reverse proxies de confiance (`1` avec Nginx seul)
- `SHUTDOWN_TIMEOUT_MS`: durée maximale de drainage des requêtes
- `READINESS_PROBE_INTERVAL_MS`, `READINESS_PROBE_TIMEOUT_MS` et
  `READINESS_FAILURE_THRESHOLD`: supervision des dépendances essentielles
- `RATE_LIMIT_KEY_SECRET`: clé HMAC distincte du JWT, obligatoire en production
- `UPLOADS_DIR`: chemin absolu, inscriptible et commun aux deux workers en production

## Lancer le backend

```bash
# développement
npm run start:dev

# production (après build)
npm run build
npm run start:prod
```

## Scripts utiles

- `npm run build`: compile TypeScript
- `npm run lint`: contrôle ESLint sans modifier les fichiers
- `npm run lint:fix`: applique explicitement les corrections ESLint sûres
- `npm run test`: tests unitaires
- `npm run test:e2e`: smoke test e2e
- `npm run verify:pm2-config`: vérifie les invariants du cluster à deux workers
- `npm run verify:cluster-continuity`: test destructif réservé à un environnement jetable
- `npm run verify:cluster-security`: contrôle les quotas partagés sur un environnement jetable
- `npm run verify:cluster-media-rudolf`: contrôle deux workers, le média partagé et l'exclusivité
  d'une conversation Rudolf, avec confirmation explicite et nettoyage automatique

## Endpoints

### Health

- `GET /api/health`
- `GET /api/health/live`
  - confirme seulement que le processus HTTP répond
- `GET /api/health/ready`
  - renvoie `200` lorsque MongoDB principal, MongoDB Hub et `UPLOADS_DIR` sont accessibles
  - renvoie `503` et `Retry-After` lorsqu'un worker ne doit pas recevoir de trafic

### Auth

- `POST /api/auth/register`
  - Body:

```json
{
  "username": "johndoe",
  "email": "john.doe@example.com",
  "password": "StrongPass123",
  "firstName": "John",
  "lastName": "Doe",
  "institution": "One Health",
  "typeMedecin": "Generalist",
  "country": "Cameroon",
  "city": "Douala"
}
```

- `POST /api/auth/login`
  - Body:

```json
{
  "email": "john.doe@example.com",
  "password": "StrongPass123"
}
```

- Réponse auth (register/login):

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": "1h",
  "user": {
    "id": "...",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "institution": "One Health",
    "role": "user",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### Users

- `GET /api/users/me` (protégé JWT)
  - Header: `Authorization: Bearer <token>`
  - Réponse: profil utilisateur courant (sans `passwordHash`)
- `PATCH /api/users/me` (protégé JWT)
  - Met à jour le profil utilisateur courant
- `GET /api/users?search=...` (protégé JWT)
  - Liste d'utilisateurs (utile pour démarrer un chat)

### Posts

- `POST /api/posts` (protégé JWT)
- `GET /api/posts` (protégé JWT)
- `GET /api/posts/:postId` (protégé JWT)
- `POST /api/posts/:postId/like` (protégé JWT)
- `POST /api/posts/:postId/comments` (protégé JWT)
- `DELETE /api/posts/:postId` (protégé JWT, auteur uniquement)

### Chat

- `POST /api/chat/rooms` (protégé JWT)
- `GET /api/chat/rooms` (protégé JWT)
- `GET /api/chat/rooms/:roomId/messages` (protégé JWT)
- `POST /api/chat/rooms/:roomId/messages` (protégé JWT)
- `POST /api/chat/rooms/:roomId/read` (protégé JWT)

### Hub régional CEEAC

Le Hub utilise la base logique `onehealth_hub` et ne mélange pas ses collections avec les alertes communautaires de l'application Ionic.

- `GET /api/hub/summary`
- `GET /api/hub/observations`
- `GET /api/hub/observations/:id`
- `GET /api/hub/decisions` — signaux en attente filtrés selon le périmètre pays
- `GET /api/hub/events` — événements consolidés visibles dans le périmètre autorisé
- `GET /api/hub/events/:eventCode` — score, raisons et observations sources autorisées
- `POST /api/hub/events` — consolidation manuelle contrôlée, analyste minimum
- `PATCH /api/hub/signals/:signalCode/assign` — vérificateur uniquement
- `PATCH /api/hub/signals/:signalCode/decision` — vérificateur uniquement, justification obligatoire
- `GET /api/hub/demo/scenario` — état du scénario dynamique, administrateur Hub
- `POST /api/hub/demo/scenario/run` — exécution idempotente du scénario Cameroun–Tchad
- `GET /api/hub/alerts/:observationId/reports` — versions persistantes du rapport
- `POST /api/hub/alerts/:observationId/reports` — génération d'une version, analyste minimum
- `PATCH /api/hub/reports/:reportId/status` — workflow revue, validation et publication selon le rôle
- `POST /api/hub/demo/seed` — administrateur de l'application uniquement
- `PATCH /api/admin/users/:id/hub-access` — attribution des rôles et pays autorisés

Rôles Hub disponibles : `hub_viewer`, `hub_analyst`, `hub_verifier` et `hub_admin`. Sauf pour les administrateurs, les réponses sont filtrées côté backend selon `hubCountryCodes`.

Chargement initial du démonstrateur :

1. Démarrer le backend et se connecter avec un compte administrateur.
2. Ouvrir Swagger sur `http://localhost:3000/api/docs` en développement.
3. Utiliser **Authorize** avec le `accessToken` reçu par `/api/auth/login`.
4. Appeler `POST /api/hub/demo/seed` une seule fois. L'opération est idempotente et peut être répétée sans créer de doublons.
5. Attribuer ensuite les droits Hub aux comptes de démonstration avec `PATCH /api/admin/users/:id/hub-access`.

Le seed crée 165 données brutes, 165 observations normalisées, 15 signaux, 3 alertes vérifiées et 11 politiques de partage. Toutes portent `isDemo: true`.

### Chargement par ligne de commande ou déploiement

Le seed peut être exécuté sans Swagger et sans mot de passe administrateur. La
commande utilise directement les connexions MongoDB définies dans `.env` et
exige une confirmation explicite :

```bash
HUB_DEMO_SEED_CONFIRM=SEED_165_DEMO_RECORDS npm run hub:seed-demo
```

Le déploiement peut aussi l'exécuter après le build et avant le redémarrage
PM2. La valeur par défaut reste `false` pour empêcher toute injection
accidentelle :

```bash
SEED_HUB_DEMO=true bash ~/deploy-onehealth-backend.sh
```

Les écritures sont idempotentes : les 165 observations de référence sont
créées ou restaurées sans doublon. Les quatre observations d'un scénario déjà
exécuté ne sont pas supprimées ; dans ce cas le total visible peut être 169.

Le scénario dynamique crée également un événement consolidé séparé des observations sources. Le moteur `CEEAC-SPATIOTEMPORAL-1.0` calcule un score explicable à partir de la diversité sectorielle, de la fenêtre temporelle, de la distance et du caractère transfrontalier. Un regroupement mono-sectoriel ou insuffisamment corrélé est refusé ; ce score ne valide jamais une alerte.

Avant chaque exécution du scénario, le backend réapplique automatiquement le seed régional idempotent. Le socle de 165 observations est ainsi restauré s'il manque dans la base courante, puis les quatre observations propres au scénario sont ajoutées : le jeu complet contient alors 169 observations, sans doublon.

## Sécurité implémentée (baseline)

- Hash mot de passe avec `bcrypt` (cost factor 12)
- JWT signé avec secret via env
- Guard JWT sur toutes les routes métier (`users`, `posts`, `chat`)
- Validation globale:
  - `whitelist: true`
  - `forbidNonWhitelisted: true`
  - `transform: true`
- CORS configurable via env
- Schéma Mongo:
  - `email` unique
  - `passwordHash` non sélectionné par défaut (`select: false`)
  - `timestamps` automatiques

## Structure backend

```text
src/
  app.module.ts
  main.ts
  config/
    app-config.module.ts
    configuration.ts
  health/
    health.controller.ts
    health.module.ts
  users/
    dto/
      list-users.dto.ts
      update-profile.dto.ts
    interfaces/
      public-user.interface.ts
      request-with-user.interface.ts
    schemas/
      user.schema.ts
    users.controller.ts
    users.module.ts
    users.service.ts
  auth/
    dto/
      login.dto.ts
      register.dto.ts
    guards/
      jwt-auth.guard.ts
    interfaces/
      jwt-payload.interface.ts
    strategies/
      jwt.strategy.ts
    auth.controller.ts
    auth.module.ts
    auth.service.ts
  posts/
    dto/
      add-comment.dto.ts
      create-post.dto.ts
      list-posts.dto.ts
    schemas/
      post.schema.ts
    posts.controller.ts
    posts.module.ts
    posts.service.ts
  chat/
    dto/
      create-room.dto.ts
      list-messages.dto.ts
      send-message.dto.ts
    schemas/
      chat-room.schema.ts
      chat-message.schema.ts
    chat.controller.ts
    chat.module.ts
    chat.service.ts
  hub/
    controllers/
    dto/
    guards/
    repositories/
    schemas/
    seeds/
    services/
    hub.module.ts
```

## Notes production

- Générer un `JWT_SECRET` robuste (32+ chars recommandé).
- Générer un `RATE_LIMIT_KEY_SECRET` différent avec `openssl rand -hex 32`.
- Mettre `NODE_ENV=production` en prod.
- Restreindre `CORS_ORIGIN` aux domaines frontend réels.
- Conserver `INSTANCE_ID` vide ou utiliser une base courte : le slot PM2 est ajouté pour garantir
  l'identité unique de chaque worker.
- La topologie Jenkins → déploiement, Nginx → PM2 → deux workers est documentée dans
  `ops/README.md`. Nginx ne doit pas être activé sur le serveur cPanel/LiteSpeed avant validation des
  ports 80/443 et de l'accès root.
- Cette étape résiste à la perte d'un worker, pas à la perte de l'hôte unique.
