# Storage: local → Supabase (roadmap)

## Implementado

- `ObjectStorageService` (`apps/api/src/infra/object-storage/object-storage.service.ts`)
  - `STORAGE_DRIVER=local` (default): escribe bajo `LOCAL_UPLOADS_DIR` (default `uploads/`).
  - `STORAGE_DRIVER=supabase`: sube vía **REST** de Supabase Storage (`fetch`), sin SDK extra. `SUPABASE_STORAGE_PUBLIC_READ=1` si el bucket es público y se desea `publicUrl` en la respuesta.

## Módulos que aún escriben en disco directamente (grep útil)

Ejecutar desde `apps/api`:

```powershell
rg "uploads|writeFile" src/modules
```

Prioridad típica:

1. `company-profile` — logo.
2. `conversations` — adjuntos de mensajes.
3. `implantation-design` — capturas.

## Pasos por módulo

1. Inyectar `ObjectStorageService` en el servicio.
2. Reemplazar `fs.writeFile` por `putObject({ key, body, contentType })`.
3. Persistir en BD `storageKey` (y `publicUrl` si aplica) en lugar de solo path local.
4. Servir o redirigir descargas: URL firmada de Supabase o proxy Nest según política de bucket.

## Producción

- `STORAGE_DRIVER=supabase`
- Bucket **no** público salvo logos: preferir URLs firmadas en una segunda iteración.
