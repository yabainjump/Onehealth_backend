# Migration des anciens justificatifs de certification

Les documents téléversés avant le lot 006 peuvent encore se trouver dans
`/uploads/post/` et avoir été mis en cache publiquement. La mise à jour du code
ne les rend pas privés rétroactivement.

1. Déployer d'abord le backend, puis immédiatement le frontend Ionic. Vérifier
   un nouveau téléversement/une nouvelle demande avec un compte de test et que
   l'URL du justificatif sans signature retourne 403. Ne pas exposer d'URL réelle
   dans les journaux ou tickets.
2. Faire une sauvegarde cohérente de la base communautaire et du dossier
   `UPLOADS_DIR` hors des dépôts. Suspendre temporairement les demandes de
   certification pendant la migration pour éviter une modification concurrente.
3. Sur le serveur, depuis le dépôt backend avec son `.env` existant, exécuter
   `npm run migrate:certification-media` sans option. Cette commande est une
   simulation en lecture seule : noter uniquement les compteurs.
4. Examiner chaque élément `shared`, `missing` ou `ambiguous` avant d'appliquer.
   Le script ne retire jamais un fichier également référencé par une publication,
   une alerte, un profil ou un message. Une copie déjà en cache externe requiert
   une procédure de purge distincte selon l'hébergeur.
5. Si l'inventaire et la sauvegarde sont validés, définir
   `CERTIFICATION_MEDIA_MIGRATION_CONFIRM=APPLY` pour la seule commande et lancer
   `npm run migrate:certification-media -- --apply`. Le script crée un lien sur le
   même volume, retire la source publique, puis met à jour la référence MongoDB.
   Il est relançable après une interruption ; ne pas déplacer le dossier partagé.
6. Refaire la simulation : `candidates` doit être 0, ou chaque restant doit être
   explicitement justifié. Vérifier applicant/admin, URL directe non signée,
   miniatures publiques et pages de publications. Conserver sauvegarde et journal
   d'intervention selon la politique de rétention.

Retour arrière : ne jamais restaurer une version backend ignorant le préfixe
`certification` sans restaurer aussi les références et les fichiers de la sauvegarde.
Les anciennes copies téléchargées ou mises en cache ne sont pas récupérables par
ce script.
