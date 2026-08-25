# Validation US2 — reprise de contrôle d'un compte compromis

Date : 2026-08-24

## Résultats locaux

| Contrôle | Résultat |
|---|---|
| Session acceptée quand aucun changement de mot de passe n'est enregistré | PASS |
| Session acceptée quand elle est émise après le changement | PASS |
| Session refusée quand elle est émise avant le changement | PASS |
| Session refusée quand elle ne porte pas de date d'émission et qu'un changement existe | PASS |
| Compte banni toujours refusé (comportement antérieur préservé) | PASS |
| Compte introuvable toujours refusé (comportement antérieur préservé) | PASS |
| Tests ciblés `auth` (4 suites, dont la stratégie de session) | PASS — 29 tests |

## Points de conception vérifiés

- Le champ `passwordChangedAt` vaut `null` par défaut : le déploiement n'invalide aucune session
  existante, seul un changement de mot de passe ultérieur produit l'effet.
- La comparaison tolère la seconde en cours, pour ne pas refuser un jeton émis dans la même seconde
  que le changement.
- L'état est lu en base à chaque requête protégée, comme le bannissement et les rôles : la révocation
  prend donc effet sur toutes les instances sans état de processus.

## Reste à exercer avant mise en service

Le circuit complet — connexion, réinitialisation par courriel, réutilisation de la session initiale —
n'a pas été exercé de bout en bout faute de MongoDB et de SMTP dans l'environnement de vérification.
