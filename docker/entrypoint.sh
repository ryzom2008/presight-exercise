#!/bin/sh
set -eu

# The seed command preserves an existing directory unless explicitly reset.
node /app/server/dist/db/seed-cli.js
exec "$@"
