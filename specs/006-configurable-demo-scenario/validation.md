# Validation

## Résultats du 23 septembre 2026

- Backend `npm run lint` : réussi.
- Backend `npm run build` : réussi.
- Backend `npm test -- --runInBand` : 47 suites, 215 tests réussis.
- Tests ciblés scénario après finalisation : 3 suites, 8 tests réussis.
- Dashboard `npm run lint` : réussi.
- Dashboard `npm run build` : réussi.
- Dashboard ChromeHeadless : 66 tests réussis.

Le passage ChromeHeadless a aussi révélé puis permis de corriger le repli plein
écran d’une cible cartographique détachée ; la suite complète est redevenue verte.

## Contrôles attendus

- acceptation d’un scénario valide entre deux États CEEAC ;
- refus d’un pays hors CEEAC, de deux pays identiques, d’une date future, d’une
  période inversée ou supérieure à 90 jours ;
- identifiants déterministes et données toujours marquées comme simulées ;
- configuration présente dans l’état, le rapport et les audits ;
- compatibilité du scénario historique Cameroun–Tchad ;
- formulaire accessible et responsive, sans double soumission ;
- lint, tests et builds backend/dashboard réussis.

## Validation après déploiement

- déployer le backend avant le Dashboard car le corps de `POST /scenario/run` est
  désormais obligatoire ;
- lancer au moins deux combinaisons pays/période avec un compte `hub_admin` ;
- vérifier le rapport, son export HTML, les audits et les marqueurs de simulation ;
- confirmer les refus HTTP 400 pour pays identiques, date future et période > 90 jours.
