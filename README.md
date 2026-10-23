# Myco — Mes coins à champignons

Plateforme de gestion, partage et analyse de coins à champignons.

## Développement

```bash
./install.sh      # installe les dépendances et crée server/.env
./start-dev.sh    # lance le serveur (4400) + le client (5273)
```

## Fonctionnalités comptes

- Inscription / connexion (JWT), validation e-mail et mot de passe.
- Vérification d'e-mail et réinitialisation de mot de passe par lien (SMTP).
- Gestion de compte : changement de mot de passe, suppression de compte.
- Partage de coins entre utilisateurs, podium optionnel.

## Myco Premium

- **Cartes hors-ligne** : fond Plan IGN (Géoplateforme, sans clé). L'app est une PWA
  installable ; l'utilisateur télécharge le Plan IGN autour d'un coin (1 à 3 km) ou de
  la zone affichée, et retrouve carte, coins et cueillettes sans réseau
  (`client/public/sw.js`, `client/src/lib/offline.js`).
- **Alertes de poussée** : indice 0-100 par coin à partir de la météo Open-Meteo
  (pluie sur 14 jours, températures, gel), affiché au tableau de bord et envoyé chaque
  matin par e-mail et/ou notification push (`server/src/lib/flush.js`,
  `server/src/jobs/flush-alerts.js`, timer `deploy/myco-alerts.timer`).
- **Abonnement Stripe** : Checkout, portail client et webhook (`server/src/routes/billing.js`).
  Sans clés Stripe, l'offre s'affiche « bientôt disponible » ; `PREMIUM_FOR_ALL=true`
  ouvre Premium à tous (lancement gratuit).

Mise en place : `deploy/DEPLOY-OVH.md`, section 11.

## Variables d'environnement

Voir `server/.env.example`. En production, `JWT_SECRET` est **obligatoire**
(le serveur refuse de démarrer sans). Le SMTP est optionnel : sans lui, les
liens e-mail sont journalisés au lieu d'être envoyés.

## Mise en ligne (VPS OVH)

Guide complet : [`deploy/DEPLOY-OVH.md`](deploy/DEPLOY-OVH.md).
Nginx + systemd + HTTPS Let's Encrypt, avec déploiement continu optionnel
via GitHub Actions (`.github/workflows/deploy.yml`).
