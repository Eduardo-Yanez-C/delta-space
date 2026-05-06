# Base de datos interna (central)

## Objetivo

Un **único motor de base de datos cliente/servidor** alojado en el servidor (o en una VM de base de datos en la misma red), al que se conecta **solo** el backend. Todos los usuarios comparten el **mismo** estado transaccional.

---

## Por qué SQLite **no** es la opción correcta para multiusuario en red

SQLite es excelente para desarrollo, portable y **un solo proceso** que abre el archivo localmente.

Problemas al intentar “compartir” SQLite en red:

1. **Concurrencia real:** múltiples procesos en distintas máquinas sobre un archivo en SMB/NFS provocan bloqueos, corrupción o comportamiento indefinido; SQLite no está diseñado como servidor de red multi-cliente remoto.
2. **Rendimiento:** latencia de red sobre archivo compartido degrada cada transacción.
3. **Operación:** backups con archivo en uso, antivirus bloqueando el `.db`, permisos de carpeta — frágil para producción.
4. **Escalabilidad:** sin réplicas ni herramientas estándar de HA como en PostgreSQL.

**Conclusión:** para **varios usuarios** en oficina contra **un** sistema, la base debe ser **servidor de BD**, no archivo compartido.

---

## Recomendación: PostgreSQL

| Criterio | PostgreSQL |
|----------|------------|
| Soporte Prisma | Primera clase |
| Transacciones / integridad | Fuerte |
| Backup / PITR | Herramientas maduras (`pg_dump`, WAL) |
| Coste | Open source, sin licencia de motor para uso interno |
| Alternativas | SQL Server / MySQL si política IT lo exige; documentar desviación |

---

## Por qué una BD central es mejor que “archivo local por usuario”

- **Una verdad** para cotizaciones, clientes, precios y plantillas.
- **Auditoría** y reportes coherentes.
- **Roles** alineados con una sola identidad de usuario en BD.

---

## Migración desde el estado actual (cuando se implemente)

- Definir `DATABASE_URL` PostgreSQL en servidor.
- Ejecutar `prisma migrate deploy` contra PostgreSQL.
- **Estrategia de datos:** migración one-shot desde SQLite export/import o script — plan específico fuera de este documento.
- Probar en entorno de staging interno antes de producción.

---

## Relación con Google Drive

Drive puede guardar **exports de backup** (`.sql`, `.dump`), no ser el archivo vivo de la BD.

---

## Referencias

- `arquitectura-on-premise.md`, `despliegue-paso-a-paso.md`, `checklist-puesta-en-marcha.md`.
