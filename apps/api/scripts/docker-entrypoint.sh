#!/bin/sh
# Arranque en Railway: migraciones y Nest viven en `npm run start` del workspace api
# (`prisma-migrate-deploy.mjs || …; node dist/main.js`). No ejecutar migrate aquí con `set -e`:
# si migrate falla, el proceso moría antes de Nest y el healthcheck veía 503 hasta timeout.
cd /app

if [ "${SKIP_PRISMA_DEPLOY:-0}" = "1" ]; then
  echo "[docker-entrypoint] SKIP_PRISMA_DEPLOY=1 — solo API (sin prisma deploy al inicio)."
  exec npm run start:app --workspace=api
else
  exec npm run start --workspace=api
fi
