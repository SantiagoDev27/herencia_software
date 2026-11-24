# Módulos completados en la versión 1.2

Al arrancar, `configuration/esquemaNegocio.js` crea o completa (sin borrar datos) las tablas
`clientes`, `devoluciones`, `det_devolucion`, `orden_compra`, `det_compra`, `evaluacion_proveedor`,
`cuentas_contables`, `ingresos`, `egresos`, `metodo_pago` y `permiso_rol`; agrega columnas de estado
a `venta` y `det_venta_lote`; vuelve opcionales llaves que el diseño original dejó obligatorias
(ej. `ingresos.fk_ingresos_id_devolucion`) y siembra el catálogo base de cuentas (PUC) y los permisos por defecto.

Las fechas se guardan en la hora local del servidor (`DB_TIMEZONE`, por defecto el huso del equipo):
antes se guardaban en UTC y los movimientos hechos después de las 7 p. m. quedaban con la fecha del día siguiente.

| Módulo | HU | Endpoints principales |
|---|---|---|
| Permisos por rol | HU-SEG-007 | `GET /api/usuarios/permisos`, `PUT /api/usuarios/permisos/:idrol` (2 Vendedor, 3 Finanzas) |
| Clientes | HU-VEN-006 | `GET/POST /api/clientes`, `PUT/DELETE /api/clientes/:id` |
| Modificar venta (solo del día, sin devoluciones) | HU-VEN-002 | `PUT /api/ventas/ventas/:id` |
| Anular venta (restaura lotes, anula el ingreso) | HU-VEN-003 | `PATCH /api/ventas/ventas/:id/anular` `{ motivo }` |
| Devoluciones (reintegro opcional, egreso y comprobante) | HU-VEN-007 | `POST /api/ventas/ventas/:id/devoluciones`, `GET /api/ventas/devoluciones/:id/comprobante-pdf` |
| Órdenes de compra (PDF, recepción con lotes, cancelación) | HU-PROV-006 | `GET/POST /api/ordenes-compra`, `PATCH /:id/recibir`, `PATCH /:id/cancelar`, `GET /:id/pdf` |
| Evaluación de proveedores | HU-PROV-007 | `POST/GET /api/proveedores/proveedores/:id/evaluaciones`, `GET /api/proveedores/evaluaciones/resumen` |
| Reporte de proveedores | HU-PROV-008 | `GET /api/reportes/proveedores`, `/pdf` |
| Cuentas contables | HU-CON-003 | `GET/POST /api/contabilidad/cuentas`, `PUT /:id`, `PATCH /:id/estado` |
| Ingresos y egresos | HU-CON-001/002 | `POST /api/contabilidad/ingresos` y `/egresos`, `PATCH /:id/anular`, `GET /:id/comprobante-pdf` |
| Movimientos financieros | HU-CON-004 | `GET /api/contabilidad/movimientos?fechaInicio&fechaFin&tipo&fk_cuenta` |
| Balance general (simplificado) | HU-CON-005 | `GET /api/contabilidad/balance-general?fechaCorte`, `/pdf` |
| Estado de resultados | HU-CON-006 | `GET /api/contabilidad/estado-resultados`, `/pdf` |
| Flujo de caja | HU-CON-007 | `GET /api/contabilidad/flujo-caja`, `/pdf` |
| Reportes contables | HU-CON-008 | los anteriores + exportación Excel (CSV) en la pantalla |
| Reporte de inventario a Excel | HU-INV-008 | botón Excel en Reportes › Inventario |

Integración automática con contabilidad:
- Cada venta registra un ingreso (cuenta 4135) con su método de pago; modificarla lo actualiza y anularla lo anula.
- Cada devolución registra un egreso (cuenta 4175).
- Recibir una orden de compra crea la entrada de mercancía con sus lotes y, si se marca, el egreso del pago (cuenta 1435).
