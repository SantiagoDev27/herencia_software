// ============================================================
// Roles y permisos del panel (deben coincidir con backend/src/configuration/roles.js)
//  - Administrador: todo.
//  - Empleado:      ventas, inventario (productos, entradas y salidas) y proveedores.
//  - Finanzas:      contabilidad: resumen, consulta de ventas y movimientos, reportes.
// ============================================================
export const ROLES = Object.freeze({
  ADMINISTRADOR: "Administrador",
  EMPLEADO: "Empleado",
  FINANZAS: "Finanzas",
});

const { ADMINISTRADOR: A, EMPLEADO: E, FINANZAS: F } = ROLES;

// Roles que se pueden elegir al crear una cuenta (id = idrol en la base de datos).
// Administrador no se ofrece en el registro público.
export const ROLES_REGISTRO = [
  { id: 2, nombre: E },
  { id: 3, nombre: F },
];

// Módulos (pantallas del menú) y acciones dentro de ellas
export const PERMISOS = {
  // módulos
  dashboard: [A, E, F],
  productos: [A, E],
  movimientos: [A, E, F],
  ventas: [A, E, F],
  proveedores: [A, E],
  reportes: [A, F],
  // acciones
  registrarMovimiento: [A, E],
  registrarVenta: [A, E],
};

// Nombres antiguos de la tabla "rol" y respaldo por id, para sesiones guardadas antes del cambio
const ALIAS = { admin: A, administrador: A, vendedor: E, empleado: E, finanzas: F, contabilidad: F };
const POR_ID = { 1: A, 2: E, 3: F };

export const rolDe = (usuario) => {
  if (!usuario) return null;
  const nombre = String(usuario.rol?.nombre_rol ?? usuario.rol ?? "").trim().toLowerCase();
  return ALIAS[nombre] ?? POR_ID[usuario.fk_usuario_id_rol ?? usuario.rol?.idrol] ?? null;
};

export const puede = (usuario, permiso) => {
  const rol = rolDe(usuario);
  return !!rol && (PERMISOS[permiso] ?? []).includes(rol);
};
