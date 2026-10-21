#!/usr/bin/env bash
# Script de mise à jour exécuté SUR le VPS (par le déploiement auto ou à la main).
# Récupère la dernière version, réinstalle, reconstruit le client, redémarre l'API.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/myco}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"
echo "▶ Mise à jour depuis la branche $BRANCH…"
git fetch --all
git reset --hard "origin/$BRANCH"

echo "▶ Installation des dépendances serveur…"
npm --prefix server ci --omit=dev

echo "▶ Installation + build du client…"
npm --prefix client ci
npm --prefix client run build

echo "▶ Redémarrage de l'API…"
sudo systemctl restart myco-api

echo "✅ Déploiement terminé."
