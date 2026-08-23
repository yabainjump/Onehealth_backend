# Validation US1 — continuité PM2

Date : 2026-08-23

## Vérifications locales terminées

| Contrôle | Résultat |
|---|---|
| ESLint sans correction implicite | PASS |
| Build NestJS | PASS |
| Tests lifecycle/readiness/health | PASS — 10 tests |
| Suite unitaire complète | PASS — 39 suites, 132 tests |
| Suite e2e | PASS — 1 suite, 3 tests |
| Invariants PM2 (2 workers, cluster, wait-ready, drain borné, autorestart) | PASS |
| Refus du vérificateur destructif sans phrase de confirmation | PASS |
| Syntaxe des deux scripts Bash via Git Bash | PASS |
| Absence de documentation d'ingénierie dans `dist/` | PASS |
| Audit npm des dépendances de production | PASS — 0 vulnérabilité |

## Déploiement pilote observé

| Contrôle | Résultat |
|---|---|
| Révision promue | PASS — `7c6b239a510f03a140b7a7cbbc06aea110e22802` |
| Topologie PM2 | PASS — 2 processus `online`, mode `cluster` |
| Readiness publique | PASS — HTTP 200 |
| Base principale | PASS — `up` |
| Base Hub | PASS — `up` |
| Stockage média partagé | PASS — `up` |
| Répartition sur connexions concurrentes | PASS — worker 0 : 27, worker 1 : 13 sur 40 requêtes |

## Exercice externe restant

L'exercice de perte réelle d'un processus et les dix rechargements successifs n'a pas encore été
lancé. La tâche T023 reste donc ouverte. Le script `npm run verify:cluster-continuity` refuse de
s'exécuter sans `CLUSTER_VERIFY_CONFIRM=RUN_DISPOSABLE_CLUSTER_TEST` et refuse la production sans
autorisation supplémentaire explicite.

Une première exécution contrôlée a été interrompue manuellement pendant les rechargements, faute
d'indication de progression. Pendant cet essai, les compteurs PM2 ont progressé, un worker est resté
`online` et les readiness locale et publique ont continué à répondre HTTP 200. Le vérificateur affiche
désormais le début et la fin de chaque étape ; cet essai partiel ne clôt pas T023.

Apache/cPanel `2.4.68` reste le frontal TLS propriétaire des ports 80/443. Nginx `1.14.1` est installé
mais volontairement inactif et ne doit pas être démarré pendant ce pilote.

La barrière `CLUSTER_SECURITY_READY=true` a été levée après branchement des quotas et verrous sur les
primitives MongoDB partagées. Le pilote à deux workers est actif ; les exercices externes T023 et
T040 restent nécessaires avant de déclarer la validation opérationnelle complète.
