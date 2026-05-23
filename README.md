# OneHealth Backend (NestJS + MongoDB)

Backend API NestJS prêt production pour OneHealth avec MongoDB (Mongoose), authentification JWT, validation globale, CORS, modules posts et chat.

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
- `JWT_SECRET`: secret JWT (minimum 16 chars)
- `JWT_EXPIRES_IN`: durée token access (ex: `1h`, `15m`)
- `CORS_ORIGIN`: origines autorisées séparées par virgules

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
- `npm run lint`: lint ESLint (avec fix)
- `npm run test`: tests unitaires
- `npm run test:e2e`: smoke test e2e
- `npm run migrate:firestore`: migre Firestore (`user`, `posts`, `chatRooms`, `chats/*/messages`) vers MongoDB
- `npm run migrate:auth`: importe le JSON `firebase auth:export` vers MongoDB
- `npm run export:auth:service`: exporte Firebase Auth vers JSON via service account (sans `firebase login`)
- `npm run migrate:auth:service`: export Auth via service account puis import MongoDB
- `npm run migrate:firebase`: lance `migrate:firestore` puis `migrate:auth`

## Migration Firebase vers MongoDB (pas à pas)

1. Exporter les utilisateurs Firebase Auth:

```bash
firebase auth:export .\exports\firebase-auth-users.json --format=json
```

2. Exporter/placer la clé de service Firebase Admin:

- Créer un service account dans Firebase Console -> Project Settings -> Service Accounts
- Télécharger le JSON et le placer, par exemple: `.\secrets\firebase-service-account.json`

3. Configurer `.env` (voir `.env.example`) avec:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_AUTH_EXPORT_PATH`

4. Lancer la migration Firestore -> MongoDB:

```bash
npm run migrate:firestore
```

5. Lancer l'import Firebase Auth -> MongoDB:

```bash
npm run migrate:auth
```

6. (Optionnel) Lancer les deux en une seule commande:

```bash
npm run migrate:firebase
```

Important:
- Les hash de mots de passe Firebase ne sont pas compatibles directement avec `bcrypt` (NestJS).
- Après migration, forcer un reset de mot de passe côté OneHealth pour tous les comptes importés.

### Alternative si `firebase auth:export` retourne 401

Si Firebase CLI retourne une erreur `401 invalid authentication credentials`, utiliser la voie service account:

```bash
npm run export:auth:service
npm run migrate:auth
```

ou en une commande:

```bash
npm run migrate:auth:service
```

## Endpoints

### Health

- `GET /api/health`
  - Réponse: `{ status: "ok", timestamp: "..." }`

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
```

## Notes production

- Générer un `JWT_SECRET` robuste (32+ chars recommandé).
- Mettre `NODE_ENV=production` en prod.
- Restreindre `CORS_ORIGIN` aux domaines frontend réels.
- Ajouter rate limiting + helmet + logging structuré selon besoin.
