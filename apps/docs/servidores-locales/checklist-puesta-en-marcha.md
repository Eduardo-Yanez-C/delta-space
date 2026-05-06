# Checklist — puesta en marcha (servidor local on-premise)

Usar antes de declarar **operativo** el sistema en la red interna. Marcar ítems según avance.

---

## Infraestructura

- [ ] Servidor accesible solo desde red prevista (LAN/VPN).
- [ ] DNS interno o IP documentada para usuarios.
- [ ] HTTPS configurado (recomendado) o excepción formal documentada si solo HTTP.
- [ ] Firewall: puertos mínimos abiertos; BD no expuesta a Internet.

---

## Base de datos

- [ ] PostgreSQL (u otro motor aprobado) instalado y endurecido.
- [ ] `DATABASE_URL` configurada; migraciones aplicadas.
- [ ] Datos migrados desde entorno anterior (si aplica) y verificados.
- [ ] Backup automático de BD programado y **restauración probada** al menos una vez.

---

## Backend

- [ ] API arranca como servicio y se reinicia con el SO.
- [ ] Logs accesibles para soporte.
- [ ] `JWT_SECRET` y secretos no están en repositorio.
- [ ] CORS alineado con URL real del frontend.
- [ ] Health check responde OK desde otra máquina en LAN.

---

## Frontend

- [ ] Build con `NEXT_PUBLIC_API_URL` apuntando al API correcto para usuarios finales.
- [ ] Login funciona desde PC de usuario típico (no solo desde el servidor).
- [ ] Flujo crítico probado: crear/editar cotización STANDARD y/o MARGIN según licencia.

---

## Storage

- [ ] Directorio de uploads existe y el proceso del API puede escribir.
- [ ] Logo / archivo de prueba subido y visible en vista previa.
- [ ] Backup incluye carpeta de storage además de BD.

---

## Seguridad y acceso

- [ ] Cuentas de usuario creadas; roles asignados correctamente.
- [ ] No hay cuentas de prueba con password débil en producción.
- [ ] Procedimiento de revocación de acceso documentado.

---

## Licencia on-premise (cuando exista implementación)

- [ ] `installationId` generado y registrado en proceso de emisión de licencia.
- [ ] Licencia cargada por admin autorizado.
- [ ] Backend rechaza peticiones si licencia inválida/expirada (comportamiento acordado).
- [ ] Usuarios no-admin no ven pantallas de gestión de licencia.

---

## Separación de estrategias (verificación conceptual)

- [ ] Nadie usa **portable en carpeta de red** como sustituto de este servidor.
- [ ] Nadie asume **Google Drive** como base de datos o storage en vivo.
- [ ] **Cloud pública** no es requisito para este despliegue.

---

## Handover

- [ ] URL interna comunicada a la oficina.
- [ ] Contacto de soporte / renovación de licencia indicado.
- [ ] Documentación `apps/docs/servidores-locales/` enlazada en wiki interna si aplica.

---

*Revisar este checklist tras cada actualización mayor de versión del software.*
