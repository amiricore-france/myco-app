#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[ -d .venv ] || { echo "Lancez d'abord ./install.sh"; exit 1; }
source .venv/bin/activate
echo "🔬 BioCLIP service -> http://127.0.0.1:5000"
echo "   (le premier demarrage telecharge ~1.5 Go de poids de modele)"
exec uvicorn app:app --host 127.0.0.1 --port 5000
