#!/usr/bin/env bash
# Runs the database rule tests against a throwaway local Postgres.
# Needs Postgres 15+ binaries. It works on Linux, macOS and native Windows (run it from Git Bash).
#
# Where the Postgres programs (initdb, pg_ctl, psql) come from, in order:
#   1. TEST_DB_PGBIN, if you set it to the folder that holds them
#   2. /usr/lib/postgresql/*/bin (Debian and Ubuntu packages)
#   3. C:\Program Files\PostgreSQL\*\bin (the Windows installer)
#   4. whatever is already on PATH
set -euo pipefail

case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*) WINDOWS=1 ;;
  *) WINDOWS= ;;
esac

# Postgres refuses to run as root; in containers, re-run as an unprivileged user.
if [ -z "$WINDOWS" ] && [ "$(id -u)" = "0" ] && [ -z "${TEST_DB_REEXEC:-}" ]; then
  exec runuser -u "${TEST_DB_USER:-nobody}" -- env TEST_DB_REEXEC=1 "$0" "$@"
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PGBIN="${TEST_DB_PGBIN:-}"
if [ -z "$PGBIN" ]; then
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
fi
if [ -z "$PGBIN" ] && [ -n "$WINDOWS" ]; then
  PGBIN="$(ls -d "/c/Program Files/PostgreSQL"/*/bin 2>/dev/null | sort -V | tail -1 || true)"
fi
# PATH entries are separated by colons, so a Windows-style folder (C:\...) must become /c/... first.
if [ -n "$WINDOWS" ] && [ -n "$PGBIN" ]; then PGBIN="$(cygpath -u "$PGBIN")"; fi
export PATH="${PGBIN:+$PGBIN:}$PATH"

for program in initdb pg_ctl psql; do
  if ! command -v "$program" >/dev/null 2>&1; then
    echo "Cannot find '$program'. Install Postgres 15 or newer, or set TEST_DB_PGBIN to the folder that holds it" >&2
    echo "(for example: TEST_DB_PGBIN='/c/Program Files/PostgreSQL/16/bin' npm run test:db)." >&2
    exit 1
  fi
done

# Native Windows programs need Windows-style paths (C:/...); everywhere else the path is used as it is.
native_path() {
  if [ -n "$WINDOWS" ]; then cygpath -m "$1"; else printf '%s' "$1"; fi
}

DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
cleanup() { pg_ctl -D "$(native_path "$DATA")" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

if [ -n "$WINDOWS" ]; then
  # Windows has no Unix sockets, so talk over the local network only, and force UTF-8 so the SQL files read correctly.
  HOST="127.0.0.1"
  export PGCLIENTENCODING=UTF8
  initdb -D "$(native_path "$DATA")" -U postgres -A trust -E UTF8 --locale=C >/dev/null
  pg_ctl -D "$(native_path "$DATA")" -o "-p $PORT -c listen_addresses=127.0.0.1" -l "$(native_path "$DATA")/log" start >/dev/null
else
  HOST="$DATA"
  initdb -D "$DATA" -U postgres -A trust >/dev/null
  pg_ctl -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" start >/dev/null
fi

PSQL=(psql -h "$HOST" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$(native_path "$ROOT/supabase/tests/supabase-stub.sql")"
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$(native_path "$f")"
done
for f in "$ROOT"/supabase/tests/*.test.sql; do
  echo "== $(basename "$f")"
  # Every test file starts from an empty database, so one file's data cannot change another's counts.
  # (Truncating the sign-in users cascades to every table that depends on them.)
  "${PSQL[@]}" -c "set client_min_messages = warning; truncate table auth.users cascade"
  # The tests report progress as NOTICE messages on stderr; the query output itself is not needed.
  "${PSQL[@]}" -f "$(native_path "$f")" 2>&1 >/dev/null | sed -E 's/^psql:[^ ]+ NOTICE:  /  /'
done
echo "All database tests passed."
