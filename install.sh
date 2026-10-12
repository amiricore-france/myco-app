#!/usr/bin/env bash
set -euo pipefail
GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}>${NC} $1"; }

command -v node >/dev/null 2>&1 || { echo "Node.js 18+ requis"; exit 1; }
[ "$(node -v | sed 's/v//' | cut -d. -f1)" -ge 18 ] || { echo "Node.js 18+ requis"; exit 1; }

log "Installation racine...";  npm install
log "Installation serveur..."; npm --prefix server install
log "Installation client...";  npm --prefix client install

if [ ! -f server/.env ]; then
  cp server/.env.example server/.env
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -hex 32)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" server/.env
    else
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" server/.env
    fi
  fi
fi
chmod +x start-dev.sh check.sh scripts/test-api.sh 2>/dev/null || true
bash ./check.sh || true
log "Installation terminee. Lancez : ./start-dev.sh"
