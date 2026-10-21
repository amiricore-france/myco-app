# Déploiement de Myco sur un VPS OVH

Guide pas à pas pour mettre Myco en ligne sur un VPS OVH (Ubuntu/Debian), avec
Nginx en reverse proxy, HTTPS (Let's Encrypt) et redémarrage automatique via
systemd. Un déploiement continu (GitHub Actions) est fourni en option.

Architecture en production :

```
Navigateur ──HTTPS──> Nginx (443)
                        ├── /            → client/dist (fichiers statiques React)
                        ├── /api/        → Node/Express (127.0.0.1:4400)
                        └── /uploads/    → Node/Express (photos)
```

---

## 0. Pré-requis

- Un VPS OVH sous Ubuntu 22.04+ (ou Debian 12), accès SSH `root` ou sudo.
- Un nom de domaine (ou sous-domaine) pointant vers l'IP du VPS (enregistrement A).
- Node.js 18+ (voir `.nvmrc`).

---

## 1. Préparer le serveur

```bash
# En root sur le VPS
apt update && apt upgrade -y
apt install -y nginx git curl

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Utilisateur système dédié (sans shell de connexion)
adduser --system --group --home /var/www/myco myco
```

## 2. Récupérer le code

```bash
mkdir -p /var/www/myco && chown myco:myco /var/www/myco
# en tant que myco (ou root puis chown à la fin)
git clone https://github.com/amiricore-france/myco-app /var/www/myco
chown -R myco:myco /var/www/myco
```

## 3. Configurer l'environnement serveur

```bash
cd /var/www/myco/server
cp .env.example .env
# Générer un secret robuste
echo "JWT_SECRET=$(openssl rand -hex 32)"   # à reporter dans .env
```

Éditez `/var/www/myco/server/.env` :

```ini
NODE_ENV=production
PORT=4400
JWT_SECRET=<le secret généré ci-dessus>
CLIENT_URL=https://mon-domaine.fr
APP_URL=https://mon-domaine.fr
DATABASE_FILE=/var/lib/myco/myco.db     # base hors du dossier de code (persistante)

# E-mails (vérification + reset). Chez OVH, utilisez le SMTP de votre domaine.
SMTP_HOST=ssl0.ovh.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=no-reply@mon-domaine.fr
SMTP_PASS=<mot de passe du compte mail>
MAIL_FROM=Myco <no-reply@mon-domaine.fr>

# IA : demo (défaut) | openai | bioclip
AI_PROVIDER=demo
```

> ⚠️ En production, le serveur **refuse de démarrer** si `JWT_SECRET` est absent
> ou laissé à sa valeur par défaut. C'est voulu.

Préparez le dossier de la base de données persistante :

```bash
mkdir -p /var/lib/myco && chown myco:myco /var/lib/myco
```

## 4. Installer et construire

```bash
cd /var/www/myco
npm --prefix server ci --omit=dev
npm --prefix client ci
npm --prefix client run build     # produit client/dist
```

## 5. Lancer l'API avec systemd

```bash
cp /var/www/myco/deploy/myco-api.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now myco-api
systemctl status myco-api          # doit être "active (running)"
curl -s http://127.0.0.1:4400/health   # {"ok":true}
```

## 6. Configurer Nginx

```bash
cp /var/www/myco/deploy/nginx-myco.conf /etc/nginx/sites-available/myco
# Remplacez mon-domaine.fr par votre domaine dans ce fichier
sed -i 's/mon-domaine.fr/VOTRE-DOMAINE.fr/g' /etc/nginx/sites-available/myco
ln -sf /etc/nginx/sites-available/myco /etc/nginx/sites-enabled/myco
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## 7. Activer le HTTPS (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d mon-domaine.fr -d www.mon-domaine.fr
# Renouvellement auto déjà planifié ; test :
certbot renew --dry-run
```

À ce stade, l'application est en ligne sur `https://mon-domaine.fr`. 🎉

---

## 8. Migrer les données depuis l'Optiplex (si besoin)

La base est un simple fichier SQLite. Pour reprendre vos données existantes :

```bash
# Sur l'Optiplex : arrêter l'app, puis copier la base et les photos
scp server/myco.db      myco@VPS:/var/lib/myco/myco.db
scp -r server/uploads/* myco@VPS:/var/www/myco/server/uploads/
# Sur le VPS : droits + redémarrage
ssh myco@VPS 'chown -R myco:myco /var/lib/myco /var/www/myco/server/uploads && sudo systemctl restart myco-api'
```

> Les migrations de schéma (nouvelles colonnes e-mail/reset) s'appliquent
> automatiquement au démarrage sur une base existante — aucune action manuelle.

---

## 9. (Option) Déploiement continu via GitHub Actions

À chaque `git push` sur `main`, le VPS se met à jour tout seul.

1. Autoriser l'utilisateur `myco` à redémarrer le service sans mot de passe :

   ```bash
   echo 'myco ALL=(root) NOPASSWD: /bin/systemctl restart myco-api' > /etc/sudoers.d/myco
   chmod 440 /etc/sudoers.d/myco
   ```

2. Créer une clé SSH de déploiement et l'autoriser sur le VPS (compte `myco`).
3. Dans GitHub → Settings → Secrets → Actions, ajouter :
   `VPS_HOST`, `VPS_USER` (= myco), `VPS_SSH_KEY` (clé privée), `VPS_PORT` (option).

Le workflow `.github/workflows/deploy.yml` exécute alors `deploy/update.sh` sur le VPS.

Mise à jour manuelle à tout moment :

```bash
ssh myco@VPS 'cd /var/www/myco && bash deploy/update.sh'
```

---

## 10. Sauvegardes (recommandé)

```bash
# Sauvegarde quotidienne de la base + photos (ex. via cron root)
0 3 * * *  tar czf /var/backups/myco-$(date +\%F).tgz /var/lib/myco/myco.db /var/www/myco/server/uploads
```

---

## Plus tard : passer à PostgreSQL

SQLite convient très bien au démarrage. Si le nombre d'utilisateurs simultanés
augmente nettement, une migration vers PostgreSQL sera confortable : les requêtes
du serveur sont du SQL standard. Ce sera un chantier dédié le moment venu.
