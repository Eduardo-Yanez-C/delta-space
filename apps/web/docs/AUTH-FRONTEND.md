# Autenticación en frontend (Etapa 5)

## Persistencia del token

El token JWT se guarda en **localStorage** bajo la clave `pv_quoting_token`.  
**Decisión temporal para MVP**: en producción se valorará usar cookie httpOnly u otro mecanismo más seguro para evitar XSS sobre el token.

## Flujo

- **Login**: POST /api/auth/login → se guarda `accessToken` en estado y en localStorage, se actualiza `setAuthToken()` para las peticiones API, redirección a `/`.
- **Recarga**: al montar `AuthProvider`, se lee el token de localStorage, se llama a GET /api/auth/me; si responde OK se rehidrata el usuario; si responde 401 se borra token y se deja sin usuario (el guard redirige a /login).
- **Token inválido o expirado**: getMe() devuelve 401 → se limpia token en memoria y localStorage y usuario → el usuario queda `null` y el guard redirige a /login.

## Rutas

- `/login`: única ruta pública. Si ya hay sesión, se redirige a `/`.
- Resto de rutas: requieren sesión; si no hay usuario tras terminar la carga inicial, redirección a `/login`.

## Usuario sin roles

Si el backend devuelve un usuario con `roles: []`, no se bloquea el login; el estado queda con `user.roles === []` para posibles decisiones futuras (por ejemplo ocultar acciones).
