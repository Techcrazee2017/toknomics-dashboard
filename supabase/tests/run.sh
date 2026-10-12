#!/usr/bin/env bash
# Applies the stub + every migration to a fresh database and runs the assertion files.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="toknomics_test_$$"
psql -q -c "create database $DB" >/dev/null
trap 'psql -q -c "drop database if exists $DB" >/dev/null' EXIT
run() { psql -q -o /dev/null -d "$DB" -v ON_ERROR_STOP=1 -f "$1" 2>&1 | { grep -E 'PASS|FAIL|ERROR' || true; }; }
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/00_supabase_stub.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do run "$f"; done
for f in supabase/tests/[1-9]*.sql; do run "$f"; done
