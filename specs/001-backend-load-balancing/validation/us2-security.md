# Validation US2 — sécurité cohérente entre workers

Date : 2026-08-23

## Résultats locaux

| Contrôle | Résultat |
|---|---|
| Auth : plafond partagé simulé entre deux instances | PASS |
| Auth : HTTP 429 et `Retry-After` communs | PASS |
| Auth : indisponibilité coordination → HTTP 503 | PASS |
| Upload : plafond partagé simulé entre deux instances | PASS |
| Upload : HTTP 429 et `Retry-After` communs | PASS |
| Upload : indisponibilité coordination → HTTP 503 | PASS |
| Rudolf : fenêtres quotidienne et courte partagées | PASS |
| Rudolf : compteurs et `Retry-After` corrects | PASS |
| Rudolf : indisponibilité coordination → HTTP 503 | PASS |
| Tests ciblés | PASS — 3 suites, 12 tests |
| Suite unitaire complète | PASS — 35 suites, 112 tests |
| Suite e2e | PASS — 1 suite, 1 test |
| ESLint et build | PASS |
| Audit npm | PASS — 0 vulnérabilité |
| Refus du vérificateur sans confirmation explicite | PASS |

Les sujets bruts sont transmis uniquement au service de pseudonymisation et ne sont jamais écrits
dans les documents de coordination. Aucune clé, adresse réelle, identité réelle ou jeton n'est
présent dans cette preuve.

## Exercice cluster externe restant avant ouverture du verrou

`npm run verify:cluster-security` doit encore être exécuté une fois contre deux workers et des bases
jetables. Le script refuse la production par défaut, exige un utilisateur de test dédié, n'envoie
aucun fichier et utilise un DTO Rudolf invalide afin de ne déclencher aucun appel Groq.

`CLUSTER_SECURITY_READY` reste donc `false` jusqu'à cet exercice d'intégration réel.
