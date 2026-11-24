// Modelos de los módulos agregados en la v1.2 (devoluciones, compras,
// evaluación de proveedores, contabilidad y permisos por rol).
import { DataTypes } from "sequelize";
import sequelize from "../configuration/database.js";

const I = DataTypes.INTEGER;
const D = (p = 10, s = 2) => DataTypes.DECIMAL(p, s);
const S = (n) => DataTypes.STRING(n);

export const MetodoPago = sequelize.define("MetodoPago", {
    id_metodopago: { type: I, primaryKey: true, autoIncrement: true },
    metodo_pago: { type: S(100), allowNull: false },
}, { tableName: "metodo_pago", timestamps: false });

export const Devolucion = sequelize.define("Devolucion", {
    id_devolucion: { type: I, primaryKey: true, autoIncrement: true, field: "id_devoluciones" },
    fk_devolucion_id_venta: { type: I, allowNull: false, field: "fk_devoluciones_id_venta" },
    fecha: { type: DataTypes.DATE, allowNull: false },
    motivo: { type: S(150), allowNull: false },
    fk_devolucion_id_usuario: { type: I, allowNull: false, field: "fk_devoluciones_id_usuario" },
    total: { type: D(), allowNull: false, defaultValue: 0 },
    reintegrado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: "devoluciones", timestamps: false });

export const DetDevolucion = sequelize.define("DetDevolucion", {
    id_detalledevolucion: { type: I, primaryKey: true, autoIncrement: true },
    fk_det_devolucion_id_devolucion: { type: I, allowNull: false },
    fk_det_devolucion_id_producto: { type: I, allowNull: false },
    cantidad: { type: I, allowNull: false },
    subtotal: { type: D(), allowNull: false, defaultValue: 0 },
    iva: { type: D(), allowNull: false, defaultValue: 0 },
    total: { type: D(), allowNull: false, defaultValue: 0 },
    costo: { type: D(), allowNull: false, defaultValue: 0 },
}, { tableName: "det_devolucion", timestamps: false });

export const OrdenCompra = sequelize.define("OrdenCompra", {
    id_orden_compra: { type: I, primaryKey: true, autoIncrement: true },
    numero_orden: { type: I, allowNull: false, unique: true },
    fk_orden_compra_id_proveedor: { type: I, allowNull: false, field: "fk_orden_compra_id_proovedor" },
    fecha: { type: DataTypes.DATE, allowNull: false },
    subtotal: { type: D(), allowNull: false },
    iva: { type: D(), allowNull: false },
    total: { type: D(), allowNull: false },
    estado: { type: S(20), allowNull: false, defaultValue: "Pendiente" },
    observacion: { type: S(255), allowNull: true },
    fecha_entrega_estimada: { type: DataTypes.DATEONLY, allowNull: true },
    fecha_recepcion: { type: DataTypes.DATE, allowNull: true },
    fk_orden_compra_id_usuario: { type: I, allowNull: true },
    fk_orden_compra_id_entrada: { type: I, allowNull: true },
}, { tableName: "orden_compra", timestamps: false });

export const DetCompra = sequelize.define("DetCompra", {
    id_detallecompra: { type: I, primaryKey: true, autoIncrement: true },
    fk_det_compra_id_ordencompra: { type: I, allowNull: false },
    fk_det_compra_id_producto: { type: I, allowNull: false },
    cantidad: { type: I, allowNull: false },
    precio_unitario: { type: D(), allowNull: false },
    subtotal: { type: D(), allowNull: false },
    iva: { type: D(), allowNull: false, defaultValue: 0 },
    total: { type: D(), allowNull: false },
}, { tableName: "det_compra", timestamps: false });

export const EvaluacionProveedor = sequelize.define("EvaluacionProveedor", {
    id_evaluacion: { type: I, primaryKey: true, autoIncrement: true },
    fk_evaluacion_id_proveedor: { type: I, allowNull: false },
    fecha: { type: DataTypes.DATE, allowNull: false },
    cumplimiento: { type: I, allowNull: false },
    calidad: { type: I, allowNull: false },
    tiempo_respuesta: { type: I, allowNull: false },
    calificacion: { type: D(3, 2), allowNull: false },
    observaciones: { type: S(255), allowNull: true },
    fk_evaluacion_id_usuario: { type: I, allowNull: true },
}, { tableName: "evaluacion_proveedor", timestamps: false });

export const CuentaContable = sequelize.define("CuentaContable", {
    id_cuenta: { type: I, primaryKey: true, autoIncrement: true, field: "id_cuentas" },
    codigo: { type: S(45), allowNull: false },
    nombre_cuenta: { type: S(100), allowNull: false },
    tipo: { type: S(45), allowNull: false },
    naturaleza: { type: S(45), allowNull: false },
    estado: { type: S(45), allowNull: false, defaultValue: "Activa" },
}, { tableName: "cuentas_contables", timestamps: false });

const movimiento = (prefijo) => ({
    fecha: { type: DataTypes.DATE, allowNull: false },
    concepto: { type: S(150), allowNull: false },
    fk_metodo_pago: { type: I, allowNull: true, field: `fk_${prefijo}_id_metodospago` },
    valor: { type: D(), allowNull: false },
    observaciones: { type: S(150), allowNull: true },
    fk_cuenta: { type: I, allowNull: false, field: `fk_${prefijo}_id_cuenta` },
    fk_usuario: { type: I, allowNull: false, field: `fk_${prefijo}_id_usuario` },
    referencia: { type: S(45), allowNull: true },
    origen: { type: S(20), allowNull: false, defaultValue: "MANUAL" },
    estado: { type: S(20), allowNull: false, defaultValue: "Activo" },
});

export const Ingreso = sequelize.define("Ingreso", {
    id_ingreso: { type: I, primaryKey: true, autoIncrement: true, field: "id_ingresos" },
    fk_cliente: { type: I, allowNull: true, field: "fk_ingresos_id_cliente" },
    ...movimiento("ingresos"),
}, { tableName: "ingresos", timestamps: false });

export const Egreso = sequelize.define("Egreso", {
    id_egreso: { type: I, primaryKey: true, autoIncrement: true, field: "id_egresos" },
    fk_proveedor: { type: I, allowNull: true, field: "fk_egresos_id_proovedor" },
    ...movimiento("egresos"),
}, { tableName: "egresos", timestamps: false });

export const PermisoRol = sequelize.define("PermisoRol", {
    fk_permiso_id_rol: { type: I, primaryKey: true },
    permiso: { type: S(60), primaryKey: true },
}, { tableName: "permiso_rol", timestamps: false });
