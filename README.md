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

## Variables d'environnement

Voir `server/.env.example`. En production, `JWT_SECRET` est **obligatoire**
(le serveur refuse de démarrer sans). Le SMTP est optionnel : sans lui, les
liens e-mail sont journalisés au lieu d'être envoyés.

## Mise en ligne (VPS OVH)

Guide complet : [`deploy/DEPLOY-OVH.md`](deploy/DEPLOY-OVH.md).
Nginx + systemd + HTTPS Let's Encrypt, avec déploiement continu optionnel
via GitHub Actions (`.github/workflows/deploy.yml`).
