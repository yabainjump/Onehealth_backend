# Validation US1 — confidentialité des pièces jointes privées

Date : 2026-08-24

## Résultats locaux

| Contrôle | Résultat |
|---|---|
| Périmètre : `/uploads/message/` protégé, `/uploads/profile/` et `/uploads/post/` publics | PASS |
| Signature : lien privé signé, vérification réussie | PASS |
| Signature : chemin relatif signé de la même manière | PASS |
| Signature : média public laissé inchangé | PASS |
| Refus : signature absente | PASS |
| Refus : signature malformée | PASS |
| Refus : signature rejouée sur un autre fichier | PASS |
| Refus : échéance prolongée après émission | PASS |
| Refus : signature expirée | PASS |
| Refus : signature émise avec un autre secret | PASS |
| Idempotence : deux émissions ne produisent qu'un couple `exp`/`sig` | PASS |
| Idempotence : paramètre de requête tiers conservé | PASS |
| `/api/media/*` : chemin privé refusé, y compris en casse différente | PASS |
| `/api/media/*` : chemins publics toujours acceptés | PASS |
| Confinement des chemins source sur 8 entrées hostiles | PASS |
| Tests ciblés `media-access` et `media` | PASS — 2 suites, 25 tests |

## Rejeu de la barrière statique

La barrière de `src/main.ts` a été rejouée hors application, avec le service de signature réel, sur
un serveur Express minimal reproduisant l'ordre d'enregistrement (barrière avant service statique) :

| Requête | Attendu | Obtenu |
|---|---|---|
| message sans signature | 403 | 403 |
| message avec signature forgée | 403 | 403 |
| message avec signature rejouée sur un autre fichier | 403 | 403 |
| message avec signature valide | 200 | 200 |
| message en casse différente, non signé | 403 | 403 |
| publication publique | 200 | 200 |
| profil public | 200 | 200 |

Aucune identité, aucun secret et aucune donnée personnelle n'apparaissent dans ces preuves : une
autorisation ne contient qu'un chemin et une échéance.

## Reste à exercer avant mise en service

Le parcours applicatif complet — envoi d'une pièce jointe, relecture de la conversation, ouverture du
document — n'a pas été exercé, faute de MongoDB et de l'application Ionic dans l'environnement de
vérification. La logique est testée des deux côtés (émission et vérification), mais l'enchaînement
réel reste à confirmer, ainsi que le comportement des clients déjà ouverts au moment du déploiement.
