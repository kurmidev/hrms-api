#!/usr/bin/env bash
# HRMS backend deploy script.
#
# Run this AFTER new code is already on the server (git pull / rsync / CI
# artifact — this script does not fetch code itself). It installs deps,
# regenerates the Prisma client, applies pending migrations, runs the seed
# script, rebuilds, and reloads the pm2-managed process.
#
# Usage:
#   ./scripts/deploy.sh
#
# Env vars:
#   SKIP_SEED=true   Skip `npm run prisma:seed` (default: false, seed runs every deploy —
#                     the seed script is idempotent/upsert-based, safe to re-run)
#   HEALTH_URL=...    Override the post-deploy health-check URL
#                     (default: http://localhost:<PORT from .env>/api/v1/health)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ pm2 is not installed or not on PATH. Install with: npm install -g pm2" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "❌ backend/.env not found. Copy .env.example and configure it before deploying." >&2
  exit 1
fi

echo "==> [backend] Installing dependencies (npm ci --include=dev)"
# --include=dev is required even in production: the prisma CLI, ts-node, and
# tsconfig-paths are all devDependencies, but this script (and the seed
# scripts) need them at deploy time. If NODE_ENV=production is set in the
# shell (common on prod hosts), a plain `npm ci` silently skips
# devDependencies and every `prisma`/`ts-node` invocation below fails with
# "command not found".
npm ci --include=dev

echo "==> [backend] Generating Prisma client"
npx prisma generate

echo "==> [backend] Applying database migrations (prisma migrate deploy)"
npx prisma migrate deploy

if [ "${SKIP_SEED:-false}" != "true" ]; then
  echo "==> [backend] Running seed script (idempotent — safe to re-run every deploy)"
  npm run prisma:seed
else
  echo "==> [backend] Skipping seed (SKIP_SEED=true)"
fi

echo "==> [backend] Building"
npm run build

echo "==> [backend] Reloading pm2 process (zero-downtime if already running, starts fresh otherwise)"
mkdir -p logs
pm2 startOrReload ecosystem.config.js --env production
pm2 save

PORT="$(grep -E '^PORT=' .env | cut -d '=' -f2 | tr -d '[:space:]')"
PORT="${PORT:-3001}"
API_PREFIX="$(grep -E '^API_PREFIX=' .env | cut -d '=' -f2 | tr -d '[:space:]')"
API_PREFIX="${API_PREFIX:-api/v1}"
HEALTH_URL="${HEALTH_URL:-http://localhost:${PORT}/${API_PREFIX}/health}"

echo "==> [backend] Health check: $HEALTH_URL"
sleep 2
if curl -fsS "$HEALTH_URL" >/dev/null; then
  echo "✅ Backend healthy"
else
  echo "❌ Health check failed — check: pm2 logs hrms-backend"
  exit 1
fi

echo "==> [backend] Deploy complete"
