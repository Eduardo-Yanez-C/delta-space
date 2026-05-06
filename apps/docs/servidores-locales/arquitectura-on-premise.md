# Arquitectura on-premise (objetivo)

## Visión en una frase

Un **servidor dentro de la red de la empresa** ejecuta backend, base de datos y almacenamiento; los **usuarios de oficina** trabajan desde el **navegador** apuntando a ese servidor. La **licencia** se asocia a esa instalación y la valida el backend — no cada PC por separado.

---

## Diagrama lógico (objetivo)

```
[PC usuario A] ──┐
[PC usuario B] ──┼── LAN ──► [Reverse proxy opcional :443]
[Admin licencia] ┘              │
                                ▼
                    [Servidor: Frontend estático / SSR]
                                │
                                ▼
                    [Servidor: Backend API :puerto]
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            [PostgreSQL u otro BD      [Storage local
             motor cliente/servidor]     uploads/ PDFs / logos]
```

---

## Componentes

| Componente | Rol |
|------------|-----|
| **Frontend web interno** | HTML/JS/CSS o app Next servida para la URL interna; todas las llamadas API van al backend del mismo servidor (o hostname interno conocido). |
| **Backend interno** | Única fuente de reglas de negocio, auth JWT/sesión, Prisma u ORM contra BD central, lectura/escritura de licencia, servicio de archivos. |
| **Base de datos central** | Estado transaccional compartido: usuarios, cotizaciones, plantillas, estudios FV, perfil empresa, etc. Un proceso servidor, no un archivo `.db` en carpeta compartida. |
| **Storage local del servidor** | Directorio(s) en disco del servidor para binarios (logos, adjuntos, exports, capturas). Backup periódico hacia otro medio (incl. opcional copia a Drive como **respaldo**, no como runtime). |
| **Red interna (LAN/VLAN)** | Acceso HTTP/HTTPS; idealmente nombre DNS interno (`cotizaciones.empresa.local`) o IP fija documentada. |

---

## Relación con usuarios de oficina

- Cada usuario **no instala** base de datos ni “abre el portable” para trabajar en datos compartidos.
- El **mismo código** de aplicación web que hoy se usa en desarrollo se **construye** (`build`) y se **sirve** desde el servidor (o desde un contenedor detrás del mismo host).
- El **administrador** que carga la licencia usa el mismo frontend desde su PC, con un rol restringido (ver `licenciamiento-on-premise.md`).

---

## Lo que **no** es esta arquitectura

| Anti-patrón | Por qué se descarta |
|---------------|---------------------|
| Portable en **carpeta de red SMB** y varios usuarios ejecutando instancias | Condiciones de carrera, bloqueos de SQLite, licencia por máquina inconsistente, sin único backend. |
| SQLite **archivo compartido** por red | Ver `base-de-datos-interna.md`: no es motor multiusuario cliente/servidor. |
| Google Drive como **directorio de trabajo vivo** de la app | Latencia, conflictos, sin transacciones ACID centralizadas; como backup sí, no como runtime. |
| “Sin licencia porque es interno” | **Rechazado:** el producto sigue siendo software licenciado; la modalidad es **ON_PREMISE**, no gratuito. |

---

## Dependencias con el estado actual del código

Hoy el backend puede usar **SQLite** en desarrollo/portable. El objetivo on-premise asume **cambio de `DATABASE_URL`** y migraciones Prisma hacia **PostgreSQL** (u otro motor soportado) en fase de implementación — fuera del alcance de solo documentar.

---

## Próximas lecturas

- `backend-interno.md`, `frontend-web-interno.md`, `base-de-datos-interna.md`, `storage-local-servidor.md`, `licenciamiento-on-premise.md`.
