// ============================================================
// Roles y permisos del panel (deben coincidir con backend/src/configuration/roles.js)
//  - Administrador: todo, incluida la gestión de usuarios.
//  - Vendedor:      ventas, inventario (productos, entradas y salidas) y proveedores.
//  - Finanzas:      contabilidad: resumen, consulta de ventas y movimientos, reportes.
// ============================================================
export const ROLES = Object.freeze({
  ADMINISTRADOR: "Administrador",
  EMPLEADO: "Vendedor", // antes "Empleado"; la constante se conserva por compatibilidad
  FINANZAS: "Finanzas",
});

const { ADMINISTRADOR: A, EMPLEADO: V, FINANZAS: F } = ROLES;

// Roles que el administrador puede asignar al crear un usuario (id = idrol en la base de datos).
// Ya no existe registro público: solo el administrador crea cuentas.
export const ROLES_ASIGNABLES = [
  { id: 2, nombre: V, descripcion: "Registra ventas, entradas/salidas y gestiona productos y proveedores." },
  { id: 3, nombre: F, descripcion: "Consulta ventas y movimientos, genera reportes financieros." },
  { id: 1, nombre: A, descripcion: "Acceso total, incluida la gestión de usuarios." },
];

export const nombreRolPorId = (id) => ROLES_ASIGNABLES.find((r) => r.id === Number(id))?.nombre ?? "—";

// Permisos por defecto (iguales a backend/src/configuration/permisos.js). Desde la v1.2 el
// administrador los cambia en Usuarios › Permisos por rol y llegan con la sesión
// (usuario.permisos); esta tabla solo se usa si la sesión aún no los trae.
// "usuarios" y "cuenta" son fijos: no se configuran.
export const PERMISOS = {
  // módulos
  dashboard: [A, V, F],
  productos: [A, V],
  movimientos: [A, V, F],
  ventas: [A, V, F],
  clientes: [A, V, F],
  proveedores: [A, V],
  compras: [A, V, F],
  reportes: [A, F],
  contabilidad: [A, F],
  usuarios: [A],
  cuenta: [A, V, F],
  // acciones
  gestionarProductos: [A, V],
  retirarProducto: [A, V],
  registrarMovimiento: [A, V],
  registrarVenta: [A, V],
  editarVenta: [A, V],
  anularVenta: [A],
  devoluciones: [A, V],
  gestionarClientes: [A, V],
  gestionarProveedores: [A, V],
  gestionarCompras: [A, V],
  evaluarProveedores: [A],
  registrarContable: [A, F],
  gestionarCuentas: [A, F],
};
const FIJOS = ["usuarios", "cuenta"];

// Nombres antiguos de la tabla "rol" y respaldo por id, para sesiones guardadas antes del cambio
const ALIAS = {
  admin: A, administrador: A,
  vendedor: V, vendedora: V, empleado: V,
  finanzas: F, contabilidad: F,
};
const POR_ID = { 1: A, 2: V, 3: F };

export const rolDe = (usuario) => {
  if (!usuario) return null;
  const nombre = String(usuario.rol?.nombre_rol ?? usuario.rol ?? "").trim().toLowerCase();
  return ALIAS[nombre] ?? POR_ID[usuario.fk_usuario_id_rol ?? usuario.rol?.idrol] ?? null;
};

export const puede = (usuario, permiso) => {
  const rol = rolDe(usuario);
  if (!rol) return false;
  if (rol === A) return true;
  if (FIJOS.includes(permiso) || !Array.isArray(usuario?.permisos)) return (PERMISOS[permiso] ?? []).includes(rol);
  return usuario.permisos.includes(permiso);
};
