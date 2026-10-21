#!/usr/bin/env bash
# Script de mise à jour exécuté SUR le VPS (par le déploiement auto ou à la main).
# Récupère la dernière version, réinstalle, reconstruit le client, redémarre l'API
# (et BioCLIP si son code a changé).
#
# Tout est dans main(), appelée à la dernière ligne : bash lit ainsi le script en
# entier avant de l'exécuter, alors que `git checkout` peut le réécrire en route.
set -euo pipefail

main() {
  local APP_DIR="${APP_DIR:-/var/www/myco}"
  local BRANCH="${BRANCH:-main}"

  cd "$APP_DIR"
  echo "▶ Mise à jour depuis la branche $BRANCH…"
  local OLD
  OLD=$(git rev-parse HEAD)
  git fetch --prune origin
  git checkout -q -B "$BRANCH" "origin/$BRANCH"
  git reset -q --hard "origin/$BRANCH"
  echo "  $(git log --oneline -1)"

  echo "▶ Installation des dépendances serveur…"
  npm --prefix server ci --omit=dev --no-audit --no-fund

  echo "▶ Installation + build du client…"
  npm --prefix client ci --no-audit --no-fund
  npm --prefix client run build

  echo "▶ Redémarrage de l'API…"
  sudo systemctl restart myco-api

  # BioCLIP : redémarrage seulement si son code ou la liste des espèces a changé
  # (les dépendances Python ne sont pas réinstallées : voir DEPLOY-OVH.md, 7 bis).
  if ! git diff --quiet "$OLD" HEAD -- bioclip-service/ data/species.json; then
    echo "▶ Redémarrage de BioCLIP…"
    sudo systemctl restart myco-bioclip
  fi

  echo "✅ Déploiement terminé."
}

main "$@"
