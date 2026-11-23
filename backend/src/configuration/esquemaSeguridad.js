// ============================================================
// Esquema de seguridad (HU-SEG-005, 006, 009, 010)
//
// Al arrancar el servidor se asegura, sin borrar datos, que existan:
//   - los tres roles del sistema (1 Administrador, 2 Vendedor, 3 Finanzas);
//   - las columnas de control de cuenta en "usuario":
//       estado_usuario     1 = activo, 0 = desactivado por el administrador
//       intentos_fallidos  intentos de inicio de sesión fallidos seguidos
//       bloqueado_hasta    fecha/hora hasta la que la cuenta queda bloqueada
//       ultimo_acceso      último inicio de sesión exitoso
//   - la tabla "auditoria" con los accesos y acciones relevantes.
//
// Debe ejecutarse ANTES de ajustarModelosAlEsquema(), que quita de los modelos
// los atributos cuya columna no exista.
// ============================================================

const COLUMNAS_USUARIO = [
    ["estado_usuario", "TINYINT(1) NOT NULL DEFAULT 1"],
    ["intentos_fallidos", "INT NOT NULL DEFAULT 0"],
    ["bloqueado_hasta", "DATETIME NULL DEFAULT NULL"],
    ["ultimo_acceso", "DATETIME NULL DEFAULT NULL"],
];

export const ROLES_BASE = [
    { idrol: 1, nombre_rol: "Administrador", descripcion: "Acceso total al sistema" },
    { idrol: 2, nombre_rol: "Vendedor", descripcion: "Ventas, inventario y proveedores" },
    { idrol: 3, nombre_rol: "Finanzas", descripcion: "Contabilidad: ventas, movimientos y reportes" },
];

export async function prepararEsquemaSeguridad(sequelize) {
    const qi = sequelize.getQueryInterface();
    const tablas = new Set((await qi.showAllTables()).map((t) => (typeof t === "string" ? t : t.tableName)));

    // 1. Columnas de control en usuario
    if (tablas.has("usuario")) {
        const columnas = await qi.describeTable("usuario");
        for (const [nombre, definicion] of COLUMNAS_USUARIO) {
            if (!columnas[nombre]) {
                await sequelize.query(`ALTER TABLE \`usuario\` ADD COLUMN \`${nombre}\` ${definicion}`);
                console.log(`🔐 Columna usuario.${nombre} creada`);
            }
        }
    }

    // 2. Roles del sistema (los existentes se renombran al nombre oficial)
    if (tablas.has("rol")) {
        for (const rol of ROLES_BASE) {
            await sequelize.query(
                "INSERT INTO `rol` (idrol, nombre_rol, descripcion) VALUES (?, ?, ?) " +
                "ON DUPLICATE KEY UPDATE nombre_rol = VALUES(nombre_rol), descripcion = VALUES(descripcion)",
                { replacements: [rol.idrol, rol.nombre_rol, rol.descripcion] }
            );
        }
    }

    // 3. Tabla de auditoría
    if (!tablas.has("auditoria")) {
        await sequelize.query(`
            CREATE TABLE \`auditoria\` (
                \`id_auditoria\` INT NOT NULL AUTO_INCREMENT,
                \`fecha\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                \`fk_auditoria_id_usuario\` INT NULL,
                \`correo\` VARCHAR(150) NULL,
                \`accion\` VARCHAR(60) NOT NULL,
                \`detalle\` VARCHAR(255) NULL,
                \`ip\` VARCHAR(60) NULL,
                PRIMARY KEY (\`id_auditoria\`),
                KEY \`fk_auditoria_id_usuario_idx\` (\`fk_auditoria_id_usuario\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log("🔐 Tabla auditoria creada");
    }
}
