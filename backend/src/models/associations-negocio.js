import Venta from "./VentaModel.js";
import DetVenta from "./DetVentaModel.js";
import Producto from "./ProductModels.js";
import Cliente from "./clienteModel.js";
import Usuario from "./UsuariosModels.js";
import Proveedor from "./ProovedorModel.js";
import {
    MetodoPago, Devolucion, DetDevolucion, OrdenCompra, DetCompra,
    EvaluacionProveedor, CuentaContable, Ingreso, Egreso,
} from "./NegocioModels.js";

// Ventas: método de pago y devoluciones
Venta.belongsTo(MetodoPago, { foreignKey: "fk_venta_id_metodopago", as: "metodo_pago" });
Venta.hasMany(Devolucion, { foreignKey: "fk_devolucion_id_venta", as: "devoluciones" });
Devolucion.belongsTo(Venta, { foreignKey: "fk_devolucion_id_venta", as: "venta" });
Devolucion.belongsTo(Usuario, { foreignKey: "fk_devolucion_id_usuario", as: "usuario" });
Devolucion.hasMany(DetDevolucion, { foreignKey: "fk_det_devolucion_id_devolucion", as: "detalles" });
DetDevolucion.belongsTo(Devolucion, { foreignKey: "fk_det_devolucion_id_devolucion", as: "devolucion" });
DetDevolucion.belongsTo(Producto, { foreignKey: "fk_det_devolucion_id_producto", as: "producto" });

// Órdenes de compra
OrdenCompra.belongsTo(Proveedor, { foreignKey: "fk_orden_compra_id_proveedor", as: "proveedor" });
Proveedor.hasMany(OrdenCompra, { foreignKey: "fk_orden_compra_id_proveedor", as: "ordenes" });
OrdenCompra.belongsTo(Usuario, { foreignKey: "fk_orden_compra_id_usuario", as: "usuario" });
OrdenCompra.hasMany(DetCompra, { foreignKey: "fk_det_compra_id_ordencompra", as: "detalles" });
DetCompra.belongsTo(Producto, { foreignKey: "fk_det_compra_id_producto", as: "producto" });

// Evaluaciones
EvaluacionProveedor.belongsTo(Proveedor, { foreignKey: "fk_evaluacion_id_proveedor", as: "proveedor" });
Proveedor.hasMany(EvaluacionProveedor, { foreignKey: "fk_evaluacion_id_proveedor", as: "evaluaciones" });
EvaluacionProveedor.belongsTo(Usuario, { foreignKey: "fk_evaluacion_id_usuario", as: "usuario" });

// Contabilidad
for (const [Modelo] of [[Ingreso], [Egreso]]) {
    Modelo.belongsTo(CuentaContable, { foreignKey: "fk_cuenta", as: "cuenta" });
    Modelo.belongsTo(MetodoPago, { foreignKey: "fk_metodo_pago", as: "metodo_pago" });
    Modelo.belongsTo(Usuario, { foreignKey: "fk_usuario", as: "usuario" });
}
Ingreso.belongsTo(Cliente, { foreignKey: "fk_cliente", as: "cliente" });
Egreso.belongsTo(Proveedor, { foreignKey: "fk_proveedor", as: "proveedor" });

export { DetVenta };
