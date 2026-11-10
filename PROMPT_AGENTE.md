# PROMPT PARA EL AGENTE DE DESARROLLO

Actúa como **desarrollador full‑stack senior** (Next.js + PostgreSQL). Tu tarea es **dejar en producción un sistema de cobro de agua potable** para un comité de agua en Bolivia. En este repositorio ya existe una base funcional (ver `README.md`). Trabaja de forma **empírica**: cada cambio debe poder comprobarse ejecutando la aplicación y las pruebas de aceptación de abajo. No des nada por hecho: **ejecuta, mide y muestra evidencia** (salida de comandos, capturas).

## 1. Contexto y objetivo
Un comité cobra el consumo mensual de agua a sus **socios**. Un socio puede tener **varios medidores**. Cada mes un **lector** registra la lectura de cada medidor; el sistema calcula el consumo y el importe según el **tarifario** asignado, genera la deuda, y el **cajero** cobra (efectivo, transferencia o **QR**) emitiendo un **comprobante imprimible**. También se emiten **proformas** de deuda. El socio consulta su **estado de cuenta** sin instalar nada y puede pagar con QR.

## 2. Stack y restricciones
- Next.js 14 (App Router, Server Actions), TypeScript estricto, Tailwind CSS.
- PostgreSQL 16 con `pg` y SQL directo (sin ORM). Esquema en `db/schema.sql` (idempotente).
- Auth: JWT en cookie httpOnly (`jose`), contraseñas con `bcryptjs`.
- Estilo: profesional y moderno (paleta `brand` azul agua, `ink` gris azulado; tarjetas redondeadas, tablas limpias, sin dependencias de UI pesadas). Idioma de la interfaz: **español (Bolivia)**, moneda **Bs**, zona horaria **America/La_Paz**.
- Todo cálculo monetario con `numeric(10,2)`; redondeo a 2 decimales.

## 3. Modelo de datos (resumen)
`zonas` · `socios` (nombres, apellidos, ci, complemento, zona, dirección, N°, celular, tipo NATURAL/JURIDICA, activo) · `medidores` (N° único, socio, tarifario, ubicación, lectura_inicial, estado) · `tarifarios` (tipo FIJA|CONSUMO, cargo_minimo, m3_minimos, tramos jsonb) · `lecturas` (único por medidor+periodo `YYYY-MM`) · `cargos` (único por medidor+periodo; PENDIENTE|PAGADO) · `pagos` (+ anulado/motivo) · `proformas` · `qr_transacciones` · `usuarios` · `config` (fila única) · `auditoria`.

## 4. Reglas de negocio (obligatorias)
1. **Tarifa FIJA:** monto único mensual, sin lectura (ej. 15 Bs). Se genera con “Generar cargos fijos”.
2. **Tarifa CONSUMO:** `total = cargo_minimo + Σ (m³ dentro de cada tramo × precio)`; los tramos aplican solo por encima de `m3_minimos`.
   Domiciliario (15 Bs hasta 9 m³; 10–15 m³ a 2 Bs; >15 m³ a 3 Bs): 5→15 · 9→15 · 10→17 · 12→21 · 15→27 · 16→30 · 20→42 · 30→72.
   Comercial (25 Bs hasta 12 m³; 13–20 a 3 Bs; >20 a 4,5 Bs): 12→25 · 13→28 · 20→49 · 21→53,5 · 30→94.
3. **Lectura:** `actual ≥ anterior`; anterior = última lectura del medidor (o `lectura_inicial`); corregir una lectura recalcula su cargo solo si está PENDIENTE; si ya está cobrado se rechaza. El lector solo opera en su zona.
4. **Cobro FIFO:** se seleccionan periodos **consecutivos desde el más antiguo**; nunca saltar a uno más reciente (validar en cliente **y** servidor). Un pago cubre todos los medidores del socio en esos periodos.
5. **Anulación:** solo ADMIN/GERENTE con motivo; los cargos vuelven a PENDIENTE; queda en auditoría. Un pago confirmado no se edita.
6. **Asignación de tarifario:** por medidor, y en bloque (de un tarifario a otro, opcionalmente por zona) → “insertar o quitar” tarifario a los socios.
7. **Roles:** ADMIN todo · GERENTE todo menos usuarios/configuración/API · CAJERO socios (lectura), recibos, proformas · LECTOR solo lecturas de su zona · SOCIO solo su estado de cuenta. `zonas` no accesible a CAJERO ni LECTOR. Validar rol en **servidor** en cada acción.
8. **QR:** administrable en *Pasarela QR (API)*: habilitar, sandbox, URL base, API key, secreto de webhook. El botón “Pagar con QR” aparece en el estado de cuenta del socio y en caja. La confirmación llega por `POST /api/qr/webhook` (`x-api-key`) y es **idempotente**; la pantalla sondea `/api/qr/estado/[id]`.

## 5. Estado actual
Implementado y verificado manualmente: login por roles, dashboard, socios (lista con menú ⋮, alta/edición, **varios medidores**), lecturas con cálculo en vivo, tarifas (fija y por tramos + simulador + asignación masiva), zonas, cobro FIFO (efectivo/transferencia/QR sandbox), recibos (carta y ticket 80 mm), anulaciones, proformas, estado de cuenta público, reportes, usuarios, configuración (nombre/logo/vencimiento), auditoría.

## 6. Tareas (en este orden)
1. **Arrancar y auditar.** `npm install && docker compose up -d && cp .env.example .env && npm run setup && npm run build`. Corrige cualquier error de tipos/lint. Revisa cada pantalla con 5 roles y reporta fallos de permisos.
2. **Pruebas automatizadas.** Vitest para `lib/tarifa.ts` (tabla de la regla 2) y para `lib/pagos.ts` (FIFO, idempotencia de `confirmarQr`, anulación). Playwright e2e: lectura → cobro → recibo; y estado de cuenta con QR sandbox. Meta: todas verdes en CI.
3. **Seguridad.** Límite de intentos de login (5 por 15 min por IP+correo), CSRF/Origin en acciones, cabeceras de seguridad, validación con `zod` en todas las Server Actions, no registrar secretos en logs, forzar cambio de contraseña inicial, comparar el secreto del webhook en tiempo constante, y validar firma si el proveedor la ofrece.
4. **Integración Vendis (QR).** Con la documentación oficial que entregue Vendis, reemplaza el contrato supuesto en `lib/qr.ts` (rutas, campos, expiración, firma del webhook, estados). Si no hay documentación, mantén sandbox y documenta lo pendiente. No inventes endpoints.
5. **Cierre de caja** por cajero y por día (efectivo vs QR vs transferencia), con impresión. Reporte de recaudación exportable a CSV/Excel.
6. **Mejoras de lectura:** foto de evidencia, observaciones (medidor dañado, casa cerrada), alerta de consumo anómalo (> 3× el promedio de los últimos 3 meses) y vista móvil optimizada para el lector.
7. **Cobranza:** fecha de vencimiento por periodo, recargo/mora configurable, aviso de corte, reconexión y recordatorio por WhatsApp (enlace `wa.me` con el detalle).
8. **Despliegue:** Dockerfile multi‑stage, variables de entorno documentadas, respaldo diario de PostgreSQL y guía para VPS con HTTPS.

## 7. Pruebas de aceptación (deben pasar)
- [ ] `npm run build` sin errores; `npm run setup` crea 24 socios y 36 medidores de demostración.
- [ ] Socio 22 (3 medidores) muestra 5 meses; seleccionar el 3.º marca automáticamente el 1.º y 2.º; es imposible pagar el 3.º sin los anteriores (probar también llamando directo a la acción).
- [ ] Un medidor con 12 m³ en tarifa domiciliaria genera **21,00 Bs**; con 20 m³, **42,00 Bs**.
- [ ] Ingresar una lectura menor a la anterior muestra el error “Debe ser ≥ N” y no guarda.
- [ ] Tras pagar, el recibo lista cada medidor con consumo/base/exceso y suma exactamente el total del pago; “Ticket 80 mm” cambia el formato; imprimir oculta botones.
- [ ] Anular un pago devuelve sus cargos a PENDIENTE y aparece en *Reportes → Anulaciones* y en auditoría.
- [ ] Cajero y lector reciben redirección al intentar abrir `/zonas`, `/tarifas` o `/admin/*`.
- [ ] Con QR habilitado, el estado de cuenta del socio genera QR; `curl -X POST /api/qr/webhook -H "x-api-key: …" -d '{"referencia":"…","estado":"PAGADO"}'` marca el pago y se puede repetir sin duplicarlo.
- [ ] CI `7523718` + celular `70012345` en `/estado-cuenta` muestra la deuda; un CI/celular incorrecto no revela datos.
- [ ] Lighthouse móvil ≥ 90 en Rendimiento y Accesibilidad en `/estado-cuenta`.

## 8. Cómo trabajar
- Cambios pequeños y verificables; después de cada tarea ejecuta build, pruebas y muestra la evidencia.
- No añadas dependencias sin justificarlo. Mantén el estilo visual existente.
- Si una regla no está clara, elige la opción más simple, anótala en `README.md` (sección “Decisiones”) y continúa.
- Entrega final: lista de lo hecho, lo pendiente, riesgos conocidos y pasos de despliegue.
