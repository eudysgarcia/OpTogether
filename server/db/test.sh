#!/bin/sh
# Ejecuta las pruebas pgTAP contra el contenedor `db` (cada archivo corre en una transacción con ROLLBACK).
set -e
cd "$(dirname "$0")/.."
fail=0
for f in db/tests/*.sql; do
  out=$(docker compose exec -T db psql -U postgres -d optogether -X -q -t -A -v ON_ERROR_STOP=1 < "$f" 2>&1) || { echo "$out" | tail -5; fail=1; continue; }
  total=$(echo "$out" | grep -cE '^(not )?ok ' || true)
  bad=$(echo "$out" | grep -E '^not ok|Looks like' || true)
  if [ -n "$bad" ]; then echo "$bad"; fail=1; fi
  echo "$(basename "$f"): $total pruebas"
done
[ $fail -eq 0 ] && echo "PASS" || { echo "FAIL"; exit 1; }
