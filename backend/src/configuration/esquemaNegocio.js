// ============================================================
// Esquema de los módulos de negocio (v1.2)
//
// Al arrancar el servidor se asegura, SIN borrar datos, que la base tenga lo que
// usan clientes, devoluciones, órdenes de compra, evaluación de proveedores,
// contabilidad y permisos por rol. Las tablas que ya vienen en herencia_database
// se reutilizan; solo se agregan columnas y se vuelven opcionales las llaves que
// el diseño original dejó obligatorias sin necesidad (ej. ingresos.fk_devolucion).
// Debe ejecutarse ANTES de ajustarModelosAlEsquema().
// ============================================================
import { CATALOGO_PERMISOS } from "./permisos.js";

export const CUENTAS_BASE = [
    ["1105", "Caja", "Activo", "Débito"],
    ["1110", "Bancos", "Activo", "Débito"],
    ["1305", "Clientes (cuentas por cobrar)", "Activo", "Débito"],
    ["1435", "Mercancías no fabricadas por la empresa", "Activo", "Débito"],
    ["2205", "Proveedores nacionales", "Pasivo", "Crédito"],
    ["2408", "IVA por pagar", "Pasivo", "Crédito"],
    ["3105", "Capital social", "Patrimonio", "Crédito"],
    ["4135", "Comercio al por mayor y menor (ventas)", "Ingreso", "Crédito"],
    ["4175", "Devoluciones en ventas", "Ingreso", "Débito"],
    ["4250", "Otros ingresos", "Ingreso", "Crédito"],
    ["5105", "Gastos de personal", "Gasto", "Débito"],
    ["5120", "Arrendamientos", "Gasto", "Débito"],
    ["5135", "Servicios públicos", "Gasto", "Débito"],
    ["5195", "Gastos diversos", "Gasto", "Débito"],
    ["6135", "Costo de ventas", "Costo", "Débito"],
];

const METODOS_BASE = ["efectivo", "tarjeta debito", "tarjeta credito", "transferencia", "nequi", "credito"];

const TABLAS = {
    clientes: `CREATE TABLE clientes (
        id_clientes INT NOT NULL AUTO_INCREMENT, identificacion BIGINT NOT NULL,
        nombre_cliente VARCHAR(45) NOT NULL, apellido_cliente VARCHAR(45) NULL,
        telefono_clientes VARCHAR(45) NULL, correo_clientes VARCHAR(45) NULL,
        direccion_clientes VARCHAR(255) NULL, ciudad_clientes VARCHAR(45) NULL,
        PRIMARY KEY (id_clientes))`,
    metodo_pago: `CREATE TABLE metodo_pago (id_metodopago INT NOT NULL AUTO_INCREMENT, metodo_pago VARCHAR(100) NOT NULL, PRIMARY KEY (id_metodopago))`,
    devoluciones: `CREATE TABLE devoluciones (
        id_devoluciones INT NOT NULL AUTO_INCREMENT, fk_devoluciones_id_venta INT NOT NULL,
        fecha DATETIME NOT NULL, motivo VARCHAR(150) NOT NULL, fk_devoluciones_id_usuario INT NOT NULL,
        PRIMARY KEY (id_devoluciones))`,
    det_devolucion: `CREATE TABLE det_devolucion (
        id_detalledevolucion INT NOT NULL AUTO_INCREMENT, fk_det_devolucion_id_devolucion INT NOT NULL,
        fk_det_devolucion_id_producto INT NOT NULL, cantidad INT NOT NULL, PRIMARY KEY (id_detalledevolucion))`,
    orden_compra: `CREATE TABLE orden_compra (
        id_orden_compra INT NOT NULL AUTO_INCREMENT, numero_orden INT NOT NULL,
        fk_orden_compra_id_proovedor INT NOT NULL, fecha DATETIME NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL, iva DECIMAL(10,2) NOT NULL, total DECIMAL(10,2) NOT NULL,
        PRIMARY KEY (id_orden_compra), UNIQUE KEY numero_orden_UNIQUE (numero_orden))`,
    det_compra: `CREATE TABLE det_compra (
        id_detallecompra INT NOT NULL AUTO_INCREMENT, fk_det_compra_id_ordencompra INT NOT NULL,
        fk_det_compra_id_producto INT NOT NULL, cantidad INT NOT NULL, precio_unitario DECIMAL(10,2) NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL, total DECIMAL(10,2) NOT NULL, PRIMARY KEY (id_detallecompra))`,
    evaluacion_proveedor: `CREATE TABLE evaluacion_proveedor (
        id_evaluacion INT NOT NULL AUTO_INCREMENT, fk_evaluacion_id_proveedor INT NOT NULL,
        fecha DATETIME NOT NULL, cumplimiento TINYINT NOT NULL, calidad TINYINT NOT NULL,
        tiempo_respuesta TINYINT NOT NULL, calificacion DECIMAL(3,2) NOT NULL,
        observaciones VARCHAR(255) NULL, fk_evaluacion_id_usuario INT NULL,
        PRIMARY KEY (id_evaluacion), KEY fk_evaluacion_id_proveedor_idx (fk_evaluacion_id_proveedor))`,
    cuentas_contables: `CREATE TABLE cuentas_contables (
        id_cuentas INT NOT NULL AUTO_INCREMENT, codigo VARCHAR(45) NOT NULL, nombre_cuenta VARCHAR(100) NOT NULL,
        tipo VARCHAR(45) NOT NULL, naturaleza VARCHAR(45) NOT NULL, estado VARCHAR(45) NOT NULL,
        id_ingreso INT NULL, id_egreso INT NULL, PRIMARY KEY (id_cuentas))`,
    ingresos: `CREATE TABLE ingresos (
        id_ingresos INT NOT NULL AUTO_INCREMENT, fecha DATETIME NOT NULL, concepto VARCHAR(150) NOT NULL,
        fk_ingresos_id_cliente INT NULL, fk_ingresos_id_devolucion INT NULL, fk_ingresos_id_metodospago INT NULL,
        valor DECIMAL(10,2) NOT NULL, observaciones VARCHAR(150) NULL, fk_ingresos_id_cuenta INT NOT NULL,
        fk_ingresos_id_usuario INT NOT NULL, PRIMARY KEY (id_ingresos))`,
    egresos: `CREATE TABLE egresos (
        id_egresos INT NOT NULL AUTO_INCREMENT, fecha DATETIME NULL, concepto VARCHAR(150) NOT NULL,
        fk_egresos_id_proovedor INT NULL, fk_egresos_id_metodospago INT NULL, valor DECIMAL(10,2) NOT NULL,
        observaciones VARCHAR(150) NULL, fk_egresos_id_cuenta INT NOT NULL, fk_egresos_id_usuario INT NOT NULL,
        PRIMARY KEY (id_egresos))`,
    permiso_rol: `CREATE TABLE permiso_rol (
        fk_permiso_id_rol INT NOT NULL, permiso VARCHAR(60) NOT NULL,
        PRIMARY KEY (fk_permiso_id_rol, permiso))`,
};

// Columnas que se agregan si faltan: [tabla, columna, definición]
const COLUMNAS = [
    ["venta", "estado_venta", "VARCHAR(20) NOT NULL DEFAULT 'Registrada'"],
    ["venta", "fk_venta_id_metodopago", "INT NULL"],
    ["venta", "motivo_anulacion", "VARCHAR(255) NULL"],
    ["venta", "fecha_anulacion", "DATETIME NULL"],
    ["venta", "actualizada_en", "DATETIME NULL"],
    ["det_venta_lote", "cantidad_devuelta", "INT NOT NULL DEFAULT 0"],
    ["devoluciones", "total", "DECIMAL(10,2) NOT NULL DEFAULT 0"],
    ["devoluciones", "reintegrado", "TINYINT(1) NOT NULL DEFAULT 1"],
    ["det_devolucion", "subtotal", "DECIMAL(10,2) NOT NULL DEFAULT 0"],
    ["det_devolucion", "iva", "DECIMAL(10,2) NOT NULL DEFAULT 0"],
    ["det_devolucion", "total", "DECIMAL(10,2) NOT NULL DEFAULT 0"],
    ["det_devolucion", "costo", "DECIMAL(10,2) NOT NULL DEFAULT 0"],
    ["orden_compra", "estado", "VARCHAR(20) NOT NULL DEFAULT 'Pendiente'"],
    ["orden_compra", "observacion", "VARCHAR(255) NULL"],
    ["orden_compra", "fecha_entrega_estimada", "DATE NULL"],
    ["orden_compra", "fecha_recepcion", "DATETIME NULL"],
    ["orden_compra", "fk_orden_compra_id_usuario", "INT NULL"],
    ["orden_compra", "fk_orden_compra_id_entrada", "INT NULL"],
    ["det_compra", "iva", "DECIMAL(10,2) NOT NULL DEFAULT 0"],
    ["ingresos", "referencia", "VARCHAR(45) NULL"],
    ["ingresos", "origen", "VARCHAR(20) NOT NULL DEFAULT 'MANUAL'"],
    ["ingresos", "estado", "VARCHAR(20) NOT NULL DEFAULT 'Activo'"],
    ["egresos", "referencia", "VARCHAR(45) NULL"],
    ["egresos", "origen", "VARCHAR(20) NOT NULL DEFAULT 'MANUAL'"],
    ["egresos", "estado", "VARCHAR(20) NOT NULL DEFAULT 'Activo'"],
    ["proovedores", "deleted_at", "DATETIME NULL"],
];

// Columnas que el diseño original dejó NOT NULL pero son opcionales: [tabla, columna, tipo]
const OPCIONALES = [
    ["ingresos", "fk_ingresos_id_cliente", "INT NULL"],
    ["ingresos", "fk_ingresos_id_devolucion", "INT NULL"],
    ["ingresos", "fk_ingresos_id_metodospago", "INT NULL"],
    ["egresos", "fk_egresos_id_proovedor", "INT NULL"],
    ["egresos", "fk_egresos_id_metodospago", "INT NULL"],
];

export async function prepararEsquemaNegocio(sequelize) {
    const qi = sequelize.getQueryInterface();
    const tablas = new Set((await qi.showAllTables()).map((t) => (typeof t === "string" ? t : t.tableName)));

    for (const [nombre, sql] of Object.entries(TABLAS)) {
        if (!tablas.has(nombre)) {
            await sequelize.query(`${sql} ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
            tablas.add(nombre);
            console.log(`🧱 Tabla ${nombre} creada`);
        }
    }

    const columnasDe = {};
    const describir = async (tabla) => (columnasDe[tabla] ??= await qi.describeTable(tabla));

    for (const [tabla, columna, def] of COLUMNAS) {
        if (!tablas.has(tabla)) continue;
        if (!(await describir(tabla))[columna]) {
            await sequelize.query(`ALTER TABLE \`${tabla}\` ADD COLUMN \`${columna}\` ${def}`);
            console.log(`🧱 Columna ${tabla}.${columna} creada`);
        }
    }

    for (const [tabla, columna, def] of OPCIONALES) {
        const col = (await describir(tabla))[columna];
        if (col && col.allowNull === false) {
            await sequelize.query(`ALTER TABLE \`${tabla}\` MODIFY \`${columna}\` ${def}`);
            console.log(`🧱 Columna ${tabla}.${columna} ahora es opcional`);
        }
    }

    // Cédulas de 10 dígitos no caben en INT
    const ident = (await describir("clientes")).identificacion;
    if (ident && !/bigint/i.test(ident.type)) {
        await sequelize.query("ALTER TABLE `clientes` MODIFY `identificacion` BIGINT NOT NULL");
    }

    // Datos base
    const [[{ n: metodos }]] = await sequelize.query("SELECT COUNT(*) AS n FROM metodo_pago");
    if (Number(metodos) === 0) {
        for (const m of METODOS_BASE) await sequelize.query("INSERT INTO metodo_pago (metodo_pago) VALUES (?)", { replacements: [m] });
    }
    for (const [codigo, nombre, tipo, naturaleza] of CUENTAS_BASE) {
        const [filas] = await sequelize.query("SELECT id_cuentas FROM cuentas_contables WHERE codigo = ?", { replacements: [codigo] });
        if (filas.length === 0) {
            await sequelize.query(
                "INSERT INTO cuentas_contables (codigo, nombre_cuenta, tipo, naturaleza, estado) VALUES (?, ?, ?, ?, 'Activa')",
                { replacements: [codigo, nombre, tipo, naturaleza] }
            );
        }
    }
    const [[{ n: permisos }]] = await sequelize.query("SELECT COUNT(*) AS n FROM permiso_rol");
    if (Number(permisos) === 0) {
        for (const p of CATALOGO_PERMISOS) {
            for (const rol of p.defecto) {
                await sequelize.query("INSERT INTO permiso_rol (fk_permiso_id_rol, permiso) VALUES (?, ?)", { replacements: [rol, p.clave] });
            }
        }
        console.log("🔐 Permisos por rol sembrados con los valores por defecto");
    }
}
