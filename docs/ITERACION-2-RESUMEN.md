# Iteración 2 — Resumen de cambios respecto del MVP original

Documento de referencia interna que describe lo incorporado en la **Iteración 2** del proyecto: nuevo flujo comercial (Cliente → Estudio FV → Cotización), módulo de Estudios FV, convivencia con el cálculo FV en cotización y ajustes en cotizaciones y vista previa/PDF.

**Alcance de esta iteración:** desde el rediseño del flujo hasta la convivencia explícita entre FvStudy y QuoteFvCalculation (Fase 5).

---

## 1. Nuevo flujo comercial recomendado

### 1.1 Flujo objetivo

```
Cliente → Estudio FV → Cotización
```

1. **Cliente:** El usuario selecciona o crea un cliente (módulo Clientes ya existente).
2. **Estudio FV:** Desde el cliente o desde el menú "Estudios FV", crea un estudio fotovoltaico con:
   - Datos generales (título, mes de referencia, cuenta y consumo de referencia).
   - Parámetros tarifarios (valor kWh consumo, valor kWh inyección, moneda).
   - Parámetros técnicos (potencia por panel, cobertura deseada, HSP, PR, tipo de conexión, tipo de proyecto).
   - **Tabla mensual de 12 meses** (consumo kWh por mes; el sistema calcula generación, ahorro y pago estimado).
   - Resultados anuales (potencia sistema, cantidad de paneles, generación anual, ahorro anual, % ahorro, pago residual).
3. **Cotización:** Desde el detalle del estudio guardado, el usuario pulsa **"Crear cotización desde este estudio"**. El sistema crea una nueva cotización vinculada al estudio (`sourceFvStudyId`), con la misma cliente, título sugerido ("Cotización - [título del estudio]"), versión inicial y sin ítems. El resumen FV de la propuesta y del PDF se toma del estudio.

### 1.2 Dónde se refleja en la UI

- **Sidebar:** Orden que refuerza el flujo: **Dashboard → Clientes → Estudios FV → Cotizaciones** → Productos → Proveedores → Usuarios.
- **Clientes:** En el listado, acciones "Ver estudios FV" y "Nuevo estudio FV" (con cliente pre-seleccionado vía query).
- **Estudios FV:** Listado global (filtrable por cliente), crear / editar / ver detalle; en el detalle, botón "Crear cotización desde este estudio".
- **Cotizaciones:** Las creadas desde estudio muestran badge "Desde estudio" y enlace "Basado en Estudio FV: [título]" en cabecera y en el bloque de resumen FV.

---

## 2. Módulos nuevos incorporados

### 2.1 Módulo Estudios FV (FvStudy)

- **Backend**
  - Entidades: **FvStudy** (estudio por cliente, con status DRAFT / VALIDADO / COTIZADO / ARCHIVADO) y **FvStudyMonth** (12 registros por estudio, monthIndex 1–12, consumo/generación/ahorro/pago por mes).
  - Endpoints: `GET/POST /api/fv-studies`, `GET/PATCH/DELETE /api/fv-studies/:id`, `GET /api/clients/:id/fv-studies`, `POST /api/fv-studies/:id/create-quote`.
  - Cálculo en backend: a partir de consumos mensuales y parámetros, se calculan resultados mensuales y anuales (potencia, paneles, generación, ahorro, pago residual) y se persisten.
  - Permisos y ownership: lectura/escritura según roles; archivado lógico (status ARCHIVADO).

- **Frontend**
  - Rutas: `/estudios-fv` (listado), `/estudios-fv/nuevo`, `/estudios-fv/[id]` (detalle), `/estudios-fv/[id]/editar`.
  - Formulario de estudio: datos generales, tarifa, técnicos, **12 meses de consumo** (inputs por mes).
  - Detalle: KPIs (potencia, paneles, generación anual, ahorro anual, % ahorro, pago residual), tabla mensual de 12 meses, gráficos (generación vs consumo, pago estimado por mes).
  - Integración: ítem "Estudios FV" en el sidebar; en listado de clientes, "Ver estudios FV" y "Nuevo estudio FV".

### 2.2 Vinculación Cotización–Estudio

- En el modelo **Quote** se agregó **sourceFvStudyId** (opcional, FK a FvStudy).
- Al crear cotización desde estudio: se crea Quote + QuoteVersion inicial en una transacción, se asigna `sourceFvStudyId` y se actualiza el estudio a status **COTIZADO**.

---

## 3. Cambios en cotizaciones y vista previa/PDF

### 3.1 Cotizaciones

- **Creación desde estudio:** Nuevo flujo vía "Crear cotización desde este estudio" en el detalle del estudio. La cotización nace con cliente, título sugerido, tipo de proyecto y moneda del estudio, y con `sourceFvStudyId` apuntando al estudio.
- **Cabecera en detalle:** Si existe `sourceFvStudyId`, se muestra "Basado en Estudio FV: [título]" con enlace al estudio y badge **"Desde estudio"**. Si no hay estudio pero sí cálculo guardado en la versión, badge **"Desde cálculo rápido"**.
- **Bloque Resumen FV en detalle:**
  - Con estudio: título "Resumen FV (desde estudio)", KPIs cargados del estudio (fetch por `sourceFvStudyId`), enlace "Ver estudio" y texto de ayuda. El botón "Cálculo FV" se muestra **deshabilitado** con el texto: "Esta cotización usa un Estudio FV vinculado. Edite el estudio para cambiar el resumen FV."
  - Sin estudio y con QuoteFvCalculation: título "Resumen FV (cálculo en cotización)", KPIs del cálculo y botón "Ver detalle" (abre modal).
  - Sin estudio y sin cálculo: mismo título y mensaje: "Esta cotización no proviene de un estudio FV. Puede usar el cálculo rápido o crear un Estudio FV para un análisis más completo." Botón "Abrir cálculo FV" activo.
- **Listado:** Nueva columna **"Origen FV"** con badge "Desde estudio" cuando la cotización tiene `sourceFvStudyId`; "—" en el resto.

### 3.2 Vista previa e impresión/PDF

- **Origen del resumen FV:**  
  - Si la cotización tiene **sourceFvStudyId**, el bloque "Resumen fotovoltaico" se alimenta **solo** del **FvStudy** (GET al estudio por `sourceFvStudyId`). Se muestra "Basado en Estudio FV: [título del estudio]".  
  - Si **no** tiene sourceFvStudyId, el bloque usa **solo** **QuoteFvCalculation** de la versión actual (comportamiento del MVP).  
- **Regla:** En una misma vista previa/PDF **nunca** se muestran los dos orígenes; solo uno según exista o no `sourceFvStudyId`.

---

## 4. Convivencia de FvStudy con QuoteFvCalculation

### 4.1 Dos orígenes posibles del resumen FV

| Origen | Cuándo se usa | Dónde se muestra |
|--------|----------------|------------------|
| **FvStudy** | La cotización tiene `sourceFvStudyId` (fue creada desde un estudio). | Detalle de cotización, vista previa y PDF. Los datos se obtienen del estudio vinculado. |
| **QuoteFvCalculation** | La cotización no tiene `sourceFvStudyId` y el usuario guardó un cálculo desde el modal "Cálculo FV" en una versión. | Detalle de cotización, vista previa y PDF. Los datos se obtienen del registro QuoteFvCalculation. |

### 4.2 Reglas de prioridad y exclusividad

- **Una sola fuente por cotización/versión:** Si existe `sourceFvStudyId`, se usa **únicamente** el estudio (detalle y vista previa/PDF). Si no existe, se usa **únicamente** QuoteFvCalculation cuando exista para esa versión.
- **QuoteFvCalculation no se elimina:** Sigue operativo para cotizaciones creadas "a mano" (sin estudio). El modal "Cálculo FV" sigue disponible en esas cotizaciones; en las que vienen de estudio, el botón "Cálculo FV" está deshabilitado y con texto de ayuda.
- **Sin duplicar mensajes:** En ningún caso se muestran a la vez el resumen del estudio y el del cálculo en cotización.

---

## 5. Flujo recomendado vs cálculo rápido / legado

### 5.1 Flujo recomendado (nuevo)

- **Cliente → Estudio FV → Cotización.**
- El usuario crea o elige un cliente, luego un estudio FV con tabla de 12 meses y resultados anuales, y desde el estudio crea la cotización. El resumen FV de la propuesta y del PDF proviene del estudio.
- **Ventajas:** Estudio reutilizable, trazabilidad cliente–estudio–cotización, análisis mensual completo y coherencia con la planilla Excel de referencia.

### 5.2 Flujo legado / cálculo rápido

- **Cotización creada desde "Nueva cotización"** (sin pasar por estudio).
- El usuario puede seguir usando el modal **"Cálculo FV"** dentro del detalle de la cotización para guardar un cálculo por versión (QuoteFvCalculation). Ese cálculo es el que se muestra en el bloque Resumen FV y en vista previa/PDF.
- En la UI se indica que es un "cálculo rápido en cotización" y se recomienda usar **Estudios FV** para un estudio completo con 12 meses (texto en el modal y en el estado vacío del bloque FV en detalle).

---

## 6. Funcionalidades completadas en esta iteración

- **Modelo de datos:** FvStudy, FvStudyMonth, Quote.sourceFvStudyId; migraciones aplicadas.
- **Backend Estudios FV:** CRUD de estudios, validación de 12 meses, cálculo mensual y anual, estados (DRAFT, VALIDADO, COTIZADO, ARCHIVADO), permisos y ownership.
- **Backend crear cotización desde estudio:** `POST /api/fv-studies/:id/create-quote` (Quote + versión inicial + sourceFvStudyId + actualización del estudio a COTIZADO en una transacción).
- **Frontend Estudios FV:** Listado, filtros, crear/editar estudio (con 12 meses), detalle con KPIs, tabla mensual y gráficos; integración con Clientes y sidebar.
- **Crear cotización desde estudio (frontend):** Botón en detalle del estudio, llamada al endpoint, redirección al detalle de la cotización creada.
- **Detalle de cotización:** Indicador "Basado en Estudio FV" con enlace al estudio; badge "Desde estudio" / "Desde cálculo rápido"; bloque Resumen FV según origen (estudio vs QuoteFvCalculation); botón "Cálculo FV" deshabilitado con texto de ayuda cuando la cotización viene de estudio; mensaje claro cuando no hay estudio ni cálculo.
- **Vista previa/PDF:** Prioridad FvStudy cuando existe sourceFvStudyId; en caso contrario uso de QuoteFvCalculation; un solo bloque de resumen FV.
- **Listado de cotizaciones:** Columna "Origen FV" con badge "Desde estudio" cuando aplica.
- **Sidebar:** Orden Clientes → Estudios FV → Cotizaciones.
- **Modal Cálculo FV:** Texto que recomienda Estudios FV para un estudio completo con 12 meses.

---

## 7. Mejoras futuras pendientes

- **Deprecación o evolución de QuoteFvCalculation:** Decidir si a largo plazo el cálculo FV en cotización se sustituye por "crear Estudio FV y asociar" o se mantiene solo para compatibilidad con cotizaciones antiguas.
- **Creación automática de ítems desde estudio:** Opción de que, al crear la cotización desde el estudio, se sugieran o creen ítems (paneles, inversor, etc.) a partir de los datos del estudio.
- **Tipo de conexión (monofásico/trifásico):** Hoy se persiste en FvStudy; ampliar impacto en precios o en lógica de cálculo si el negocio lo requiere.
- **Nueva cotización:** Texto o ayuda en "Nueva cotización" recomendando el flujo Cliente → Estudio FV → Cotización.
- **Validación/transiciones de estado del estudio:** Reglas más estrictas (por ejemplo, solo ciertos roles pueden marcar VALIDADO o ARCHIVADO).
- **Asociar estudio a cotización existente:** Caso "esta cotización ya existe; quiero vincularla a un estudio" (opcional en el diseño actual).

---

## 8. Cómo probar el flujo completo nuevo (paso a paso)

### 8.1 Flujo recomendado: Cliente → Estudio FV → Cotización

1. **Iniciar sesión** con un usuario con permiso de lectura/creación en Estudios FV y Cotizaciones (ej. ADMIN o VENTAS).
2. **Clientes:** Ir a Clientes y elegir un cliente (o crear uno). En la fila del cliente, hacer clic en **"Nuevo estudio FV"** (debe abrir `/estudios-fv/nuevo?clientId=...` con el cliente ya seleccionado).
3. **Crear estudio:** Completar título, mes de referencia, cuenta y consumo de referencia, valor kWh consumo e inyección, tipo de conexión, tipo de proyecto, potencia por panel, cobertura deseada y **los 12 consumos mensuales (kWh)**. Guardar.
4. **Detalle del estudio:** Verificar que se ven los KPIs, la tabla de 12 meses y los gráficos. Comprobar el botón **"Crear cotización desde este estudio"**.
5. **Crear cotización:** Pulsar "Crear cotización desde este estudio". Debe crearse la cotización y redirigir al detalle de la cotización.
6. **Detalle de la cotización:** Verificar:
   - Badge **"Desde estudio"** y texto "Basado en Estudio FV: [título]" con enlace al estudio.
   - Bloque **"Resumen FV (desde estudio)"** con los mismos KPIs que el estudio y enlace "Ver estudio".
   - Botón **"Cálculo FV"** deshabilitado con el texto de ayuda sobre editar el estudio.
7. **Vista previa / PDF:** Abrir "Vista previa" y comprobar que el bloque "Resumen fotovoltaico" muestra los datos del estudio y el texto "Basado en Estudio FV: [título]". Imprimir o "Guardar como PDF" y comprobar que el resumen FV aparece correctamente.
8. **Listado de cotizaciones:** En `/cotizaciones`, localizar la cotización recién creada y comprobar que en la columna **"Origen FV"** tiene el badge **"Desde estudio"**.

### 8.2 Flujo legado: cotización a mano + cálculo rápido

1. **Nueva cotización:** Ir a Cotizaciones → "Nueva cotización". Completar cliente, título, tipo de proyecto, etc. y guardar. Crear versión inicial si se pide.
2. **Detalle sin estudio:** En el detalle, comprobar que no aparece "Desde estudio" ni "Basado en Estudio FV". El bloque Resumen FV debe mostrar el mensaje: "Esta cotización no proviene de un estudio FV. Puede usar el cálculo rápido o crear un Estudio FV para un análisis más completo." y el botón **"Abrir cálculo FV"** activo.
3. **Cálculo FV:** Pulsar "Abrir cálculo FV". Verificar el texto que recomienda Estudios FV para un estudio completo. Ingresar datos y guardar el cálculo.
4. **Después de guardar:** Debe aparecer el badge **"Desde cálculo rápido"** y el bloque con KPIs del cálculo y botón "Ver detalle". En vista previa/PDF, el resumen FV debe coincidir con el cálculo guardado.
5. **Listado:** En el listado, esa cotización debe tener "—" en Origen FV (no "Desde estudio").

### 8.3 Sidebar y navegación

- Comprobar que el orden del menú es: **Dashboard → Clientes → Estudios FV → Cotizaciones** → Productos → Proveedores → Usuarios.
- Desde Clientes, comprobar que "Ver estudios FV" y "Nuevo estudio FV" llevan al listado filtrado o al formulario de nuevo estudio con el cliente preseleccionado.

---

*Documento de referencia interna. Iteración 2 cerrada; cambios respecto del MVP original documentados para futuras iteraciones.*
