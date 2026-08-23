# Feature Specification: Backend Load Balancing

**Feature Branch**: `001-backend-load-balancing`

**Created**: 2026-08-23

**Status**: Draft

**Input**: User description: "Rendre le backend commun de One Health Network capable de répartir la charge entre plusieurs instances sans compromettre la sécurité, Rudolf, les médias, la souveraineté ou la continuité de service."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Continuité pendant un déploiement (Priority: P1)

En tant qu'utilisateur de l'application communautaire ou du Dashboard CEEAC, je continue à
consulter et modifier les données auxquelles j'ai droit pendant une mise à jour planifiée ou la
perte d'un processus applicatif sain jusque-là.

**Why this priority**: Le backend est partagé par les deux produits. Une coupure rend simultanément
indisponibles l'authentification, les profils, les publications, les alertes et le Hub.

**Independent Test**: Démarrer au moins deux instances, maintenir un trafic représentatif, retirer
une instance puis déployer une nouvelle version ; les parcours déjà autorisés restent disponibles et
les écritures confirmées ne sont ni perdues ni dupliquées.

**Acceptance Scenarios**:

1. **Given** plusieurs instances saines servent le trafic, **When** une instance est arrêtée, **Then** les nouvelles requêtes sont prises en charge par les instances restantes sans intervention utilisateur.
2. **Given** une nouvelle version validée est prête, **When** l'opérateur déclenche le déploiement, **Then** les instances sont remplacées progressivement et au moins une instance prête reste disponible.
3. **Given** une requête d'écriture est en cours, **When** l'instance commence son arrêt, **Then** la requête obtient une réponse cohérente ou un échec explicite et elle n'est pas rejouée silencieusement.

---

### User Story 2 - Sécurité cohérente entre instances (Priority: P1)

En tant que responsable sécurité, je veux que les limites de connexion, d'upload et d'utilisation de
Rudolf s'appliquent globalement afin qu'un utilisateur ne puisse pas les contourner en étant dirigé
vers une autre instance.

**Why this priority**: Des compteurs isolés multiplient les tentatives autorisées, affaiblissent la
protection des comptes et peuvent provoquer une dépense Groq incontrôlée.

**Independent Test**: Distribuer les tentatives d'un même utilisateur ou client entre plusieurs
instances et vérifier que le plafond global, la fenêtre et le délai de réessai restent identiques à
ceux d'une seule instance.

**Acceptance Scenarios**:

1. **Given** un client approche la limite de connexion, **When** ses requêtes suivantes atteignent des instances différentes, **Then** le plafond global est appliqué une seule fois pour la même fenêtre.
2. **Given** un utilisateur a atteint son quota Rudolf, **When** il renouvelle la demande via une autre instance, **Then** la demande est refusée avec le même délai de réessai.
3. **Given** le stockage partagé des quotas est momentanément indisponible, **When** une action sensible est demandée, **Then** le système adopte une politique de protection explicite et observable plutôt qu'une autorisation illimitée.

---

### User Story 3 - Conversations et médias cohérents (Priority: P2)

En tant que membre, je veux retrouver mes images et recevoir les réponses Rudolf dans le bon ordre,
quelle que soit l'instance ayant traité chacune de mes requêtes.

**Why this priority**: Une répartition de charge incorrecte peut rendre un fichier introuvable ou
produire deux réponses simultanées et contradictoires dans la même conversation.

**Independent Test**: Envoyer un média, le lire via une autre instance, puis envoyer deux questions
concurrentes dans une même conversation ; le média reste accessible et les réponses sont sérialisées
sans doublon.

**Acceptance Scenarios**:

1. **Given** un média a été accepté par une instance, **When** une autre instance sert le profil, la publication ou le message, **Then** le même média est disponible avec ses contrôles d'accès habituels.
2. **Given** une génération Rudolf est active pour une conversation, **When** une deuxième demande arrive sur une autre instance, **Then** elle est mise en attente ou refusée de manière déterministe et ne produit pas une écriture concurrente.
3. **Given** un traitement externe expire, **When** le système rend la main, **Then** les autres modules restent disponibles et la conversation ne conserve pas de verrou orphelin permanent.

---

### User Story 4 - Exploitation observable et réversible (Priority: P2)

En tant qu'opérateur, je veux distinguer une instance vivante d'une instance réellement prête, suivre
les erreurs par requête et revenir à la version précédente si le déploiement échoue.

**Why this priority**: Répartir le trafic vers une instance non prête propage les pannes. Sans trace
corrélée ni retour arrière, plusieurs instances rendent le diagnostic plus difficile.

**Independent Test**: Simuler une dépendance essentielle indisponible, observer le retrait de
l'instance du trafic, restaurer la dépendance puis exécuter un retour arrière documenté.

**Acceptance Scenarios**:

1. **Given** le processus fonctionne mais une dépendance indispensable ne répond plus, **When** sa disponibilité est vérifiée, **Then** l'instance est vivante mais déclarée non prête à recevoir du trafic.
2. **Given** une requête traverse le répartiteur et le backend, **When** elle échoue, **Then** l'opérateur peut retrouver ses événements à l'aide d'un identifiant de corrélation sans exposer de secret.
3. **Given** la nouvelle version échoue aux vérifications, **When** l'opérateur déclenche le retour arrière, **Then** la dernière version saine reprend le trafic selon une procédure reproductible.

### Edge Cases

- Une instance s'arrête pendant un upload ou une réponse Rudolf longue.
- Deux instances essaient d'acquérir simultanément le même verrou de conversation.
- Le propriétaire d'un verrou tombe avant de le libérer.
- L'horloge de deux hôtes diffère pendant le calcul d'une fenêtre de quota.
- Le stockage partagé des quotas est lent, indisponible ou redémarre.
- Une instance est vivante mais n'a pas encore établi ses connexions aux données essentielles.
- Une dépendance facultative, comme Rudolf ou l'e-mail, est indisponible tandis que le cœur fonctionne.
- Un client rejoue une écriture après un timeout sans savoir si la première a abouti.
- Un droit Hub est révoqué entre deux requêtes servies par des instances différentes.
- Un média historique utilise une URL locale, Google ou Firebase.
- Toutes les instances applicatives sont saines mais le serveur hôte tombe entièrement.
- Le répartiteur transmet plusieurs en-têtes d'adresse client ou une chaîne de proxies inattendue.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST répartir les requêtes des deux applications entre au moins deux instances prêtes sans exiger de modification des parcours utilisateur existants.
- **FR-002**: Le système MUST retirer du trafic une instance arrêtée ou déclarée non prête, même si son processus répond encore, et MUST permettre son retour seulement après une vérification réussie.
- **FR-003**: Un déploiement planifié MUST remplacer les instances progressivement en maintenant une capacité prête pendant toute la transition.
- **FR-004**: Une instance qui s'arrête MUST cesser d'accepter de nouvelles requêtes et accorder une durée bornée aux requêtes en cours avant sa terminaison.
- **FR-005**: Les quotas de connexion, inscription, réinitialisation de mot de passe, upload et Rudolf MUST être calculés sur un état commun à toutes les instances.
- **FR-006**: Une indisponibilité du mécanisme global de quota MUST produire une politique explicite, sécurisée, mesurable et distincte selon la sensibilité de l'opération.
- **FR-007**: Une seule génération Rudolf par conversation MUST pouvoir modifier l'historique à un instant donné, même lorsque les demandes atteignent des instances différentes.
- **FR-008**: Tout verrou distribué MUST avoir un propriétaire, une expiration bornée et une libération sûre qui ne supprime pas le verrou d'un autre propriétaire.
- **FR-009**: Un média accepté MUST être lisible indépendamment de l'instance qui traite la requête ultérieure.
- **FR-010**: Les contrôles d'identité, de rôle, de pays et de souveraineté MUST être réévalués par chaque instance pour chaque requête protégée.
- **FR-011**: Le système MUST exposer séparément l'état vivant du processus et son aptitude réelle à recevoir du trafic.
- **FR-012**: L'aptitude à recevoir du trafic MUST dépendre des services indispensables et MUST distinguer les fournisseurs facultatifs dégradés.
- **FR-013**: Chaque requête MUST disposer d'un identifiant de corrélation sûr, repris dans la réponse et dans les journaux structurés sans secret ni donnée sensible inutile.
- **FR-014**: Le répartiteur, le gestionnaire de processus et le déploiement MUST NOT rejouer automatiquement une requête HTTP non idempotente interrompue ; une écriture confirmée ne doit jamais être réémise par l'infrastructure et une écriture dont l'issue est inconnue doit produire un échec explicite que le client peut traiter.
- **FR-015**: Le déploiement MUST vérifier la santé, la configuration, l'accès public et le retour arrière avant de déclarer la nouvelle version réussie.
- **FR-016**: La première livraison MUST documenter clairement qu'elle protège contre la perte d'un processus, mais pas contre la perte complète de l'hôte unique.
- **FR-017**: Le passage ultérieur à plusieurs hôtes MUST être bloqué tant que les médias, quotas, verrous et dépendances de données ne sont pas réellement partagés ou redondants.
- **FR-018**: La chaîne de proxies de confiance MUST être explicitement configurée afin que l'adresse client utilisée pour la sécurité ne puisse pas être falsifiée.
- **FR-019**: Aucun changement de cette fonctionnalité MUST élargir un périmètre pays, fusionner les bases logiques communauté/Hub ou rendre Rudolf décisionnaire.
- **FR-020**: Les fichiers de gouvernance et de développement Spec Kit MUST être versionnés avec le code source, mais MUST NOT être copiés dans l'artefact exécutable, servis par une route publique ou requis au démarrage de production.

### Key Entities

- **État de disponibilité d'instance**: identité d'instance, version en cours, état vivant, état prêt, dépendances essentielles, dépendances dégradées et date de dernière vérification.
- **Quota partagé**: catégorie protégée, sujet limité, fenêtre, consommation, expiration et délai de réessai, sans conserver de secret ou de donnée personnelle superflue.
- **Bail d'opération exclusive**: ressource protégée, propriétaire unique, instant d'acquisition, expiration et résultat de libération.
- **Contexte de corrélation**: identifiant non sensible qui relie la requête publique, l'instance, les journaux et l'éventuelle erreur.
- **Résultat de déploiement**: version candidate, instances remplacées, contrôles exécutés, décision de promotion ou retour arrière et horodatage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Lors de 10 déploiements progressifs consécutifs sous trafic de test, au moins 99,9 % des requêtes ordinaires obtiennent une réponse et aucune écriture confirmée n'est dupliquée.
- **SC-002**: Après la perte d'une instance, les nouveaux parcours utilisateur réussissent via une instance restante en moins de 10 secondes.
- **SC-003**: Dans 100 % des tests répartis entre instances, les limites de sécurité et Rudolf ne permettent pas une tentative supplémentaire par rapport au plafond global configuré.
- **SC-004**: Dans 100 % des tests de concurrence d'une même conversation, une seule génération Rudolf écrit à la fois et aucun verrou ne reste actif au-delà de son expiration prévue.
- **SC-005**: Dans 100 % d'un échantillon de médias nouveaux et historiques, le contenu reste lisible lorsque l'instance de lecture diffère de celle ayant traité l'enregistrement.
- **SC-006**: Une instance non prête est exclue des nouvelles requêtes en moins de 10 secondes et n'est réadmise qu'après réussite des contrôles essentiels.
- **SC-007**: Pour chaque erreur d'un scénario de validation, un opérateur retrouve la trace corrélée en moins de 5 minutes sans trouver de jeton, clé ou mot de passe dans les journaux.
- **SC-008**: Le retour à la dernière version saine est exécutable à partir de la procédure documentée en moins de 15 minutes lors d'un exercice contrôlé.
- **SC-009**: Les parcours de souveraineté et d'autorisation existants réussissent sans régression pour tous les rôles Hub testés lorsque les requêtes alternent entre instances.
- **SC-010**: Pendant un test pilote de 10 minutes avec 20 clients concurrents et une répartition documentée de lectures et d'écritures ordinaires, 95 % des réponses terminent en moins de 2 secondes, hors upload, génération IA et export volumineux.
- **SC-011**: Après chaque build de production, aucun chemin `.specify`, `.agents`, `specs` ou `project-docs` n'existe sous `dist/`, et aucun de ces fichiers n'est accessible par HTTP.

## Assumptions

- Le premier incrément améliore la continuité pendant la perte d'un processus et les déploiements ; la haute disponibilité face à la perte complète du serveur appartient à un incrément ultérieur.
- Les interfaces, mécanismes d'authentification, rôles et modèles métier existants restent compatibles avec les deux frontends.
- Les deux espaces de données logiques restent les sources de vérité métier et sont accessibles à chaque instance.
- Le trafic pilote permet de commencer avec deux instances et des objectifs vérifiés par test de charge avant d'augmenter leur nombre.
- Le déploiement multi-hôte futur nécessitera un accord explicite sur le stockage partagé, la redondance des données, les coûts et la résidence géographique.
- Les opérations externes facultatives peuvent signaler un état dégradé sans rendre indisponibles l'authentification et les données principales.
- Les spécifications et instructions d'agents sont conservées dans GitHub pour la traçabilité, tandis que le processus de production exécute uniquement le code compilé et ses dépendances d'exécution.

## Out of Scope

- Garantir la continuité après la perte complète du serveur physique dans le premier incrément.
- Découper le backend en plusieurs services déployés séparément ou introduire une plateforme d'orchestration.
- Modifier les fonctionnalités visibles des applications Angular/Ionic.
- Migrer MongoDB vers SQL ou modifier la séparation logique entre communauté et Hub.
- Ajouter des WebSockets au chat dans le cadre de cette fonctionnalité.
- Définir une réplication géographique institutionnelle avant validation des contraintes de souveraineté.
