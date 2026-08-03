#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/apps/onehealth_backend}"
REPO_URL="${REPO_URL:-https://github.com/yabainjump/Onehealth_backend.git}"
BRANCH="${BRANCH:-main}"
NODE_BIN_DIR="${NODE_BIN_DIR:-/opt/cpanel/ea-nodejs20/bin}"
NPM_BIN="${NPM_BIN:-$NODE_BIN_DIR/npm}"
NODE_BIN="${NODE_BIN:-$NODE_BIN_DIR/node}"
PM2_BIN="${PM2_BIN:-pm2}"
PM2_APP_NAME="${PM2_APP_NAME:-onehealth-backend}"
UPLOADS_DIR="${UPLOADS_DIR:-$HOME/apps/onehealth-data/uploads}"
DASHBOARD_ORIGIN="${DASHBOARD_ORIGIN:-https://onehealthdashboard.yaba-in.com}"
PUBLIC_API_BASE_URL="${PUBLIC_API_BASE_URL:-https://backend.onehealthnetwork.yaba-in.com/api}"
VERIFY_PUBLIC_API="${VERIFY_PUBLIC_API:-true}"
STARTUP_CHECK_ATTEMPTS="${STARTUP_CHECK_ATTEMPTS:-12}"
STARTUP_CHECK_DELAY_SECONDS="${STARTUP_CHECK_DELAY_SECONDS:-5}"

export PATH="$(dirname "$NODE_BIN"):$NODE_BIN_DIR:$PATH"
export NODE_BIN PM2_APP_NAME UPLOADS_DIR

case "$STARTUP_CHECK_ATTEMPTS:$STARTUP_CHECK_DELAY_SECONDS" in
  :*|*:|*[!0-9:]*|0:*|*:0)
    echo "Error: startup check attempts and delay must be positive integers."
    exit 1
    ;;
esac

mkdir -p "$APP_DIR"
mkdir -p "$UPLOADS_DIR"/{profile,post,message}

if [ ! -w "$UPLOADS_DIR" ]; then
  echo "Error: upload directory is not writable: $UPLOADS_DIR"
  exit 1
fi

cd "$APP_DIR"

if [ ! -d .git ]; then
  if [ -n "$(ls -A "$APP_DIR" 2>/dev/null)" ]; then
    echo "Error: $APP_DIR is not a git repository and is not empty."
    echo "Please clean it or set APP_DIR to an empty directory, then rerun."
    exit 1
  fi
  echo "Git repo not found in $APP_DIR, cloning $REPO_URL"
  git clone "$REPO_URL" .
fi

if git remote get-url origin >/dev/null 2>&1; then
  CURRENT_ORIGIN="$(git remote get-url origin)"
  if [ "$CURRENT_ORIGIN" != "$REPO_URL" ]; then
    echo "Updating origin remote to $REPO_URL"
    git remote set-url origin "$REPO_URL"
  fi
else
  git remote add origin "$REPO_URL"
fi

# Force the working tree to match origin exactly. This deploy target should
# never carry local edits, so we discard any to avoid "local changes would be
# overwritten by merge" failures on pull.
git fetch origin "$BRANCH"
git checkout -f "$BRANCH"
git reset --hard "origin/$BRANCH"

if [ ! -f .env ]; then
  echo "Error: missing production configuration: $APP_DIR/.env"
  exit 1
fi

CORS_VALUE="$(grep -E '^[[:space:]]*CORS_ORIGIN=' .env | tail -n 1 | cut -d= -f2- || true)"
CORS_NORMALIZED="$(printf '%s' "$CORS_VALUE" | tr -d '[:space:]\"' | tr -d "'")"
case ",$CORS_NORMALIZED," in
  *",$DASHBOARD_ORIGIN,"*) ;;
  *)
    echo "Error: $DASHBOARD_ORIGIN is missing from CORS_ORIGIN in $APP_DIR/.env"
    echo "Keep the existing origins and add the dashboard origin, separated by a comma."
    exit 1
    ;;
esac

# Passing the validated value to PM2 with --update-env also fixes processes
# originally created from another working directory. ConfigModule will still
# read the complete .env file from APP_DIR for all other settings.
export CORS_ORIGIN="$CORS_NORMALIZED"

if [ -f package-lock.json ]; then
  "$NPM_BIN" ci
else
  "$NPM_BIN" install
fi

"$NPM_BIN" run build

"$PM2_BIN" startOrReload ecosystem.config.cjs --update-env

"$PM2_BIN" save

if [ "$VERIFY_PUBLIC_API" = "true" ]; then
  CORS_HEADERS="$(mktemp)"
  trap 'rm -f "$CORS_HEADERS"' EXIT
  CORS_STATUS="000"
  CORS_READY="false"

  for ((attempt = 1; attempt <= STARTUP_CHECK_ATTEMPTS; attempt += 1)); do
    if ! CORS_STATUS="$(curl -sS --connect-timeout 10 --max-time 30 \
      -X OPTIONS -D "$CORS_HEADERS" -o /dev/null -w '%{http_code}' \
      -H "Origin: $DASHBOARD_ORIGIN" \
      -H 'Access-Control-Request-Method: POST' \
      -H 'Access-Control-Request-Headers: content-type,authorization' \
      "$PUBLIC_API_BASE_URL/auth/login")"; then
      CORS_STATUS="000"
    fi

    if [ "$CORS_STATUS" = "204" ] && \
       grep -Fqi "Access-Control-Allow-Origin: $DASHBOARD_ORIGIN" "$CORS_HEADERS"; then
      CORS_READY="true"
      break
    fi

    if [ "$attempt" -lt "$STARTUP_CHECK_ATTEMPTS" ]; then
      echo "API not ready yet (HTTP $CORS_STATUS), retry $attempt/$STARTUP_CHECK_ATTEMPTS..."
      sleep "$STARTUP_CHECK_DELAY_SECONDS"
    fi
  done

  if [ "$CORS_READY" != "true" ]; then
    echo "Error: public API CORS verification failed with HTTP $CORS_STATUS."
    "$PM2_BIN" describe "$PM2_APP_NAME" || true
    exit 1
  fi
  rm -f "$CORS_HEADERS"
  trap - EXIT
fi

echo "OneHealth backend deployment completed."
