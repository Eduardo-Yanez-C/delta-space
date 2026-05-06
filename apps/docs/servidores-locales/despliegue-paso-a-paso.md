# Despliegue paso a paso (orden recomendado — futuro)

Este documento describe el **orden lógico** para pasar del estado actual (dev/portable/SQLite) a un **servidor interno operativo**. No sustituye runbooks detallados de IT ni scripts de automatización.

---

## Fase 0 — Preparación (sin cambiar producción aún)

1. Aprobar **nombre DNS interno** o IP fija del servidor.
2. Dimensionar **VM o hardware** (CPU/RAM/disco) según nº de usuarios concurrentes.
3. Revisar `README.md` y `licenciamiento-on-premise.md` con stakeholders.

---

## Fase 1 — Servidor base

1. Instalar SO soportado (Windows Server o Linux LTS).
2. Crear usuario de servicio sin privilegios admin.
3. Configurar **firewall** (solo puertos necesarios).
4. Preparar **directorios** de aplicación y storage (ver `storage-local-servidor.md`).

---

## Fase 2 — Base de datos

1. Instalar **PostgreSQL** (o motor aprobado).
2. Crear BD y usuario con permisos mínimos.
3. Definir `DATABASE_URL` en entorno seguro.
4. Ejecutar migraciones Prisma (`migrate deploy`) desde pipeline o servidor.
5. **Migración de datos** desde SQLite si aplica (script dedicado, ventana de mantenimiento).

---

## Fase 3 — Backend

1. Build del API (`npm run build` o equivalente).
2. Configurar **process manager** (systemd, PM2, Windows Service).
3. Cargar variables de `variables-entorno-ejemplo.md` (valores reales).
4. Verificar health y login contra BD vacía o datos migrados.

---

## Fase 4 — Frontend

1. Build de Next con `NEXT_PUBLIC_API_URL` correcto.
2. Servir estáticos o `next start` detrás del mismo proxy.
3. Probar desde **otra máquina en LAN** login + flujo cotización de prueba.

---

## Fase 5 — Storage y backups

1. Confirmar escritura en `UPLOADS_ROOT`.
2. Subir logo de prueba (datos de empresa).
3. Programar **backup** BD + carpeta storage.
4. Opcional: copia cifrada a **Google Drive** solo como archivo de backup.

---

## Fase 6 — Licencia on-premise (cuando esté implementada)

1. Generar o recibir **installationId** del servidor.
2. Emitir licencia firmada (`ON_PREMISE`, fechas, límites).
3. Cargar desde UI **admin** autorizado.
4. Verificar middleware de expiración y mensajes.

---

## Fase 7 — Validación y cierre

1. Recorrer `checklist-puesta-en-marcha.md`.
2. Capacitación breve a usuarios (URL interna, sin portable compartido).
3. Documentar contacto de soporte y procedimiento de renovación de licencia.

---

## Lo que este plan **no** hace todavía

- No ejecuta comandos en su nombre.
- No elige proveedor cloud público.
- No reemplaza documentación legal de licenciamiento con el cliente final.

---

## Referencias

Todos los demás `.md` de esta carpeta.
