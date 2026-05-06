# Seguridad y red (on-premise)

## Alcance

Principios mínimos para desplegar el sistema en **red interna** sin exponer innecesariamente superficie de ataque. No sustituye política de seguridad corporativa ni pentest.

**Arquitectura de tráfico (clientes → servidor → APIs externas):** el modelo operativo **opción 1** (paquete servidor) está descrito en detalle en `apps/deploy/servidor-local/PAQUETE_SERVIDOR_DEFINICION.md` — **§0 Arquitectura de red, clientes e integraciones**: acceso web por LAN, salida a internet solo desde el backend, secretos en `apps/api/.env`, y lista de excepciones donde el navegador sí contacta terceros (p. ej. teselas de mapas públicas).

---

## Acceso LAN

- El servidor de aplicación y BD debe residir en **VLAN/subred** alcanzable solo desde estaciones de trabajo de la empresa (o VPN si hay teletrabajo).
- **No** publicar puertos de API o PostgreSQL directamente a Internet sin controles (DMZ, VPN, WAF) — decisión explícita de IT.

---

## Autenticación y roles

- Se mantiene el modelo actual: **usuarios autenticados**, **JWT** (o evolución documentada), **roles y permisos** (admin, vendedor, etc.).
- **Licencia:** gestión solo por roles altos; usuarios operativos no cargan ni ven secretos de licencia (ver `licenciamiento-on-premise.md`).

---

## HTTPS interno

- Recomendado **TLS** también en intranet para evitar credenciales y tokens en claro en la LAN.
- Opciones: certificado de CA interna, Let's Encrypt DNS interno si aplica, o reverse proxy corporativo que termina TLS.

---

## Firewall en el servidor

- Abrir solo puertos necesarios (ej. 443 al proxy, 5432 solo localhost si BD en mismo host).
- Denegar por defecto; reglas explícitas para administración SSH/RDP desde IPs bastion.

---

## Backups y disponibilidad

- **Backup automatizado** de BD + storage (ver `storage-local-servidor.md`).
- Probar **restauración** al menos una vez antes de producción.
- Documentar RPO/RTO acordados con el negocio.

---

## Hardening básico del host

- SO actualizado, antivirus/EDR según política.
- Usuario de servicio sin privilegios administrativos.
- Rotación de secretos (`JWT_SECRET`, claves de firma de licencia) según procedimiento interno.

---

## Separación de entornos

- **Producción interna** ≠ máquina de desarrollo del equipo de producto.
- Datos reales de clientes solo en servidor controlado.

---

## Referencias

- `backend-interno.md`, `licenciamiento-on-premise.md`, `checklist-puesta-en-marcha.md`.
