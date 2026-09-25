# Scaffolding Specification — modèles, fichiers et dossiers

**Fonction :** instruction exécutable pour un agent chargé de créer ou compléter la structure du projet.  
**Statut :** la majorité de la structure existe déjà ; ne pas la recréer sous de nouveaux noms.

## 1. Prompt à donner à l’agent

> Inspecte les trois dépôts et compare-les à la structure canonique ci-dessous. Crée uniquement les dossiers et fichiers réellement manquants pour la fonctionnalité demandée. Réutilise les modèles existants, respecte les frontières communauté/Hub et ne crée aucun doublon. Un fichier brouillon doit compiler ou être explicitement documentaire ; ne laisse jamais de faux endpoint ou de méthode qui prétend fonctionner. Ajoute des tests minimaux, mets à jour l’architecture et vérifie les builds concernés.

## 2. Règles de création

1. Ne pas créer un nouveau projet Angular/NestJS : les trois applications existent.
2. Ne pas déplacer les dépôts dans un monorepo sans décision explicite.
3. Rechercher le modèle, DTO, service et composant équivalents avant de créer.
4. Créer un dossier par domaine, pas par écran arbitraire.
5. Un contrôleur ne parle pas directement à MongoDB.
6. Un frontend ne contient ni secret ni règle d’autorisation faisant foi.
7. Un modèle Hub reste dans la connexion Mongo nommée `hub`.
8. Un fichier à peine rédigé doit contenir un commentaire `TODO` précis et ne pas être importé dans l’application tant qu’il n’est pas fonctionnel.
9. Git ne conserve pas les dossiers vides. Si un dossier futur doit être matérialisé, créer un `README.md` décrivant son contrat plutôt qu’un `.gitkeep` muet.
10. Ne pas créer toutes les extensions futures d’avance : uniquement la phase autorisée.

## 3. Structure canonique du workspace

```text
One_health2/
├── onehealth_backend/
│   ├── src/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── posts/
│   │   ├── chat/
│   │   ├── alerts/
│   │   ├── notifications/
│   │   ├── certifications/
│   │   ├── admin/
│   │   ├── upload/
│   │   ├── media/
│   │   ├── share/
│   │   ├── rudolf/
│   │   ├── hub/
│   │   ├── mail/
│   │   ├── health/
│   │   ├── common/
│   │   └── config/
│   ├── scripts/
│   ├── contracts/
│   │   └── dashboard-api.openapi.yaml
│   ├── docs/project/         documentation canonique versionnée
│   ├── test/
│   ├── public/
│   └── deploy-onehealth-backend.sh
├── onehealth_dashboard/
│   ├── src/app/
│   │   ├── core/auth/
│   │   ├── core/api/generated/  contrats générés, jamais édités à la main
│   │   ├── core/data/
│   │   ├── core/i18n/
│   │   ├── layout/
│   │   ├── pages/
│   │   └── shared/
│   ├── src/environments/
│   └── deploy-onehealth-dashboard.sh
├── onehealth_frontend/
│   ├── src/app/
│   │   ├── core/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── shared/
│   │   ├── profils/
│   │   └── post-detail/
│   ├── src/environments/
│   ├── src/assets/
│   └── deploy-onehealth-frontend.sh
└── AGENTS.md                 point d'entrée vers la documentation versionnée
```

## 4. Structure canonique d’un module backend

```text
domain/
├── controllers/              # si le domaine possède plusieurs contrôleurs
│   └── domain.controller.ts
├── dto/
│   ├── create-domain.dto.ts
│   ├── update-domain.dto.ts
│   └── list-domain.dto.ts
├── guards/                   # seulement si autorisation spécifique
├── repositories/             # requêtes Mongo complexes et isolées
│   └── domain.repository.ts
├── schemas/
│   └── domain.schema.ts
├── services/
│   └── domain.service.ts
├── domain.module.ts
└── *.spec.ts
```

Pour un petit module, contrôleur/service peuvent rester à la racine du domaine comme dans les modules existants. Ne pas réorganiser mécaniquement tout le backend pour imposer ce modèle.

## 5. Structure canonique d’une fonctionnalité Angular

```text
src/app/
├── core/
│   ├── auth/                 # session, guards, interceptor
│   └── data/                 # API typée, modèles transversaux
├── pages/
│   └── feature/
│       ├── feature.page.ts
│       ├── feature.page.html
│       ├── feature.page.scss
│       └── feature.page.spec.ts
└── shared/
    ├── components/
    ├── directives/
    ├── pipes/
    └── utils/
```

Un élément utilisé par une seule page reste dans son dossier. Il devient `shared` seulement lorsqu’au moins deux consommateurs réels existent.

Les formes réseau viennent de `onehealth_backend/contracts/dashboard-api.openapi.yaml` et sont
générées dans `core/api/generated/`. Les modèles de vue restent écrits à la main lorsqu'ils portent
un état d'interface et non un contrat HTTP.

## 6. Modèles de données existants — ne pas dupliquer

### Communauté

| Modèle | Fichier source | Invariants |
|---|---|---|
| User | `backend/src/users/schemas/user.schema.ts` | email unique, hash non exposé, rôles Hub séparés |
| Post | `backend/src/posts/schemas/post.schema.ts` | auteur, contenu/médias sûrs, interactions |
| Alert | `backend/src/alerts/schemas/alert.schema.ts` | catégorie, localisation, gravité, vérification |
| ChatRoom | `backend/src/chat/schemas/chat-room.schema.ts` | participants autorisés |
| ChatMessage | `backend/src/chat/schemas/chat-message.schema.ts` | salon, expéditeur, texte ou média |
| Notification | `backend/src/notifications/schemas/notification.schema.ts` | destinataire, état lu/non lu |
| CertificationRequest | `backend/src/certifications/schemas/certification-request.schema.ts` | demande et décision administrative |
| RudolfConversation | `backend/src/rudolf/schemas/rudolf-conversation.schema.ts` | propriétaire et messages privés |

### Hub

| Modèle | Fichier source | Invariants |
|---|---|---|
| HubRawRecord | `backend/src/hub/schemas/hub-raw-record.schema.ts` | payload et identité source immuables |
| HubObservation | `backend/src/hub/schemas/hub-observation.schema.ts` | ID canonique, secteur, pays, géométrie, provenance |
| HubEvent | `backend/src/hub/schemas/hub-event.schema.ts` | sources, score, raisons et version de règle |
| HubSignal | `backend/src/hub/schemas/hub-signal.schema.ts` | une observation, état de vérification |
| HubAlert | `backend/src/hub/schemas/hub-alert.schema.ts` | créée seulement après vérification |
| HubAlertReport | `backend/src/hub/schemas/hub-alert-report.schema.ts` | version et workflow humain |
| HubSharingPolicy | `backend/src/hub/schemas/hub-sharing-policy.schema.ts` | propriétaire, partage, pays, rétention |
| HubConnector | `backend/src/hub/schemas/hub-connector.schema.ts` | pays/source et état, sans secret brut |
| HubIngestionRun | `backend/src/hub/schemas/hub-ingestion-run.schema.ts` | volumes, durée et erreur de synchronisation |
| HubScenarioRun | `backend/src/hub/schemas/hub-scenario-run.schema.ts` | scénario, étapes auditables et dernier rapport de simulation non officiel |
| HubAuditLog | `backend/src/hub/schemas/hub-audit-log.schema.ts` | acteur, action, entité, pays et date |

## 7. Structure prévue pour les vrais connecteurs — à créer seulement au démarrage du pilote

```text
onehealth_backend/src/hub/connectors/
├── contracts/
│   ├── hub-source-connector.interface.ts
│   ├── connector-result.interface.ts
│   └── source-record.interface.ts
├── dhis2/
│   ├── dhis2.connector.ts
│   ├── dhis2.mapper.ts
│   └── dhis2.connector.spec.ts
├── aris3/
│   ├── aris3.connector.ts
│   ├── aris3.mapper.ts
│   └── aris3.connector.spec.ts
├── capc-ac/
│   ├── capc-ac.connector.ts
│   ├── capc-ac.mapper.ts
│   └── capc-ac.connector.spec.ts
└── connector-registry.service.ts
```

Contrat minimal futur :

```ts
interface HubSourceConnector {
  readonly sourceSystem: 'DHIS2' | 'ARIS 3' | 'CAPC-AC';
  testConnection(): Promise<ConnectionHealth>;
  fetch(cursor?: string): Promise<ConnectorBatch>;
  normalize(record: SourceRecord): NormalizedObservationInput;
}
```

`NormalizedObservationInput` devra contenir une gravité canonique explicite et la version de la
règle de mapping qui l'a produite. Chaque mapper traduit les codes validés de son institution ; une
valeur absente ou inconnue est rejetée ou mise en quarantaine, jamais remplacée automatiquement par
`low`. La projection vert/orange/rouge appartient ensuite à l'interface et ne modifie pas la donnée
canonique.

Ce code n’est pas créé maintenant car aucune API réelle, authentification institutionnelle ou nomenclature officielle n’a encore été fournie.

## 8. Modèles à ajouter seulement si le besoin est validé

| Besoin | Modèle potentiel | Condition de création |
|---|---|---|
| registre officiel des règles | `HubRuleDefinition` | plusieurs règles approuvées et cycle de version formalisé |
| tâches asynchrones | job BullMQ, pas forcément collection métier | traitement média ou ingestion dépassant la requête HTTP |
| révocation de session | `Session`/`RefreshToken` | politique institutionnelle exigeant révocation immédiate |
| consentement sentinelle | `SentinelConsent` | intégration communautaire autorisée juridiquement |
| registre d’export | `HubExportAudit` ou action audit | besoin officiel de tracer téléchargements et destinataires |
| traitement FFmpeg | `MediaJob` | files, stockage et quotas définis |

Ne pas créer ces modèles pour « prévoir ». Documenter d’abord le cas d’usage, la rétention, le propriétaire et les requêtes attendues.

## 9. Brouillon de fichier acceptable

Un brouillon acceptable :

```ts
/**
 * Draft non enregistré dans un module.
 * TODO: valider le contrat avec l'institution propriétaire avant activation.
 */
export interface ProposedSourceMapping {
  readonly sourceField: string;
  readonly canonicalField: string;
  readonly required: boolean;
}
```

Un faux service qui renvoie silencieusement `[]`, `true` ou des données inventées n’est pas acceptable dans le runtime. Les mocks restent dans `mock/`, `seeds/`, fixtures ou tests et portent explicitement `simulated/isDemo`.

## 10. Checklist d’exécution du scaffold

Utilitaire ajouté par le lot `003-bounded-client-load` :
`onehealth_frontend/src/app/core/utils/foreground-poller.ts`, avec test associé.
Le réutiliser pour les lectures périodiques au premier plan, sans multiplier les
timers permanents. Aucun modèle persistant ni nouvelle infrastructure nécessaire.

- [ ] le dépôt et le domaine corrects sont identifiés ;
- [ ] aucun fichier équivalent n’existe déjà ;
- [ ] le modèle et ses invariants sont documentés ;
- [ ] les DTO bornent toutes les entrées ;
- [ ] les index correspondent aux requêtes ;
- [ ] les rôles et la portée pays sont appliqués serveur ;
- [ ] les états d’erreur et de concurrence sont traités ;
- [ ] le frontend utilise des types API explicites ;
- [ ] les tests minimaux existent ;
- [ ] le build passe ;
- [ ] PRD et architecture sont synchronisés si nécessaire ;
- [ ] aucun secret, donnée réelle ou faux résultat n’a été ajouté.

## 11. Fichiers ajoutés par le lot 004

- Backend : specs/004-server-pagination-load/{spec,plan,tasks,validation}.md.
- Backend : src/hub/dto/list-hub-observations.dto.spec.ts et
  src/hub/repositories/hub-pagination.spec.ts ; DTO/repository/service existants étendus.
- Dashboard : pages/alerts/alert-registry.store.ts et .spec.ts, scope composant.
  Types HubObservationQuery/HubObservationPage/HubSummary dans HubApiService existant.
- Backend : scripts/load/{hub-read.k6.js,hub-load-guard.mjs,hub-load-guard.test.mjs,README.md}.
  Aucun dossier runtime ni modèle vide créé. Scripts de charge hors dist/public.
- Credentials de charge : secrets/ ou *.identities.json ignorés ; résultats locaux
  scripts/load/results/ ignorés. Pas de token d'exemple utilisable dans Git.
