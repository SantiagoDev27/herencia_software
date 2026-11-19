// ============================================================
// ROLES DEL SISTEMA
// Los nombres deben coincidir con la columna nombre_rol de la tabla "rol"
// (ver src/scrips/seedUsuario.js). El token JWT guarda este nombre en "rol".
//
//  - Administrador: acceso total.
//  - Empleado:      ventas, inventario (productos, entradas y salidas) y proveedores.
//  - Finanzas:      contabilidad: consulta de ventas, movimientos y reportes.
// ============================================================
export const ROLES = Object.freeze({
    ADMINISTRADOR: "Administrador",
    EMPLEADO: "Empleado",
    FINANZAS: "Finanzas",
});

// El nombre del rol en la BD puede variar ("Admin", "administrador", "Vendedor"...) o venir de un
// token emitido antes de renombrar los roles. Se normaliza por nombre y, si no se reconoce, por id.
const ALIAS = {
    admin: ROLES.ADMINISTRADOR,
    administrador: ROLES.ADMINISTRADOR,
    administradora: ROLES.ADMINISTRADOR,
    empleado: ROLES.EMPLEADO,
    empleada: ROLES.EMPLEADO,
    vendedor: ROLES.EMPLEADO,
    vendedora: ROLES.EMPLEADO,
    finanzas: ROLES.FINANZAS,
    financiero: ROLES.FINANZAS,
    contabilidad: ROLES.FINANZAS,
    contador: ROLES.FINANZAS,
};
const POR_ID = { 1: ROLES.ADMINISTRADOR, 2: ROLES.EMPLEADO, 3: ROLES.FINANZAS };

const limpiar = (texto) =>
    String(texto ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

// Recibe el contenido del token ({ rol, fk_usuario_id_rol }) y devuelve uno de los ROLES o null
export const rolNormalizado = (usuario) =>
    ALIAS[limpiar(usuario?.rol)] ?? POR_ID[Number(usuario?.fk_usuario_id_rol)] ?? null;

// Atajos para declarar permisos en las rutas
export const TODOS = [ROLES.ADMINISTRADOR, ROLES.EMPLEADO, ROLES.FINANZAS];
export const OPERACION = [ROLES.ADMINISTRADOR, ROLES.EMPLEADO]; // registrar ventas, inventario, proveedores
export const CONTABILIDAD = [ROLES.ADMINISTRADOR, ROLES.FINANZAS]; // reportes financieros
