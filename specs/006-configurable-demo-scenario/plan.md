# Plan et Constitution Check

1. Ajouter un DTO borné et une validation métier stricte pays/date.
2. Généraliser la fabrique de données simulées aux onze États CEEAC tout en
   conservant le scénario historique par défaut.
3. Persister un instantané additif de la configuration dans l’exécution et
   l’exposer dans l’état, le rapport et les audits.
4. Ajouter au dashboard un formulaire responsive avant le modal d’exécution.
5. Couvrir les validations, la déterminisme et la compatibilité par des tests,
   puis exécuter lint, tests et builds.

## Constitution Check

- `HubAdminGuard` reste l’autorité d’accès et le backend revalide tous les champs.
- Les pays sont limités à la liste CEEAC et les périodes à 90 jours non futurs.
- Les données produites conservent `isDemo/simulated: true`; le rapport conserve
  `official: false` et aucune transition d’alerte n’est appelée.
- Les politiques de partage nationales existantes sont rattachées aux nouvelles
  observations avant toute consolidation.
- Configuration, identifiants sources, observation, signal, événement, rapport
  et acteur sont conservés dans les traces d’audit.
- Le schéma Mongo évolue uniquement par un sous-document optionnel ; aucune
  migration destructive et aucun nouveau datastore.
- Le périmètre reste volontairement simple : deux pays, trois flux obligatoires,
  un seul type d’analyse explicable.

## Risques maîtrisés

- Une période ou un pays forgé est refusé avant toute écriture.
- Une relance de la même combinaison réutilise les identifiants déterministes et
  les upserts existants, au lieu de multiplier les doublons.
- Deux lancements concurrents depuis un même navigateur sont bloqués par l’UI ;
  l’unicité du code scénario protège également la persistance.
