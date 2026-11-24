// ============================================================
// HU-SEG-007: Permisos configurables por rol
//
// Cada permiso es una clave. El Administrador (rol 1) siempre los tiene todos.
// Para Vendedor (2) y Finanzas (3) se guardan en la tabla "permiso_rol" y el
// administrador los cambia desde Usuarios › Permisos por rol.
// "defecto" son los permisos con que se siembra la tabla la primera vez
// (iguales a los que el sistema tenía fijos en el código).
// ============================================================
export const ROL_ADMIN = 1;

export const CATALOGO_PERMISOS = [
  // Módulos (qué pantallas ve cada rol)
  { clave: "dashboard", grupo: "Módulos", nombre: "Ver el resumen", defecto: [2, 3] },
  { clave: "productos", grupo: "Módulos", nombre: "Ver productos", defecto: [2] },
  { clave: "movimientos", grupo: "Módulos", nombre: "Ver entradas y salidas", defecto: [2, 3] },
  { clave: "ventas", grupo: "Módulos", nombre: "Ver ventas", defecto: [2, 3] },
  { clave: "clientes", grupo: "Módulos", nombre: "Ver clientes", defecto: [2, 3] },
  { clave: "proveedores", grupo: "Módulos", nombre: "Ver proveedores", defecto: [2] },
  { clave: "compras", grupo: "Módulos", nombre: "Ver órdenes de compra", defecto: [2, 3] },
  { clave: "reportes", grupo: "Módulos", nombre: "Ver reportes", defecto: [3] },
  { clave: "contabilidad", grupo: "Módulos", nombre: "Ver contabilidad", defecto: [3] },
  // Acciones
  { clave: "gestionarProductos", grupo: "Inventario", nombre: "Crear, editar y eliminar productos", defecto: [2] },
  { clave: "retirarProducto", grupo: "Inventario", nombre: "Retirar productos agotados", defecto: [2] },
  { clave: "registrarMovimiento", grupo: "Inventario", nombre: "Registrar entradas y salidas", defecto: [2] },
  { clave: "registrarVenta", grupo: "Ventas", nombre: "Registrar ventas", defecto: [2] },
  { clave: "editarVenta", grupo: "Ventas", nombre: "Modificar ventas del día", defecto: [2] },
  { clave: "anularVenta", grupo: "Ventas", nombre: "Anular ventas", defecto: [] },
  { clave: "devoluciones", grupo: "Ventas", nombre: "Registrar devoluciones", defecto: [2] },
  { clave: "gestionarClientes", grupo: "Ventas", nombre: "Registrar y editar clientes", defecto: [2] },
  { clave: "gestionarProveedores", grupo: "Proveedores", nombre: "Registrar y editar proveedores", defecto: [2] },
  { clave: "gestionarCompras", grupo: "Proveedores", nombre: "Crear, recibir y cancelar órdenes de compra", defecto: [2] },
  { clave: "evaluarProveedores", grupo: "Proveedores", nombre: "Evaluar proveedores", defecto: [] },
  { clave: "registrarContable", grupo: "Contabilidad", nombre: "Registrar y anular ingresos y egresos", defecto: [3] },
  { clave: "gestionarCuentas", grupo: "Contabilidad", nombre: "Administrar cuentas contables", defecto: [3] },
];

export const CLAVES_PERMISOS = CATALOGO_PERMISOS.map((p) => p.clave);
