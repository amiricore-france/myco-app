#!/usr/bin/env bash
set -uo pipefail
BASE="${BASE:-http://localhost:4400}"
PASS=0; FAIL=0
assert() { [ "$2" = "1" ] && { echo "OK  $1"; PASS=$((PASS+1)); } || { echo "ERR $1"; FAIL=$((FAIL+1)); }; }
EMAIL="test-$(date +%s)@myco.local"; PASSWORD="motdepasse123"

curl -sf "$BASE/health" | grep -q '"ok":true' && assert "health" 1 || assert "health" 0
REG=$(curl -s -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$REG" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
[ -n "$TOKEN" ] && assert "register" 1 || assert "register" 0
SPOT=$(curl -s -X POST "$BASE/api/spots" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Coin","lat":45.75,"lng":4.85,"radius_m":80}')
SPOT_ID=$(echo "$SPOT" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
[ -n "$SPOT_ID" ] && assert "POST /spots" 1 || assert "POST /spots" 0
FIND=$(curl -s -X POST "$BASE/api/finds" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"spot_id\":$SPOT_ID,\"species\":\"Cepe\",\"weight_g\":420}")
[ -n "$(echo "$FIND" | grep -o '"id":[0-9]*' | head -1)" ] && assert "POST /finds" 1 || assert "POST /finds" 0
echo "Resultat : ${PASS} OK / ${FAIL} echec(s)"
[ "$FAIL" -eq 0 ]
