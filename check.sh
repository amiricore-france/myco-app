#!/usr/bin/env bash
set -uo pipefail
PASS=0; FAIL=0
ok() { echo "OK  $1"; PASS=$((PASS+1)); }
ko() { echo "ERR $1"; FAIL=$((FAIL+1)); }
echo "=== Controles Myco ==="
command -v node >/dev/null 2>&1 && ok "Node $(node -v)" || ko "Node absent"
command -v npm  >/dev/null 2>&1 && ok "npm $(npm -v)"   || ko "npm absent"
for f in server/package.json client/package.json server/src/index.js; do
  [ -f "$f" ] && ok "$f" || ko "$f manquant"
done
for f in server/src/index.js server/src/db.js server/src/middleware/auth.js \
         server/src/routes/auth.js server/src/routes/spots.js \
         server/src/routes/finds.js server/src/routes/stats.js; do
  [ -f "$f" ] && node --check "$f" 2>/dev/null && ok "$f" || ko "$f"
done
echo "Resultat : ${PASS} OK / ${FAIL} echec(s)"
[ "$FAIL" -eq 0 ]
