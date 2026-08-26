#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/apps/onehealth_backend}"
REPO_URL="${REPO_URL:-https://github.com/yabainjump/Onehealth_backend.git}"
BRANCH="${BRANCH:-main}"
DEPLOY_REVISION="${DEPLOY_REVISION:-}"
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
LOCAL_READY_ATTEMPTS="${LOCAL_READY_ATTEMPTS:-30}"
LOCAL_READY_DELAY_SECONDS="${LOCAL_READY_DELAY_SECONDS:-2}"
SEED_HUB_DEMO="${SEED_HUB_DEMO:-false}"

export PATH="$(dirname "$NODE_BIN"):$NODE_BIN_DIR:$PATH"
export NODE_BIN PM2_APP_NAME UPLOADS_DIR

for CHECK_VALUE in \
  "$STARTUP_CHECK_ATTEMPTS" \
  "$STARTUP_CHECK_DELAY_SECONDS" \
  "$LOCAL_READY_ATTEMPTS" \
  "$LOCAL_READY_DELAY_SECONDS"; do
  case "$CHECK_VALUE" in
    *[!0-9]*|''|0)
      echo "Error: readiness check attempts and delays must be positive integers."
      exit 1
      ;;
  esac
done

case "$SEED_HUB_DEMO" in
  true|false) ;;
  *)
    echo "Error: SEED_HUB_DEMO must be true or false."
    exit 1
    ;;
esac

if [ -n "$DEPLOY_REVISION" ]; then
  if [ "${#DEPLOY_REVISION}" -ne 40 ]; then
    echo "Error: DEPLOY_REVISION must be a complete 40-character lowercase Git commit SHA."
    exit 1
  fi
  case "$DEPLOY_REVISION" in
    *[!0-9a-f]*)
      echo "Error: DEPLOY_REVISION must be a complete 40-character lowercase Git commit SHA."
      exit 1
      ;;
  esac
fi

mkdir -p "$APP_DIR"
mkdir -p "$UPLOADS_DIR"/{profile,post,message}

APP_DIR_REAL="$(cd "$APP_DIR" && pwd -P)"
UPLOADS_DIR_REAL="$(cd "$UPLOADS_DIR" && pwd -P)"
case "$UPLOADS_DIR_REAL" in
  "$APP_DIR_REAL"|"$APP_DIR_REAL"/*)
    echo "Error: UPLOADS_DIR must stay outside APP_DIR."
    echo "Use a persistent path such as $HOME/apps/onehealth-data/uploads."
    exit 1
    ;;
esac

if [ ! -w "$UPLOADS_DIR" ]; then
  echo "Error: upload directory is not writable: $UPLOADS_DIR"
  exit 1
fi

cd "$APP_DIR"

PREVIOUS_REVISION=""
if [ -d .git ] && git rev-parse --verify HEAD >/dev/null 2>&1; then
  PREVIOUS_REVISION="$(git rev-parse HEAD)"
fi

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
DEPLOY_TARGET="origin/$BRANCH"
if [ -n "$DEPLOY_REVISION" ]; then
  if ! git rev-parse --verify "${DEPLOY_REVISION}^{commit}" >/dev/null 2>&1; then
    echo "Error: requested deployment revision is not available from origin/$BRANCH."
    exit 1
  fi
  if ! git merge-base --is-ancestor "$DEPLOY_REVISION" "origin/$BRANCH"; then
    echo "Error: requested deployment revision does not belong to origin/$BRANCH."
    exit 1
  fi
  DEPLOY_TARGET="$DEPLOY_REVISION"
fi
git reset --hard "$DEPLOY_TARGET"
CANDIDATE_REVISION="$(git rev-parse HEAD)"
if [ -n "$DEPLOY_REVISION" ] && [ "$CANDIDATE_REVISION" != "$DEPLOY_REVISION" ]; then
  echo "Error: checked out revision does not match the requested deployment revision."
  exit 1
fi
export APP_VERSION="$CANDIDATE_REVISION"

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

read_env_value() {
  local name="$1"
  grep -E "^[[:space:]]*${name}=" .env | tail -n 1 | cut -d= -f2- | \
    tr -d '[:space:]\"' | tr -d "'"
}

WEB_CONCURRENCY_VALUE="$(read_env_value WEB_CONCURRENCY || true)"
WEB_CONCURRENCY_VALUE="${WEB_CONCURRENCY_VALUE:-2}"
if [ "$WEB_CONCURRENCY_VALUE" != "2" ]; then
  echo "Error: WEB_CONCURRENCY must be 2 for the validated first cluster increment."
  exit 1
fi

CLUSTER_SECURITY_READY_VALUE="$(read_env_value CLUSTER_SECURITY_READY || true)"
if [ "$CLUSTER_SECURITY_READY_VALUE" != "true" ]; then
  echo "Error: CLUSTER_SECURITY_READY=true is required before deploying two workers."
  echo "Enable it only for the controlled US2/US3 cluster exercises, then keep it after they pass."
  exit 1
fi

SHUTDOWN_TIMEOUT_VALUE="$(read_env_value SHUTDOWN_TIMEOUT_MS || true)"
SHUTDOWN_TIMEOUT_VALUE="${SHUTDOWN_TIMEOUT_VALUE:-15000}"
case "$SHUTDOWN_TIMEOUT_VALUE" in
  *[!0-9]*|'')
    echo "Error: SHUTDOWN_TIMEOUT_MS must be an integer."
    exit 1
    ;;
esac
if [ "$SHUTDOWN_TIMEOUT_VALUE" -lt 5000 ] || [ "$SHUTDOWN_TIMEOUT_VALUE" -gt 120000 ]; then
  echo "Error: SHUTDOWN_TIMEOUT_MS must be between 5000 and 120000."
  exit 1
fi

PORT_VALUE="$(read_env_value PORT || true)"
PORT_VALUE="${PORT_VALUE:-3000}"
case "$PORT_VALUE" in
  *[!0-9]*|'')
    echo "Error: PORT must be an integer."
    exit 1
    ;;
esac
if [ "$PORT_VALUE" -lt 1 ] || [ "$PORT_VALUE" -gt 65535 ]; then
  echo "Error: PORT must be between 1 and 65535."
  exit 1
fi

export WEB_CONCURRENCY="$WEB_CONCURRENCY_VALUE"
export SHUTDOWN_TIMEOUT_MS="$SHUTDOWN_TIMEOUT_VALUE"

LOCAL_READY_URL="http://127.0.0.1:${PORT_VALUE}/api/health/ready"
install_and_build() {
  if [ -f package-lock.json ]; then
    "$NPM_BIN" ci
  else
    "$NPM_BIN" install
  fi
  "$NPM_BIN" run build
}

verify_cluster_ready() {
  local expected_revision="$1"
  local ready_instance_ids=""
  local observed_ready_workers=""
  local unique_ready_workers="0"
  local online_workers="0"
  export APP_VERSION="$expected_revision"

  for ((attempt = 1; attempt <= LOCAL_READY_ATTEMPTS; attempt += 1)); do
    local ready_output=""
    if ready_output="$(curl -sS --connect-timeout 2 --max-time 5 -w $'\n%{http_code}' "$LOCAL_READY_URL")"; then
      local ready_status="${ready_output##*$'\n'}"
      local ready_body="${ready_output%$'\n'*}"
      if [ "$ready_status" = "200" ]; then
        local ready_worker
        ready_worker="$(printf '%s' "$ready_body" | "$NODE_BIN" -e '
          let body = "";
          process.stdin.setEncoding("utf8");
          process.stdin.on("data", chunk => { body += chunk; });
          process.stdin.on("end", () => {
            try {
              const health = JSON.parse(body);
              const version = typeof health.version === "string" ? health.version : "unknown";
              const instanceId = typeof health.instanceId === "string" && /^[A-Za-z0-9._:-]{1,96}$/.test(health.instanceId)
                ? health.instanceId
                : "invalid-instance";
              process.stdout.write(`${version}|${instanceId}`);
            } catch {}
          });
        ')"
        if [ -n "$ready_worker" ]; then
          observed_ready_workers="${observed_ready_workers}${ready_worker}\n"
          local ready_version="${ready_worker%%|*}"
          local ready_instance_id="${ready_worker#*|}"
          if [ "$ready_version" = "$expected_revision" ] && [ "$ready_instance_id" != "invalid-instance" ]; then
            ready_instance_ids="${ready_instance_ids}${ready_instance_id}\n"
          fi
        fi
      fi
    fi
    unique_ready_workers="$(printf '%b' "$ready_instance_ids" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')"
    online_workers="$("$PM2_BIN" jlist | "$NODE_BIN" -e '
      let body = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", chunk => { body += chunk; });
      process.stdin.on("end", () => {
        try { process.stdout.write(String(JSON.parse(body).filter(item => item.name === process.env.PM2_APP_NAME && item.pm2_env && item.pm2_env.status === "online").length)); }
        catch { process.stdout.write("0"); }
      });
    ')"
    if [ "$unique_ready_workers" -ge 2 ] && [ "$online_workers" -eq 2 ]; then return 0; fi
    if [ "$attempt" -lt "$LOCAL_READY_ATTEMPTS" ]; then sleep "$LOCAL_READY_DELAY_SECONDS"; fi
  done
  echo "Error: expected revision did not become ready on both workers."
  echo "Expected revision: $expected_revision"
  echo "Observed ready workers:"
  printf '%b' "$observed_ready_workers" | sed '/^$/d' | sort -u
  echo "PM2 application state:"
  "$PM2_BIN" jlist | "$NODE_BIN" -e '
    let body = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => { body += chunk; });
    process.stdin.on("end", () => {
      try {
        const apps = JSON.parse(body)
          .filter(item => item.name === process.env.PM2_APP_NAME)
          .map(item => ({
            id: item.pm_id,
            status: item.pm2_env?.status || "unknown",
            version: item.pm2_env?.APP_VERSION || "missing",
            instance: item.pm2_env?.NODE_APP_INSTANCE || "missing"
          }));
        process.stdout.write(JSON.stringify(apps));
      } catch { process.stdout.write("unavailable"); }
    });
  '
  echo
  return 1
}

has_expected_cluster_shape() {
  "$PM2_BIN" jlist | "$NODE_BIN" -e '
    let body = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => { body += chunk; });
    process.stdin.on("end", () => {
      try {
        const apps = JSON.parse(body).filter(item => item.name === process.env.PM2_APP_NAME);
        const valid = apps.length === 2 && apps.every(item =>
          item.pm2_env && item.pm2_env.exec_mode === "cluster_mode"
        );
        process.exit(valid ? 0 : 1);
      } catch {
        process.exit(1);
      }
    });
  '
}

start_or_reload_cluster() {
  if has_expected_cluster_shape; then
    "$PM2_BIN" startOrReload ecosystem.config.cjs --update-env
    return
  fi

  echo "Migrating the existing PM2 process to the validated two-worker cluster."
  "$PM2_BIN" delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
  "$PM2_BIN" start ecosystem.config.cjs --update-env
}

verify_legacy_runtime() {
  local legacy_health_url="http://127.0.0.1:${PORT_VALUE}/api/health"

  for ((attempt = 1; attempt <= LOCAL_READY_ATTEMPTS; attempt += 1)); do
    local legacy_status="000"
    if ! legacy_status="$(curl -sS --connect-timeout 2 --max-time 5 \
      -o /dev/null -w '%{http_code}' "$legacy_health_url")"; then
      legacy_status="000"
    fi

    if [ "$legacy_status" = "200" ]; then return 0; fi
    if [ "$attempt" -lt "$LOCAL_READY_ATTEMPTS" ]; then
      sleep "$LOCAL_READY_DELAY_SECONDS"
    fi
  done

  echo "Error: the restored legacy revision did not become healthy."
  return 1
}

restore_previous_runtime() {
  # A revision created before the cluster rollout may expose only /api/health.
  # Recreate it from its own ecosystem file, then prefer the strict cluster
  # proof and accept the compatibility probe only for this rollback path.
  "$PM2_BIN" delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
  "$PM2_BIN" start ecosystem.config.cjs --update-env

  if verify_cluster_ready "$PREVIOUS_REVISION"; then return 0; fi
  verify_legacy_runtime
}

verify_public_cors() {
  if [ "$VERIFY_PUBLIC_API" != "true" ]; then return 0; fi
  CORS_HEADERS="$(mktemp)"
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
    rm -f "$CORS_HEADERS"
    return 1
  fi
  rm -f "$CORS_HEADERS"
}

rollback_candidate() {
  if [ -z "$PREVIOUS_REVISION" ] || [ "$PREVIOUS_REVISION" = "$CANDIDATE_REVISION" ]; then
    echo "decision=rollback-failed reason=no-previous-revision"
    return 1
  fi
  echo "Candidate failed; restoring the previous revision."
  git reset --hard "$PREVIOUS_REVISION" || return 1
  export APP_VERSION="$PREVIOUS_REVISION"
  install_and_build || return 1
  restore_previous_runtime || return 1
  verify_public_cors || return 1
  "$PM2_BIN" save || return 1
  echo "decision=rolled-back candidate=$CANDIDATE_REVISION restored=$PREVIOUS_REVISION"
}

rollback_on_error() {
  local failure_status="$?"
  trap - ERR
  if ! rollback_candidate; then
    echo "decision=rollback-failed candidate=$CANDIDATE_REVISION"
  fi
  exit "$failure_status"
}

trap rollback_on_error ERR
install_and_build

if [ "$SEED_HUB_DEMO" = "true" ]; then
  echo "Loading the idempotent Hub demonstration dataset..."
  HUB_DEMO_SEED_CONFIRM="SEED_165_DEMO_RECORDS" "$NPM_BIN" run hub:seed-demo
fi

start_or_reload_cluster
verify_cluster_ready "$CANDIDATE_REVISION"
verify_public_cors
"$PM2_BIN" save
trap - ERR

echo "decision=promoted candidate=$CANDIDATE_REVISION"
echo "OneHealth backend deployment completed."
