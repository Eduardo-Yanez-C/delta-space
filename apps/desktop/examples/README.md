# Licencias de ejemplo (pruebas internas)

- **`licencia-prueba-LIC-TRIAL-0001.json`**: prueba comercial **5 días hábiles**, tipo `TRIAL_EXTENSION`, `licenseId` **LIC-TRIAL-0001**. Firmada con el secreto por defecto del código (sin `LICENSE_HMAC_SECRET` en el entorno). Válida solo si el portable usa ese mismo secreto.

- **`renovacion-prueba-interna.json`**: licencia `INTERNAL` de ejemplo (fecha lejana). Mismo criterio de secreto.

## Regenerar la prueba de 5 días hábiles

```bash
cd apps/desktop
# Opcional: mismo secreto que en el build de producción
# set LICENSE_HMAC_SECRET=tu-secreto
node scripts/generate-license.js --id LIC-TRIAL-0001 --business-days 5 --type TRIAL_EXTENSION --nota "Ejemplo prueba" --out examples/licencia-prueba-LIC-TRIAL-0001.json
```

## Regenerar renovación con fecha fija

```bash
node scripts/generate-license.js --id LIC-INTERNAL-DEMO-001 --until 2030-12-31 --type INTERNAL --out examples/renovacion-prueba-interna.json
```

**No** subas a repositorio público un secreto real ni licencias firmadas con claves de producción.
