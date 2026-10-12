#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log() { echo -e "${GREEN}▶${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

cd "$(dirname "$0")"

command -v python3 >/dev/null 2>&1 || { echo "Python 3.10+ requis"; exit 1; }

PY_OK=$(python3 -c "import sys; print(1 if sys.version_info >= (3,10) else 0)")
[ "$PY_OK" = "1" ] || { echo "Python 3.10+ requis (detecte $(python3 -V))"; exit 1; }

if [ ! -d .venv ]; then
  log "Creation du venv Python..."
  python3 -m venv .venv
fi

source .venv/bin/activate
log "Mise a jour de pip..."
pip install --quiet --upgrade pip

log "Installation des dependances (5-10 min, ~1.5 Go)..."
pip install --quiet -r requirements.txt

log "Verification du modele..."
python -c "from bioclip import CustomLabelsClassifier; print('pybioclip OK')"

log "✅ Installation BioCLIP terminee."
echo ""
echo "  Pour demarrer :  ./start.sh"
