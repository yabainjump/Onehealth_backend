# Validation US3 — résistance au bourrage d'identifiants réparti

Date : 2026-08-24

## Résultats locaux

| Contrôle | Résultat |
|---|---|
| Un échec de connexion consomme le quota du compte visé | PASS |
| Le sujet du quota est l'adresse normalisée du compte, pas l'adresse cliente | PASS |
| Plafond atteint : la tentative erronée renvoie HTTP 429 et non 401 | PASS |
| Plafond atteint : le mot de passe correct aboutit malgré tout | PASS |
| Une authentification réussie ne consomme pas le quota | PASS |
| Variante `/api/auth/login/` comptée comme la forme canonique | PASS |
| Variantes `/api/AUTH/LOGIN` et `/api/Auth/Login` comptées | PASS |
| Variantes `/api/auth/./login` et `/api/auth//login` comptées | PASS |
| Variante `/api/AUTH/FORGOT-PASSWORD` comptée | PASS |
| Routes hors périmètre toujours non limitées | PASS |
| Tests ciblés `auth` | PASS — 4 suites, 29 tests |

## Défaut corrigé dans la fonctionnalité 001

La normalisation de la clé de quota corrige un écart à **FR-005** de `001-backend-load-balancing` :
le middleware recherchait la politique par correspondance exacte, alors qu'Express achemine la route
sans tenir compte de la casse, d'une barre oblique finale ni d'un segment neutre. Ces variantes
atteignaient donc le contrôleur **sans aucun plafond**.

Les deux comportements ont été établis séparément avant correction, avec le service réel et un
serveur Express minimal :

| Chemin | Route atteinte (Express) | Quota appliqué (avant) | Quota appliqué (après) |
|---|---|---|---|
| `/api/auth/login` | oui | oui | oui |
| `/api/auth/login/` | oui | **non** | oui |
| `/api/AUTH/LOGIN` | oui | **non** | oui |
| `/api/Auth/Login` | oui | **non** | oui |
| `/api/auth/./login` | oui | **non** | oui |

## Choix de conception : pourquoi compter les échecs seulement

Un plafond par compte appliqué à toutes les tentatives permettrait à n'importe qui de verrouiller le
compte d'autrui en épuisant ses essais. En ne comptant que les échecs et en laissant toujours passer
un mot de passe correct, le contrôle bloque la recherche de mot de passe sans créer de déni de
service sur le titulaire légitime. Ce comportement est couvert par un test dédié.
