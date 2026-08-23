# Validation US1 — continuité PM2

Date : 2026-08-23

## Vérifications locales terminées

| Contrôle | Résultat |
|---|---|
| ESLint sans correction implicite | PASS |
| Build NestJS | PASS |
| Tests lifecycle/readiness/health | PASS — 10 tests |
| Suite unitaire complète | PASS — 32 suites, 100 tests |
| Suite e2e | PASS — 1 suite, 1 test |
| Invariants PM2 (2 workers, cluster, wait-ready, drain borné, autorestart) | PASS |
| Refus du vérificateur destructif sans phrase de confirmation | PASS |
| Syntaxe des deux scripts Bash via Git Bash | PASS |
| Absence de documentation d'ingénierie dans `dist/` | PASS |
| Audit npm des dépendances de production | PASS — 0 vulnérabilité |

## Exercice externe restant

L'exercice de perte réelle d'un processus et les dix rechargements successifs n'ont pas été lancés
depuis ce poste : ils exigent un environnement jetable avec MongoDB et PM2. La tâche T023 reste donc
ouverte. Le script `npm run verify:cluster-continuity` refuse de s'exécuter sans
`CLUSTER_VERIFY_CONFIRM=RUN_DISPOSABLE_CLUSTER_TEST` et refuse le domaine de production par défaut.

L'activation de Nginx reste également conditionnée à la vérification de l'accès root et de la
propriété des ports 80/443 sur le serveur cPanel/LiteSpeed actuel.

Le déploiement production à deux workers reste bloqué par `CLUSTER_SECURITY_READY=false` jusqu'à la
fin de l'US2. Cette barrière empêche les compteurs locaux actuels de multiplier les quotas pendant
que la prochaine phase branche les adaptateurs sur les primitives MongoDB partagées.
