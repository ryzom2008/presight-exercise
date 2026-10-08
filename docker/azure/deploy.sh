#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# The renderer writes only validated, non-secret deployment values.
set -a
. ./.env
set +a
bash ./bootstrap.sh

# Prevent overlapping manual deployments, including from outside GitHub Actions.
exec 9>/var/lock/presight-deploy.lock
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }

export AZURE_CONFIG_DIR
export DOCKER_CONFIG
AZURE_CONFIG_DIR=$(mktemp -d)
DOCKER_CONFIG=$(mktemp -d)
trap 'rm -rf "$AZURE_CONFIG_DIR" "$DOCKER_CONFIG"' EXIT
az login --identity --allow-no-subscriptions --output none
az acr login --name presightdemo --output none

docker compose --env-file .env -f compose.yml config --quiet
docker compose --env-file .env -f compose.yml pull

# SQLite's backup API takes a consistent snapshot, including committed WAL data.
# Never copy only the .sqlite file while the application is running.
if docker volume inspect presight-demo_directory-data >/dev/null 2>&1; then
  install -d -m 0700 /opt/presight/backups
  backup_name="directory-$(date -u +%Y%m%dT%H%M%SZ).sqlite"
  docker run --rm --user 0 --entrypoint node \
    -e BACKUP_NAME="$backup_name" \
    -v presight-demo_directory-data:/app/data \
    -v /opt/presight/backups:/backups \
    "$APP_IMAGE" --input-type=module -e '
      import fs from "node:fs";
      import Database from "better-sqlite3";
      const path = "/app/data/directory.sqlite";
      if (fs.existsSync(path)) {
        const db = new Database(path, { readonly: true });
        try { await db.backup(`/backups/${process.env.BACKUP_NAME}`); }
        finally { db.close(); }
      }
    '
fi

if ! docker compose --env-file .env -f compose.yml up -d --wait --wait-timeout 180; then
  docker compose --env-file .env -f compose.yml logs --tail 40
  exit 1
fi

# Resolve to localhost here; the workflow separately verifies public DNS and HTTPS.
curl --fail --silent --show-error --retry 18 --retry-all-errors --retry-delay 5 \
  --connect-timeout 5 --max-time 15 \
  --resolve "$APP_DOMAIN:443:127.0.0.1" "https://$APP_DOMAIN/api/health"

if [ -L /opt/presight/current ]; then
  readlink /opt/presight/current > /opt/presight/previous-release
fi
ln -sfn "$PWD" /opt/presight/current
echo 'PRESIGHT_DEPLOY_SUCCEEDED'
