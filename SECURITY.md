# Politique de sécurité — backend

## Périmètre
API NestJS publique commune à la communauté et au Hub CEEAC ; MongoDB communautaire et Hub, médias, Rudolf, connecteurs, scripts et déploiement.

## Frontières de confiance
Les visiteurs, membres, administrateurs et acteurs institutionnels ont des droits distincts. Paramètres HTTP, fichiers, données des sources, contenu communautaire et réponses IA sont non fiables. Le backend est l’autorité des rôles, pays, ressources et transitions.

## Invariants
- Authentifier puis autoriser chaque opération protégée ; vérifier propriétaire, rôle et portée pays côté serveur avant lecture, calcul, export ou contexte IA.
- Refuser par défaut les paramètres hors DTO, borner les entrées et empêcher les injections, traversées de chemin, SSRF et uploads dangereux selon le flux.
- Ne jamais exposer secrets, jetons, données privées ou pièces jointes de chat par une URL publique non autorisée ; minimiser logs et réponses.
- Une observation ou un signal ne devient pas une alerte vérifiée sans décision humaine auditée. Rudolf ne vérifie ni ne publie.
- Marquer durablement les données simulées et empêcher leur présentation comme données institutionnelles officielles.
- Préserver les contrôles malgré deux workers PM2 : limites, verrous et états sensibles ne dépendent pas de la seule mémoire d’un processus.

## Signalements pertinents
Signaler une atteinte réaliste aux accès entre utilisateurs/pays, aux rôles, aux secrets, aux médias privés, à l’intégrité des décisions ou à la disponibilité. Justifier contrôle de l’entrée, atteignabilité, protection existante et impact ; calibrer la gravité selon exposition et données touchées.

## Limites connues
Le pilote utilise un serveur unique ; les médias de profil/publication sont publics par conception, contrairement aux pièces jointes de chat. Les sources Hub actuelles sont simulées. Ces faits ne suppriment pas les vulnérabilités atteignables. Aucune exclusion ni vulnérabilité acceptée n’est approuvée par ce fichier.
