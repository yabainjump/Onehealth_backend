#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/public_html/backend.onehealthnetwork.yaba-in.com}"
REPO_URL="${REPO_URL:-https://github.com/yabainjump/Onehealth_backend.git}"
BRANCH="${BRANCH:-main}"
NODE_BIN_DIR="${NODE_BIN_DIR:-/opt/cpanel/ea-nodejs18/bin}"
NPM_BIN="${NPM_BIN:-$NODE_BIN_DIR/npm}"
NODE_BIN="${NODE_BIN:-$NODE_BIN_DIR/node}"
PM2_BIN="${PM2_BIN:-pm2}"
PM2_APP_NAME="${PM2_APP_NAME:-onehealth-backend}"

mkdir -p "$APP_DIR"
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

# Keep local deployment script clean to avoid merge conflicts on pull.
git restore deploy-onehealth-backend.sh >/dev/null 2>&1 || true

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

if [ -f package-lock.json ]; then
  "$NPM_BIN" ci
else
  "$NPM_BIN" install
fi

"$NPM_BIN" run build

if "$PM2_BIN" describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  "$PM2_BIN" restart "$PM2_APP_NAME" --update-env
else
  "$PM2_BIN" start dist/main.js \
    --interpreter "$NODE_BIN" \
    --name "$PM2_APP_NAME"
fi

"$PM2_BIN" save

echo "OneHealth backend deployment completed."
