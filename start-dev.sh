#!/usr/bin/env bash
set -euo pipefail
[ -d node_modules ] || { echo "Lancez d'abord ./install.sh"; exit 1; }
[ -f server/.env ] || cp server/.env.example server/.env
npm run dev
