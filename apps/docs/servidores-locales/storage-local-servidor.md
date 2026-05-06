# Storage local del servidor

## Principio

Todo archivo que la aplicación **genera o recibe** (logos de empresa, capturas de implantación, PDFs exportados si se guardan, adjuntos futuros) debe vivir en **disco del servidor** bajo rutas controladas por el backend — no en el perfil del usuario ni en unidades de red mapeadas como “carpeta de trabajo” de la app.

---

## Qué tipo de contenido

| Tipo | Ejemplo en el producto actual | Ubicación conceptual |
|------|------------------------------|----------------------|
| Binarios subidos | Logo empresa (`uploads/...`) | Directorio writable por el proceso del API |
| Artefactos de documento | Previews, capturas si se persisten | Misma área o subcarpeta por tenant/instalación |
| Logs de aplicación | Archivos rotativos | Fuera del webroot o con acceso restringido |

---

## Por qué no depender del disco de cada usuario

- **Consistencia:** cualquier usuario ve el mismo logo y los mismos adjuntos.
- **Backup:** un solo conjunto de rutas a incluir en política de respaldo del servidor.
- **Permisos:** el servicio del backend corre con usuario de sistema limitado; no se requiere que cada PC tenga permisos de escritura en carpetas compartidas ad hoc.

---

## Separación storage servidor vs cliente

| Cliente (navegador) | Servidor |
|---------------------|----------|
| Solo sube/descarga vía HTTP multipart o descarga binaria | Valida, guarda, sirve archivos |
| Puede cachear en memoria/disco del navegador | Fuente de verdad en filesystem + metadatos en BD |

---

## Permisos y layout recomendado

- Ruta base configurable: ej. `/var/lib/cotizaciones-pfv/storage` (Linux) o `D:\AppData\CotizacionesPfv\storage` (Windows Server).
- Subdirectorios por dominio: `logos/`, `quotes/`, `implantation/` — alineado con código actual (`uploads` + subcarpetas).
- Usuario del servicio: solo lectura/escritura en esa rama; **sin** ejecución desde uploads.

---

## Backup

- Incluir **BD + directorio de storage** en la misma ventana de backup o con RPO alineado.
- **Google Drive** (u otro cloud) puede ser **destino de copia** de backups zip — no el filesystem montado desde la app en runtime.

---

## Referencias

- `backend-interno.md`, `seguridad-y-red.md`, `arquitectura-on-premise.md`.
