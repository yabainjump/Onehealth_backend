# Plan — avant implémentation

Constitution Check I–X : conforme. Autorité backend, souveraineté avant lecture,
signatures médias et quotas partagés conservés. Aucun schéma, secret ou infrastructure
ajouté. Spec Kit n'entre pas dans les artefacts runtime.

1. Grouper les participants des salons déjà filtrés par identité serveur via
   UsersService.findByIds ; continuer à employer toPublicUser.
2. Ionic : polling au premier plan, une requête en vol, timeout ; pause à la sortie
   Ionic et sur document masqué/hors ligne. Invalidation lors du changement de compte
   ou salon ; synchronisation de lecture seulement après nouveau message reçu.
3. Hub : lots de trois pages, timeout, annulation et générations de chargement.
   Cache mémoire 60 s par périmètre, purge au logout/login. Vide API légitime.
   Volume >10 000 : erreur explicite sans jeu partiel ni fallback.
   Les réponses auth/profil sont aussi liées à une génération de session ; le logout
   efface immédiatement l'état local et borne sa requête distante à 10 s.
4. Tests ciblés : non-membre, minimisation réponse, concurrence, session obsolète,
   visibilité, zéro résultat, 401/403 et plafond. Lint/build des dépôts modifiés.

Risques : REST reste périodique, pagination offset non transactionnelle, droits
révoqués à distance détectés à une requête suivante ; mémoire Hub encore proportionnelle
au volume jusqu'au plafond. La carte bbox et les résumés serveur restent un lot séparé.

Rollback : revert du lot et rebuild, sans migration ni nettoyage du dossier partagé
uploads. Backend avant clients. Aucun déploiement ni charge sur production autorisés.
Constitution Check après conception : conforme, aucune exception nouvelle.
