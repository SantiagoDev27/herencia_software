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

// Módulos (pantallas del menú) y acciones dentro de ellas
export const PERMISOS = {
  // módulos
  dashboard: [A, V, F],
  productos: [A, V],
  movimientos: [A, V, F],
  ventas: [A, V, F],
  proveedores: [A, V],
  reportes: [A, F],
  usuarios: [A],
  cuenta: [A, V, F],
  // acciones
  registrarMovimiento: [A, V],
  registrarVenta: [A, V],
  retirarProducto: [A, V],
};

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
  return !!rol && (PERMISOS[permiso] ?? []).includes(rol);
};
