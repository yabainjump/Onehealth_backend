# Validation socle — preuves de livraison

Date : 2026-08-24

Le principe IX de la constitution exige lint, compilation et tests pertinents avant qu'un changement
soit considéré comme terminé. La porte de livraison n°6 y ajoute la validation de configuration.

| Preuve | Résultat |
|---|---|
| `npm run build` | PASS |
| `npm test -- --runInBand` | PASS — 42 suites, 182 tests |
| `npx eslint src/` | PASS |
| `npm run verify:pm2-config` | PASS — deux workers conditionnés à la readiness, aucun rejeu Nginx |
| `npm audit --omit=dev` | PASS — 0 vulnérabilité |

Progression de la couverture pendant la fonctionnalité : 134 tests avant les travaux, 182 après,
soit 48 tests ajoutés sur les comportements d'autorisation, de validation, d'idempotence et de
session.

## Portée des preuves

Ces résultats couvrent le comportement du dépôt en isolation. Ils **ne** couvrent pas :

- le parcours applicatif complet des pièces jointes, qui exige MongoDB et l'application Ionic ;
- le circuit de réinitialisation de mot de passe de bout en bout, qui exige SMTP ;
- l'exercice à deux workers réels, qui reste la condition d'ouverture du verrou
  `CLUSTER_SECURITY_READY` défini par la fonctionnalité 001 et que cette fonctionnalité ne modifie
  pas.

## Retour arrière

Revenir sur le code rétablit le service statique public des pièces jointes. Les adresses signées
restent des URL valides comportant deux paramètres ignorés, et `passwordChangedAt` demeure un champ
inutilisé : aucune donnée stockée ne devient inexploitable dans un sens comme dans l'autre.
