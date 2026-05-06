# Arquitectura de producto — escritorio instalable + licenciamiento fuerte + datos centralizados (opcional)

**Estado:** modelo de producto **definitivo orientativo** (marco para roadmap).  
**Reemplaza como enfoque principal** al despliegue “servidor web compartido en LAN” como línea **principal** de go-to-market, por las razones de gobernanza de datos en disco del servidor que expusiste (acceso físico/lógico amplio a carpetas).

**MVP 1 (alcance cerrado actual):** desktop + API embebida + SQLite + licencia fuerte **sin Hub** — especificación técnica operativa en **[mvp1-desktop-tecnico.md](./mvp1-desktop-tecnico.md)**.

**Relación con el código actual:** `apps/desktop` empaqueta **Next + Nest embebido + SQLite** en `userData`; la evolución de licencia HMAC → JWT + revocación online está planificada por fases en ese documento.

---

## 1. Arquitectura final propuesta

### 1.1 Visión en una frase

**Cada vendedor** tiene una **aplicación de escritorio instalada** (Windows/macOS/Linux según prioridad comercial) que ejecuta la experiencia de usuario y **persiste datos de trabajo de forma local** cuando no hay red; las **integraciones con credencial** y la **validación fuerte de licencia** ocurren **dentro del binario / proceso de la app** (no en el navegador del usuario como cliente de APIs de terceros). Si la organización necesita **una sola fuente de verdad** para cotizaciones y catálogo, se usa un **servicio central dedicado** (nube del proveedor o instancia hospedada para el cliente), **no** carpetas compartidas ni sincronización ad-hoc PC a PC.

### 1.2 Componentes lógicos

| Componente | Rol |
|------------|-----|
| **Shell de escritorio** | Electron (u homólogo): ventana, auto-actualización, arranque de runtime local, almacenamiento seguro de secretos de app, integración con SO (instalador, firma de código). |
| **Frontend** | Next.js embebido (línea actual) o equivalente servido en localhost por el shell. |
| **Backend de negocio** | API Nest (misma base que hoy) ejecutándose **en la máquina del usuario** como subprocess o servicio local **o**, en despliegue híbrido, contra API remota **solo** si la política de licencia y red lo permite. **Objetivo:** empaquetar API+BD local para no depender de un servidor en oficina. |
| **Base de datos local** | SQLite (fase 1) o motor embebido equivalente; cifrado en reposo opcional (SQLCipher / contenedor) según amenaza. |
| **Servicio de licencias** (remoto) | Endpoint HTTPS del **emisor** (vos / operador del producto): activaciones, heartbeat, revocación, métricas mínimas. **No** almacena cotizaciones salvo que definas un producto SaaS explícito. |
| **Hub de sincronización** (remoto, opcional) | API REST/JSON propia, multi-inquilino o instancia dedicada por cliente: colas de cambios, versionado, resolución de conflictos. **Sustituye** el modelo “misma carpeta en red” o “copiar base entre PCs”. |

### 1.3 Flujo de datos (alto nivel)

```
[Vendedor PC]
  Instalador → App (Electron)
              → API local (Nest) + SQLite  ← trabajo offline
              → Internet opcional:
                    • Licencia (firma / CRL / heartbeat)
                    • APIs externas (Minenergía, NREL, …) desde el proceso backend local
                    • Hub sync (push/pull) si está contratado/habilitado
```

### 1.4 Principios de seguridad (producto)

1. **Credenciales de integraciones** solo en **configuración local protegida** del usuario/instalación (DPAPI Windows, keychain, o archivo con ACL fuerte), **nunca** en un recurso de red legible por “cualquiera en la oficina”.
2. **Clave privada de firma de licencias** solo en infra del **emisor**; la app incluye **solo clave pública** (o certificado) para verificar JWT.
3. **Separación:** “servidor web en LAN con carpetas accesibles” deja de ser el **contenedor de verdad** del modelo principal; el riesgo que mencionaste se mitiga al **no concentrar** datos sensibles en un volumen compartido administrativamente débil.

---

## 2. Modelo de licenciamiento (fuerte)

### 2.1 Artefacto: JWT firmado (RS256 o ES256)

Reutilizar el enfoque criptográfico ya alineado con **on-premise** en el repo (JWT + clave pública en cliente), pero con **claims orientados a dispositivo / instalación**:

| Claim / campo | Uso |
|-----------------|-----|
| `sub` / `licenseId` | Identificador de contrato o línea de licencia. |
| `iss`, `aud` | Emisor y audiencia (`desktop-app`, `org:xxx`). |
| `exp`, `nbf` | Vigencia dura; opcional ventana de gracia solo offline (ver §2.4). |
| `org_id` / `empresa` | Inquilino comercial. |
| `installationId` o `deviceBinding` | Identidad **de esta instalación** generada en primer arranque y **atada** al JWT en emisión o en paso de activación online. |
| `maxActivations` | Límite de equipos activos por licencia (controlado en servidor de licencias). |
| `entitlements` | Módulos (ej. FV avanzado, multiusuario local futuro). |
| `jti` | Id único del token para **revocación** (lista de denegación en servidor). |

### 2.2 Activación por equipo

- Cada instalación genera un **`installationId`** estable (derivado de secreto local + opcionalmente señales de hardware **no** PII agresivas: UUID almacenado en almacén seguro del SO).
- El emisor registra **activación** (incrementa contador, devuelve JWT acotado a ese `installationId` o firma un payload que incluye el id).
- **Límite por instalación/equipo:** el servidor de licencias rechaza nuevas activaciones si `activaciones_activas >= maxActivations` hasta que se **revoque** un dispositivo desde panel o soporte.

### 2.3 Revocación

| Mecanismo | Descripción |
|-----------|-------------|
| **Online** | En cada arranque o cada N horas, la app envía `jti` + `installationId`; el servidor responde `revoked` / HTTP 403 → la app entra en modo bloqueado o solo lectura según política. |
| **Lista de revocación cacheada** | TTL corto (ej. 24 h) + último estado bueno persistido para no bloquear por un fallo de red puntual (configurable). |
| **Emergencia** | Rotación de clave de firma en emisor + nuevos JWT; builds futuros pueden empaquetar nueva clave pública (major update). |

### 2.4 Modo offline y gracia

- Con **internet:** validación en línea periódica (heartbeat ligero).
- Sin internet: permitir uso si el JWT local sigue válido **criptográficamente** y `now < exp` **y** `now < lastSuccessfulOnlineCheck + graceDays` (ej. 7–14 días). Pasado ese plazo sin contacto: degradar (solo lectura) o bloquear según política comercial.

### 2.5 Autenticación de usuarios vs licencia

- **Licencia** = derecho a ejecutar el software y límites comerciales.  
- **Usuarios** (login app) = modelo operativo interno del cliente; puede convivir con licencia por máquina (un solo usuario local) o evolucionar a multiusuario **local** o **contra Hub** sin confundir ambos planos.

---

## 3. Flujo de activación (usuario final)

1. **Instalación** con instalador firmado (SmartScreen / Gatekeeper).
2. **Primer arranque:** la app muestra asistente: “Activar licencia”.
3. Generación/registro de **`installationId`** (y opcionalmente fingerprint no intrusivo).
4. El usuario **pega JWT** recibido por correo/portal **o** introduce **código de activación** que la app canjea por JWT vía HTTPS contra el servidor de licencias.
5. La app **verifica firma** con clave pública embebida, comprueba `exp`, `aud`, y que `installationId` del token coincide con el local (si aplica binding).
6. **Persistencia:** guardar token y metadatos en almacén **por usuario de Windows** / perfil, no en carpeta pública.
7. **Confirmación:** pantalla “Licencia activa hasta … / módulos …”.
8. Renovación: mismo flujo con nuevo JWT (reemplazo atómico del archivo/cache).

---

## 4. Qué queda local y qué queda remoto

| Local (PC del vendedor) | Remoto (internet / central) |
|-------------------------|-----------------------------|
| Binarios de la app, runtime Node embebido si aplica | Servidor de **licencias** (activación, heartbeat, revocación) |
| API Nest + SQLite (objetivo) o caché de trabajo | **APIs externas** llamadas **desde el backend local** (mismo patrón que servidor: no desde el navegador) |
| JWT de licencia cacheado, última validación online | **Hub de sincronización** (si existe producto multi-dispositivo) |
| Archivos adjuntos / logos en perfil de app | Backup opcional en almacenamiento objeto (S3/Blob) **si** el Hub lo define |
| Configuración no secreta (URL del Hub, modo offline) | Catálogo maestro **opcional** servido por Hub (precios, productos) |
| Secretos de integración (API keys cliente) en almacén seguro | Nada de claves privadas de **firma de licencia** |

**Nota:** si por velocidad de salida al mercado mantenés **una fase intermedia** donde el desktop sigue apuntando a `NEXT_PUBLIC_API_URL` remota, la **licencia fuerte** debe anclarse igual al **dispositivo** y/o a tu **servicio de licencias**, no solo al servidor del cliente.

---

## 5. Estrategia de actualización

1. **Canal estable / beta** (electron-updater o similar) contra almacenamiento firmado (ej. releases en bucket + firma).
2. **Paquetes firmados** a nivel SO (Authenticode / notarización Apple).
3. **Compatibilidad de esquema:** migraciones SQLite versionadas (mismo espíritu que Prisma migrate).
4. **Licencia:** tras actualizar, revalidar JWT; si cambia `aud` o versión mínima en token, forzar actualización (claim `min_app_version`).
5. **Sin depender del usuario para copiar carpetas:** todo por descarga incremental y reinicio de app.

---

## 6. Estrategia de sincronización (si aplica)

### 6.1 Cuándo hace falta

- Más de un vendedor y **necesidad de ver las mismas cotizaciones / clientes**.  
- Catálogo centralizado por gerencia.  
→ Ahí **no** usar SMB ni “base SQLite en carpeta compartida”. Usar **Hub**.

### 6.2 Diseño recomendado del Hub

- **Identidad:** `org_id` alineado al JWT de licencia.
- **Modelo de cambios:** cada entidad con `id`, `updated_at`, `version` o vector de versión; cliente envía **tombstones** para borrados.
- **Conflictos:** política por tipo — p. ej. cotizaciones: “último escritor gana” con registro de auditoría; o bloqueo optimista si dos editan el mismo borrador.
- **Frecuencia:** sync al abrir app, al guardar, y en background con backoff.
- **Offline:** cola local de operaciones; al reconectar, replay idempotente con ids de cliente.

### 6.3 Quién hospeda el Hub

| Opción | Ventaja | Coste |
|--------|---------|--------|
| **SaaS del proveedor** (multi-tenant) | Operación simple para el cliente | Vos operás y facturás |
| **Instancia dedicada** (VM/K8s del cliente) | Datos bajo control contractual del cliente | IT del cliente + soporte |
| **Sin Hub** | Cero infraestructura | Datos solo en cada PC (fragmentados) |

---

## 7. Riesgos y ventajas frente al modelo “servidor web en LAN”

### Ventajas del escritorio + licencia fuerte

- **Menor exposición por carpeta compartida:** no hay “un servidor donde cualquiera con acceso físico o cuenta amplia ve toda la BD y uploads”.
- **Offline real** para demos y sitios con internet intermitente.
- **Revocación y límites por equipo** alineados a modelo comercial B2B tradicional.
- **Superficie de ataque LAN** reducida (no dependés de que IT endurezca un servidor interno).

### Riesgos / costes del escritorio

- **Fragmentación de datos** si no implementás Hub: cotizaciones duplicadas, informes inconsistentes.
- **Soporte:** más variabilidad (antivirus, permisos, versiones de SO) que un solo servidor.
- **Backup:** cada usuario debe tener política de backup local **o** confiar en el Hub + exportaciones.
- **Integraciones:** siguen requiriendo salida HTTPS desde **cada** PC (no solo desde un servidor); firewall perimetral por sede puede afectar.
- **Cumplimiento:** datos en laptops pueden exigir **disco cifrado** (BitLocker) y MDM; documentarlo en contrato/soporte.

### Comparación directa con servidor web (tu preocupación central)

| Tema | Servidor web LAN | Escritorio (esta propuesta) |
|------|------------------|----------------------------|
| Quién puede leer datos en disco | Administradores del servidor + cualquiera con acceso a backups/volumen | Usuario del PC + admins de ese equipo; Hub concentrado si existe |
| Modelo de amenaza “oficina abierta” | Carpetas del servidor visibles | Datos bajo perfil de usuario / cifrado |
| Coste operativo IT cliente | Alto (servidor, proxy, PG) | Medio (instalaciones + opcional Hub) |

---

## 8. Próximos pasos sugeridos (implementación)

1. Formalizar **servidor de licencias** mínimo (activación + heartbeat + revocación por `jti`) independiente del Hub.
2. Roadmap **desktop embebido:** empaquetar API + SQLite en el mismo instalador (o subprocess arrancado por Electron).
3. Definir si el **primer release** comercial es “solo local sin sync” o “local + Hub beta”.
4. Ajustar documentación en `apps/docs/servidores-locales/` como **línea secundaria** (clientes que aún quieran servidor único) sin contradecir este documento.

---

*Documento de producto / arquitectura. Para detalle de spike de licencia on-premise en servidor, seguir usando `apps/docs/servidores-locales/spike-licencia-on-premise-v1.md` solo como referencia de formato JWT y guards, adaptando claims a `DESKTOP`.*
