#!/bin/sh
# Arranque en Railway: migraciones con las MISMAS variables de runtime que Nest (evita pre-deploy sin env).
set -e
cd /app

if [ "${SKIP_PRISMA_DEPLOY:-0}" = "1" ]; then
  echo "[docker-entrypoint] SKIP_PRISMA_DEPLOY=1 — omitiendo migraciones."
else
  node apps/api/scripts/prisma-migrate-deploy.mjs
fi

exec npm run start --workspace=api
