# Exploitation Jenkins, PM2, Apache/cPanel et Nginx inactif

## Topologie validée

```text
Internet -> Apache/cPanel (TLS) -> 127.0.0.1:3000 -> PM2 cluster (2 workers NestJS)
GitHub -> Jenkins -> contrôles qualité -> commande de déploiement bornée
```

Cette première étape tolère la perte d'un worker Node.js, mais pas la perte du serveur unique.
MongoDB reste l'état partagé et `UPLOADS_DIR` doit pointer vers le même dossier absolu pour les deux
workers.

## Préconditions importantes

- Le serveur doit être un VPS avec accès `root` ou `sudo`.
- Le serveur observé possède Nginx `1.14.1`, mais son service est inactif. Apache/cPanel possède les
  ports 80/443. Ne pas démarrer, réinstaller, mettre à niveau ou remplacer Nginx pendant ce lot.
- Avant toute intégration, identifier le paquet, les modules compilés, les inclusions cPanel et le
  virtual host existant avec `nginx -V`, `rpm -qf`, `nginx -T` et `nginx -t`.
- Apache reste le reverse proxy de production tant que la configuration cPanel actuelle n'a pas
  fait l'objet d'une migration séparée et réversible.
- Sur le serveur cPanel/LiteSpeed actuel, ne pas activer ce virtual host tant que le fournisseur n'a
  pas confirmé la coexistence ou la migration : deux serveurs HTTP ne peuvent pas écouter les mêmes
  ports.
- Jenkins doit écouter uniquement sur `127.0.0.1` et être administré par tunnel SSH, ou être publié
  derrière un virtual host TLS séparé avec authentification forte.
- Le fichier `.env` de production reste dans
  `/home/yabain/apps/onehealth_backend/.env`; il n'est ni copié dans Jenkins ni commité.
- `CLUSTER_SECURITY_READY` reste `false` tant que les limites auth/upload/Rudolf ne sont pas branchées
  et validées sur l'état MongoDB partagé. Le déploiement à deux workers est volontairement bloqué
  jusque-là.

## Installation unique du déploiement Jenkins

Depuis la racine du dépôt sur le serveur :

```bash
sudo install -o root -g root -m 0755 \
  ops/jenkins/deploy-onehealth-backend \
  /usr/local/sbin/deploy-onehealth-backend

sudo install -o root -g root -m 0440 \
  ops/jenkins/onehealth-jenkins.sudoers \
  /etc/sudoers.d/onehealth-jenkins

sudo visudo -cf /etc/sudoers.d/onehealth-jenkins
```

Créer ensuite un Pipeline Jenkins multibranche pointant vers le dépôt GitHub. L'agent portant le
label `onehealth-node20` doit avoir Node.js 20 et npm dans son `PATH`. Le paramètre
`DEPLOY_PRODUCTION` reste désactivé par défaut et le déploiement est refusé hors de `main`.

## Intégration au Nginx existant

Ne pas exécuter l'installation ci-dessous sur le serveur observé : Apache utilise déjà 80/443 et un
`systemctl start nginx` créerait un conflit. Le fichier fourni reste un modèle pour une éventuelle
migration future, hors du pilote actuel.

Sur un nouveau serveur uniquement, après émission du certificat Let's Encrypt et seulement si Nginx
possède les ports 80/443 :

```bash
sudo install -o root -g root -m 0644 \
  ops/nginx/onehealth-backend.conf.example \
  /etc/nginx/conf.d/onehealth-backend.conf

sudo nginx -t
sudo systemctl reload nginx
```

La valeur de production `TRUSTED_PROXY_HOPS=1` correspond à cette topologie avec exactement un
reverse proxy Apache. Si un CDN est ajouté devant Apache, il faut définir et tester une politique de proxy
distincte avant de modifier cette valeur.

## Reverse proxy Apache/cPanel actuel

Apache cPanel `2.4.68` possède déjà les ports publics 80/443 et les modules `proxy`, `proxy_http`,
`headers`, `rewrite` et `ssl`. Les modèles persistants correspondant à cette installation sont :

- `ops/apache/onehealth-backend-http.conf.example` pour le VirtualHost HTTP ;
- `ops/apache/onehealth-backend-ssl.conf.example` pour le VirtualHost HTTPS.

Ne jamais modifier directement `/etc/apache2/conf/httpd.conf` : cPanel le régénère. Avant de remplacer
les inclusions existantes, effectuer une sauvegarde datée :

```bash
BACKUP_DIR="/root/onehealth-apache-$(date -u +%Y%m%dT%H%M%SZ)"
sudo mkdir -p "$BACKUP_DIR/std" "$BACKUP_DIR/ssl"
sudo cp -a \
  /etc/apache2/conf.d/userdata/std/2_4/yabain/backend.onehealthnetwork.yaba-in.com/proxy.conf \
  "$BACKUP_DIR/std/proxy.conf"
sudo cp -a \
  /etc/apache2/conf.d/userdata/ssl/2_4/yabain/backend.onehealthnetwork.yaba-in.com/proxy.conf \
  "$BACKUP_DIR/ssl/proxy.conf"
```

Installer les modèles depuis la racine du dépôt, puis valider une configuration de prévisualisation
avant de toucher à la configuration active :

```bash
sudo install -o root -g root -m 0644 \
  ops/apache/onehealth-backend-http.conf.example \
  /etc/apache2/conf.d/userdata/std/2_4/yabain/backend.onehealthnetwork.yaba-in.com/proxy.conf
sudo install -o root -g root -m 0644 \
  ops/apache/onehealth-backend-ssl.conf.example \
  /etc/apache2/conf.d/userdata/ssl/2_4/yabain/backend.onehealthnetwork.yaba-in.com/proxy.conf

sudo /usr/local/cpanel/scripts/rebuildhttpdconf --preview
sudo httpd -t -f /etc/apache2/conf/httpd-preview.conf
sudo /usr/local/cpanel/scripts/rebuildhttpdconf
sudo apachectl configtest
sudo /usr/local/cpanel/scripts/restartsrv_httpd --graceful
```

Après le rechargement, vérifier les trois routes publiques avant de poursuivre le déploiement PM2.
En cas d'échec, restaurer les deux sauvegardes, reconstruire `httpd.conf`, exécuter
`apachectl configtest`, puis relancer Apache avec `--graceful`.

## Contrôles après déploiement

```bash
pm2 status onehealth-backend
curl -fsS http://127.0.0.1:3000/api/health/live
curl -fsS http://127.0.0.1:3000/api/health/ready
curl -fsS https://backend.onehealthnetwork.yaba-in.com/api/health/ready
```

Deux lignes `online` doivent apparaître dans PM2. `/live` indique que le processus répond ; `/ready`
répond HTTP 200 uniquement lorsque les deux bases MongoDB et le stockage média sont accessibles.
Le script de déploiement exige en plus d'observer deux identifiants de worker distincts portant la
révision Git candidate ; une ancienne paire restée en ligne ne peut donc pas produire un faux succès.
Un worker qui échoue plusieurs contrôles consécutifs refuse le nouveau trafic, draine ses requêtes et
se termine ; `autorestart` permet alors à PM2 de le remplacer.
