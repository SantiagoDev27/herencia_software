# API de Autenticación, Usuarios y Reportes de Ventas

> Desde la versión 1.1 **no existe registro público**. Las cuentas las crea el
> Administrador en `/api/usuarios` (rol Vendedor, Finanzas u otro Administrador).

Al arrancar, el servidor agrega a la tabla `usuario` (si no existen) las columnas
`estado_usuario`, `intentos_fallidos`, `bloqueado_hasta` y `ultimo_acceso`, crea la
tabla `auditoria` y deja los roles `1 Administrador`, `2 Vendedor`, `3 Finanzas`.
`npm run` del seed (`node src/scrips/seedUsuario.js`) crea un usuario por rol.

Reglas de contraseña (requisito 2.4.9): mínimo 8 caracteres, con letras y números.

---

## Autenticación — `/api/auth`

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/login` | Público | Inicia sesión. Body: `correo_usuario`, `contraseña_usuario`. Devuelve `token` (JWT 8 h) y `data` (usuario sin contraseña). |
| POST | `/logout` | Autenticado | Registra el cierre de sesión en la auditoría. |
| GET | `/perfil` | Autenticado | Datos del usuario de la sesión. |
| PATCH | `/cambiar-contrasena` | Autenticado | Body: `contrasena_actual`, `nueva_contrasena` (HU-SEG-004). |

Respuestas del login:

| HTTP | Caso |
|---|---|
| 200 | Credenciales válidas |
| 400 | Campos vacíos o correo inválido |
| 401 | Credenciales incorrectas (mismo mensaje si el correo no existe) |
| 403 | Cuenta desactivada por el administrador |
| 423 | Cuenta bloqueada: 5 intentos fallidos seguidos → 15 minutos (`MAX_INTENTOS_LOGIN`, `MINUTOS_BLOQUEO_LOGIN`) |

Si el administrador desactiva una cuenta, sus tokens dejan de funcionar de inmediato (401).

---

## Usuarios — `/api/usuarios` (solo Administrador)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Lista. Filtros opcionales: `busqueda`, `rol`, `estado=activos|inactivos`. |
| POST | `/` | Crea usuario. Body: `nombre_usuario`, `apellido_usuario`, `correo_usuario`, `contraseña_usuario`, `telefono_usuario?`, `fk_usuario_id_rol` (1, 2 o 3). |
| GET | `/:id` | Detalle. |
| PUT | `/:id` | Modifica datos y/o rol. |
| PATCH | `/:id/estado` | Body `{ "activo": true|false }`. No se puede desactivar la propia cuenta ni dejar el sistema sin administradores. |
| PATCH | `/:id/contrasena` | Body `{ "nueva_contrasena" }`. Restablece la contraseña y desbloquea (HU-SEG-003). |
| GET | `/roles` | Roles disponibles. |
| GET | `/auditoria?limite=100` | Últimos eventos: LOGIN, LOGIN_FALLIDO, CUENTA_BLOQUEADA, CREAR_USUARIO, DESACTIVAR_USUARIO, etc. |

Ejemplo — crear un vendedor:
```json
POST /api/usuarios
{
  "nombre_usuario": "Laura",
  "apellido_usuario": "Gómez",
  "correo_usuario": "laura.ventas@herenciadepapa.com",
  "contraseña_usuario": "Ventas2026",
  "telefono_usuario": "3104445566",
  "fk_usuario_id_rol": 2
}
```

---

## Reporte general de ventas — `/api/reportes` (Administrador y Finanzas)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/ventas?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD` | Sin fechas = último mes (30 días). Devuelve `resumen` (ventas, unidades, subtotal, IVA, descuentos, total, costo, utilidad bruta, margen, ticket promedio), `porDia` (informe diario de ventas e IVA), `porProducto`, `porVendedor` y `ventas`. |
| GET | `/ventas/pdf` | Mismo reporte en PDF. |

El frontend exporta además el reporte a Excel (CSV separado por `;`).

---

## Productos: vencimiento y retiro de agotados

- La fecha de vencimiento de un producto es la del lote con existencias más próximo a vencer.
  Se recalcula después de cada venta, entrada y salida.
- Cuando el producto se **agota** (stock 0) la fecha queda en `NULL` y no aparece en
  "próximos a vencer". Una nueva entrada vuelve a asignarle la fecha de su lote.
- `POST /api/productos/retirar-agotados` (Administrador y Vendedor): retira del catálogo
  (borrado lógico) todos los productos agotados. Su historial de ventas se conserva.

## Listas con fechas

`GET /api/ventas/ventas` acepta `fechaInicio`, `fechaFin` y `numero_venta`. El frontend
muestra por defecto solo el **último mes** en Ventas, Entradas y salidas y Reportes, con
opción de ver 3 meses, un año o todo el historial. Las pantallas se actualizan solas cada
15 segundos y al volver a la pestaña.
