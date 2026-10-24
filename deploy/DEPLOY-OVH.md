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
- Node.js 20+ (voir `.nvmrc`).

---

## 1. Préparer le serveur

```bash
# En root sur le VPS
apt update && apt upgrade -y
apt install -y nginx git curl

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Utilisateur système dédié. Il lui faut un shell pour que le déploiement
# (scp, GitHub Actions) puisse se connecter en SSH ; l'accès se fait par clé
# uniquement (pas de mot de passe défini). Son dossier personnel est séparé du code.
adduser --system --group --shell /bin/bash --home /home/myco myco
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
cp /var/www/myco/deploy/nginx-security-headers.conf /etc/nginx/snippets/myco-security-headers.conf
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

## 7 bis. Identification BioCLIP (AI_PROVIDER=bioclip)

Le service BioCLIP tourne en local sur le VPS (port 5000, non exposé). Il exige
Python 3.12 (Pillow 10.4 n'existe pas pour 3.14), installé via `uv` ; PyTorch est
installé en version CPU (~950 Mo au lieu de plusieurs Go avec CUDA).

```bash
# uv : binaire officiel (https://github.com/astral-sh/uv/releases), vérifier le .sha256
cd /var/www/myco/bioclip-service
sudo -u myco -H uv venv -p 3.12 .venv
sudo -u myco -H uv pip install -p .venv/bin/python torch==2.14.1 torchvision==0.29.1 \
  --index-url https://download.pytorch.org/whl/cpu
sudo -u myco -H uv pip install -p .venv/bin/python -r requirements.txt

cp /var/www/myco/deploy/bioclip.service /etc/systemd/system/myco-bioclip.service
systemctl daemon-reload && systemctl enable --now myco-bioclip
# Le modèle (1,6 Go) est téléchargé au premier démarrage dans /home/myco/.cache.
# Démarrage lent (~9 min sur 4 vCPU) : encodage des noms d'espèces.
curl -s http://127.0.0.1:5000/health     # {"ok":true,...} une fois prêt
```

Puis `AI_PROVIDER=bioclip` dans `server/.env` et `systemctl restart myco-api`.

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
   echo 'myco ALL=(root) NOPASSWD: /usr/bin/systemctl restart myco-api, /usr/bin/systemctl restart myco-bioclip' > /etc/sudoers.d/myco
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

## 11. Myco Premium : cartes hors-ligne, alertes de poussée, Stripe

Tout fonctionne sans Stripe : tant que les clés ne sont pas renseignées, l'offre
s'affiche « bientôt disponible ». Pour un lancement gratuit avec Premium ouvert
à tous, mettre `PREMIUM_FOR_ALL=true` dans `.env`.

### 11.1 Nginx (CSP + service worker)

Recopier les deux fichiers mis à jour puis recharger :

```bash
sudo cp deploy/nginx-security-headers.conf /etc/nginx/snippets/myco-security-headers.conf
sudo cp deploy/nginx-myco.conf /etc/nginx/sites-available/myco   # puis remettre le server_name / bloc HTTPS de Certbot
sudo nginx -t && sudo systemctl reload nginx
```

> Si Certbot a déjà réécrit `sites-available/myco`, n'écrasez pas le fichier :
> ajoutez-y seulement les deux blocs `location = /sw.js` et
> `location = /manifest.webmanifest`.

### 11.2 Notifications push (clés VAPID)

```bash
cd /var/www/myco/server && npx web-push generate-vapid-keys
```

Reporter `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` dans `.env` (une seule fois :
les changer invalide tous les abonnements existants). Le push exige le HTTPS.
Sur iPhone, il ne marche que dans l'app ajoutée à l'écran d'accueil (iOS 16.4+).

### 11.3 Alertes quotidiennes (timer systemd)

```bash
sudo cp deploy/myco-alerts.service deploy/myco-alerts.timer /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now myco-alerts.timer
# Simulation sans envoi :
sudo -u myco bash -c 'cd /var/www/myco/server && set -a && . ./.env && node src/jobs/flush-alerts.js --dry-run'
```

Météo : Open-Meteo est gratuit en **non-commercial** seulement. Dès que Premium
est vendu, souscrire une offre API Open-Meteo et renseigner `OPEN_METEO_API_KEY`.

### 11.4 Stripe

1. Créer le compte sur stripe.com (statut entrepreneur individuel ou société,
   SIRET, IBAN pour les virements). Tout se prépare d'abord en **mode test**.
2. **Produit** : Catalogue de produits → « Myco Premium » avec deux tarifs
   récurrents (mensuel, annuel). Copier les identifiants `price_…`.
3. **Portail client** : Paramètres → Billing → Portail client → activer
   (résiliation, changement de carte, factures).
4. **Webhook** : Développeurs → Webhooks → ajouter l'endpoint
   `https://myco.app-fair.fr/api/billing/webhook` avec les événements
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
   Copier le secret de signature `whsec_…`.
5. Renseigner dans `.env` : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` et les libellés de prix,
   puis `sudo systemctl restart myco-api`.
6. Tester avec la carte `4242 4242 4242 4242` (date future, CVC quelconque),
   vérifier le passage en Premium, la résiliation via « Gérer mon abonnement »,
   puis basculer sur les clés **live** (nouveau webhook live, nouveaux `price_…`).

En local, les webhooks se testent avec la CLI Stripe :
`stripe listen --forward-to localhost:4400/api/billing/webhook`.

> Avant d'encaisser : CGV/CGU, mentions légales et politique de confidentialité
> en ligne, information sur le droit de rétractation (contenu numérique fourni
> immédiatement), et déclaration du chiffre d'affaires selon votre statut.

---

## Plus tard : passer à PostgreSQL

SQLite convient très bien au démarrage. Si le nombre d'utilisateurs simultanés
augmente nettement, une migration vers PostgreSQL sera confortable : les requêtes
du serveur sont du SQL standard. Ce sera un chantier dédié le moment venu.
