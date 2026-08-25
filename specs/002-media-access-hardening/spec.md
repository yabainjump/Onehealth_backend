# Feature Specification: Media Access and Session Hardening

**Feature Branch**: `002-media-access-hardening`

**Created**: 2026-08-24

**Status**: Implemented — retroactive specification

**Input**: User description: "Corriger les écarts de confidentialité et de session révélés par l'audit de sécurité des 23–24 août 2026 : pièces jointes de conversations privées lisibles par simple connaissance de l'URL, sessions survivant à une réinitialisation de mot de passe, bourrage d'identifiants réparti sur plusieurs adresses, et médias distants non restreints."

> **Note de traçabilité** : cette spécification est rédigée *après* l'implémentation. Les travaux ont
> été conduits en réponse à un audit de sécurité, hors du cycle spécification → plan → tâches prévu
> par la constitution. Elle rétablit la traçabilité exigée par la clause de gouvernance et documente
> l'écart de procédure plutôt que de le dissimuler. L'écart lui-même est consigné dans
> [plan.md](./plan.md), section « Écarts de gouvernance ».

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Confidentialité des pièces jointes privées (Priority: P1)

En tant que membre échangeant dans une conversation privée, je veux que les fichiers et images que
j'envoie ne soient lisibles que par les participants de cette conversation, et non par toute personne
ayant obtenu l'adresse du fichier.

**Why this priority**: Le réseau transporte des échanges entre professionnels de santé. Une pièce
jointe lisible sans autorisation est une atteinte directe à la confidentialité, et sa récupération
par un tiers permet d'établir qui a consulté quoi et quand.

**Independent Test**: Obtenir l'adresse d'une pièce jointe de conversation, puis la demander sans
être membre de la conversation ; la demande doit être refusée, tandis qu'un membre légitime obtient
le fichier au cours de sa lecture normale.

**Acceptance Scenarios**:

1. **Given** une pièce jointe existe dans une conversation privée, **When** un tiers demande son adresse sans autorisation valide, **Then** la demande est refusée sans révéler l'existence du contenu.
2. **Given** un membre ouvre la conversation, **When** l'application affiche la pièce jointe, **Then** le contenu s'affiche sans action supplémentaire de l'utilisateur.
3. **Given** une autorisation d'accès a été obtenue légitimement, **When** elle est présentée pour un autre fichier ou après son échéance, **Then** la demande est refusée.
4. **Given** une pièce jointe privée existe, **When** un tiers demande sa transformation par le service de vignettes, **Then** la demande est refusée au lieu de produire une copie lisible.
5. **Given** un lien privé valide est utilisé, **When** le fichier est servi, **Then** la réponse interdit sa conservation dans un cache partagé ou navigateur au-delà de l'autorisation.

---

### User Story 2 - Reprise de contrôle d'un compte compromis (Priority: P1)

En tant qu'utilisateur dont le compte a été compromis, je veux que la réinitialisation de mon mot de
passe mette fin immédiatement aux sessions déjà ouvertes, afin que la personne ayant dérobé un accès
ne conserve pas la main.

**Why this priority**: Réinitialiser un mot de passe est le geste de reprise de contrôle attendu par
tout utilisateur. S'il ne ferme pas les sessions actives, il donne une fausse impression de sécurité
pendant toute la durée de validité restante d'un jeton déjà émis.

**Independent Test**: Ouvrir une session, réinitialiser le mot de passe par le circuit normal, puis
réutiliser la session initiale ; elle doit être refusée, tandis qu'une nouvelle connexion réussit.

**Acceptance Scenarios**:

1. **Given** une session est ouverte, **When** le mot de passe du compte est réinitialisé, **Then** la session antérieure est refusée à sa requête suivante.
2. **Given** le mot de passe vient d'être réinitialisé, **When** l'utilisateur se reconnecte, **Then** sa nouvelle session fonctionne normalement.
3. **Given** aucun changement de mot de passe n'a jamais eu lieu, **When** une session valide est utilisée, **Then** elle reste acceptée sans changement de comportement.

---

### User Story 3 - Résistance au bourrage d'identifiants réparti (Priority: P2)

En tant que responsable sécurité, je veux qu'un attaquant répartissant ses tentatives sur de
nombreuses adresses ne puisse pas essayer indéfiniment les mots de passe d'un compte donné, sans pour
autant qu'un tiers puisse verrouiller le compte d'un utilisateur légitime.

**Why this priority**: Le plafond existant s'applique par adresse cliente. Un attaquant disposant de
nombreuses adresses le contourne intégralement. À l'inverse, un plafond par compte mal conçu offre à
n'importe qui un moyen simple de priver un utilisateur de son accès.

**Independent Test**: Enchaîner des échecs de connexion sur un même compte depuis des adresses
différentes jusqu'au plafond, puis présenter le mot de passe correct ; les échecs doivent être
refusés et la connexion légitime doit malgré tout aboutir.

**Acceptance Scenarios**:

1. **Given** un compte cumule des échecs de connexion depuis plusieurs adresses, **When** le plafond de la fenêtre est atteint, **Then** les tentatives erronées suivantes sont refusées avec une réponse distincte d'un simple identifiant invalide.
2. **Given** le plafond d'échecs du compte est atteint, **When** le titulaire présente son mot de passe correct, **Then** la connexion aboutit.
3. **Given** une tentative de connexion réussit, **When** elle est traitée, **Then** elle ne consomme aucune part du plafond d'échecs.

---

### User Story 4 - Médias distants maîtrisés (Priority: P2)

En tant que membre affichant le profil ou le message d'un autre utilisateur, je veux que mon
navigateur ne contacte pas un serveur tiers choisi par cet utilisateur.

**Why this priority**: Une adresse de média librement choisie transforme chaque affichage en balise
de pistage : le serveur distant récolte adresse réseau, navigateur et horodatage de chaque personne
qui consulte le contenu. Dans une conversation privée, cela équivaut à un accusé de lecture
clandestin. La constitution exige déjà une liste d'autorisation explicite pour les adresses de média ;
l'implémentation ne la respectait pas.

**Independent Test**: Soumettre une adresse de média pointant vers un hôte non autorisé sur chaque
champ acceptant un média ; la valeur doit être refusée à la validation.

**Acceptance Scenarios**:

1. **Given** un champ accepte une adresse de média, **When** la valeur désigne un hôte hors de la liste d'autorisation, **Then** la valeur est refusée.
2. **Given** un hôte imite un domaine autorisé par suffixe trompeur, **When** la valeur est soumise, **Then** elle est refusée.
3. **Given** un média provient d'une origine légitime du produit, **When** la valeur est soumise, **Then** elle est acceptée sans changement pour l'utilisateur.

---

### Edge Cases

- Une autorisation d'accès média est présentée deux fois pour le même fichier, l'application ayant renvoyé au serveur l'adresse qu'elle avait reçue.
- Un client déjà ouvert détient des adresses obtenues avant la mise en service du contrôle.
- Une pièce jointe est demandée avec une variation de casse ou une barre oblique supplémentaire dans son chemin.
- Un jeton de session ne porte pas de date d'émission exploitable.
- Le mécanisme de quota partagé est indisponible au moment d'un échec de connexion.
- Un compte historique porte une adresse de photo hébergée sur un hôte que le produit n'a jamais utilisé.
- Deux instances traitent respectivement l'émission et la vérification d'une même autorisation d'accès.
- Une variante de casse ou de forme du chemin d'une route soumise à quota atteint le contrôleur.
- Un chemin HTTP contient un encodage pourcent invalide et ne peut pas être décodé sans erreur.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Un média rattaché à une conversation privée MUST NOT être lisible sans autorisation d'accès valide, quelle que soit la connaissance de son adresse.
- **FR-002**: L'autorisation d'accès à un média privé MUST être limitée dans le temps et MUST couvrir le fichier désigné, de sorte qu'elle ne puisse être transposée à un autre fichier ni prolongée après émission.
- **FR-003**: L'autorisation d'accès MUST être émise par le serveur au moment où un utilisateur autorisé consulte la conversation, sans exiger de modification des applications clientes.
- **FR-004**: Les services de transformation d'image MUST refuser les médias privés, afin de ne pas produire une copie lisible d'un contenu protégé par ailleurs.
- **FR-005**: L'émission répétée d'une autorisation pour un même média MUST rester sans effet cumulatif, l'adresse renvoyée demeurant vérifiable.
- **FR-006**: Les médias destinés à un usage public MUST rester accessibles sans autorisation, afin de ne pas rompre les aperçus de partage et les visionneuses de documents existantes.
- **FR-007**: Une réinitialisation de mot de passe MUST rendre inutilisables les sessions établies avant elle.
- **FR-008**: Une session dont la date d'émission ne peut être établie MUST être refusée dès lors qu'un changement de mot de passe est enregistré pour le compte.
- **FR-009**: Les échecs de connexion MUST être comptabilisés par compte visé, indépendamment de l'adresse cliente, sur un état commun à toutes les instances.
- **FR-010**: Une authentification réussie MUST NOT être refusée en raison du plafond d'échecs, et MUST NOT le consommer.
- **FR-011**: Toute adresse de média fournie par un utilisateur MUST être restreinte à une liste d'hôtes explicitement autorisés, et MUST refuser un hôte imitant un domaine autorisé par suffixe.
- **FR-012**: Le comptage des variantes équivalentes d'une route protégée par quota MUST être identique, de sorte qu'une variation de casse, une barre oblique finale ou un segment neutre ne contourne pas le plafond.
- **FR-013**: Les paramètres de pagination MUST être bornés à la fois par le bas et par le haut.
- **FR-014**: Une valeur sérialisée dans un script généré côté serveur MUST NOT pouvoir clore la balise qui la contient.
- **FR-015**: Le secret d'autorisation des médias MUST provenir de l'environnement, MUST être identique pour toutes les instances et MUST NOT être exigé au démarrage, une dérivation par séparation de domaine étant admise à défaut.
- **FR-016**: Aucun changement de cette fonctionnalité MUST élargir un périmètre pays, modifier une transition de cycle de vie sanitaire, ni rendre Rudolf décisionnaire.
- **FR-017**: Une réponse contenant un média privé MUST interdire son stockage en cache, tandis que les médias publics MUST conserver leur politique de cache performante.
- **FR-018**: Un chemin HTTP dont l'encodage est invalide MUST produire une réponse contrôlée `400` et MUST NOT provoquer une erreur serveur non gérée.

### Key Entities

- **Autorisation d'accès média**: chemin du fichier concerné, échéance et preuve d'intégrité, sans identité d'utilisateur ni donnée personnelle.
- **Marque de changement de mot de passe**: date du dernier changement, attachée au compte, comparée à la date d'émission de chaque session.
- **Quota d'échecs par compte**: compte visé sous forme pseudonymisée, fenêtre, consommation et délai de réessai, dans le mécanisme partagé existant.
- **Liste d'hôtes média autorisés**: origines propres du produit issues de la configuration, plus les fournisseurs d'avatar historiques explicitement nommés.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dans 100 % des tentatives d'accès à une pièce jointe privée sans autorisation valide, périmée, ou transposée à un autre fichier, la demande est refusée.
- **SC-002**: Dans 100 % des lectures de conversation par un membre légitime, les pièces jointes restent affichées sans action supplémentaire.
- **SC-003**: Dans 100 % des demandes de transformation d'image visant un média privé, la demande est refusée.
- **SC-004**: Après réinitialisation du mot de passe, 100 % des sessions antérieures sont refusées à leur requête suivante et une reconnexion réussit.
- **SC-005**: Dans 100 % des scénarios de plafond d'échecs atteint, une authentification avec le mot de passe correct aboutit encore.
- **SC-006**: Dans 100 % des soumissions d'adresse de média désignant un hôte non autorisé, y compris les imitations par suffixe, la valeur est refusée.
- **SC-007**: Dans 100 % des variantes équivalentes d'une route soumise à quota, le compteur appliqué est identique à celui de la forme canonique.
- **SC-008**: Une autorisation émise par une instance est acceptée par l'autre instance dans 100 % des vérifications.
- **SC-009**: Le lint, la compilation et l'intégralité des tests automatisés du dépôt passent après la modification.
- **SC-010**: Dans 100 % des réponses réussies de média privé, `Cache-Control` interdit le stockage ; un média public conserve le cache statique existant.
- **SC-011**: Dans 100 % des requêtes portant un encodage de chemin invalide, le serveur répond `400` sans interrompre le processus.

## Assumptions

- Les applications clientes affichent l'adresse de média telle que l'API la renvoie, sans la reconstruire, ce qui permet d'introduire l'autorisation sans modification cliente.
- Les dossiers de médias publics (profil, publication) doivent le rester : ils alimentent les aperçus sociaux et les visionneuses de documents externes.
- Les comptes existants portent des adresses de photo issues des origines du produit ou des fournisseurs d'avatar historiques nommés dans la liste d'autorisation.
- Une session fermée par réinitialisation est reconstituée par une nouvelle authentification sans perte de données pour l'utilisateur.
- La durée de validité par défaut d'une autorisation d'accès dépasse largement la durée d'une consultation, les conversations étant rechargées à chaque ouverture.

## Out of Scope

- Le chiffrement de bout en bout des conversations et le chiffrement au repos des médias.
- La restriction des médias de profil et de publication, qui demeurent publics par nécessité fonctionnelle.
- Les modifications des dépôts `onehealth_frontend` et `onehealth_dashboard` conduites en parallèle (durcissement de la politique de sécurité de contenu, verrouillage par tests du rendu de publication, mise à jour du cadre applicatif) : elles relèvent de la gouvernance de leurs dépôts respectifs.
- La révocation individuelle d'une session sans changement de mot de passe.
- Le remplacement du stockage local des médias par un stockage objet, qui reste conditionné au passage multi-hôte de la fonctionnalité 001.
