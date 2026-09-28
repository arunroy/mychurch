#!/usr/bin/env bash
# Runs the database rule tests against a throwaway local Postgres.
# Needs Postgres 15+ binaries on PATH (or in /usr/lib/postgresql/*/bin).
set -euo pipefail

# Postgres refuses to run as root; in containers, re-run as an unprivileged user.
if [ "$(id -u)" = "0" ] && [ -z "${TEST_DB_REEXEC:-}" ]; then
  exec runuser -u "${TEST_DB_USER:-nobody}" -- env TEST_DB_REEXEC=1 "$0" "$@"
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
export PATH="${PGBIN:+$PGBIN:}$PATH"

DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
cleanup() { pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

initdb -D "$DATA" -U postgres -A trust >/dev/null
pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" start >/dev/null

PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/supabase-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f"
done
for f in "$ROOT"/supabase/tests/*.test.sql; do
  echo "== $(basename "$f")"
  "${PSQL[@]}" -o /dev/null -f "$f" 2>&1 | sed -E 's/^psql:[^ ]+ NOTICE:  /  /'
done
echo "All database tests passed."
