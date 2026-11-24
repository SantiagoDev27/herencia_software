import { body, param, query } from "express-validator";

const id = (campo, msg) => param(campo).isInt({ min: 1 }).withMessage(msg ?? "Identificador inválido.");
const fechaOpcional = (campo) => query(campo).optional().isISO8601().withMessage(`${campo} debe tener formato YYYY-MM-DD.`);
export const rangoValidation = [fechaOpcional("fechaInicio"), fechaOpcional("fechaFin")];

// ---------- Ventas ----------
const lineasVenta = (opcional) => [
    (opcional ? body("detalles").optional() : body("detalles")).isArray({ min: 1 }).withMessage("La venta debe incluir al menos un producto."),
    body("detalles.*.fk_det_venta_id_producto").isInt({ min: 1 }).withMessage("Cada línea necesita un producto válido."),
    body("detalles.*.cantidad").isInt({ min: 1 }).withMessage("La cantidad debe ser un entero mayor a 0."),
];
const cabeceraVenta = [
    body("fk_venta_id_cliente").optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage("Cliente inválido."),
    body("fk_venta_id_metodopago").optional({ nullable: true }).isInt({ min: 1 }).withMessage("Método de pago inválido."),
    body("descuento").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("El descuento no puede ser negativo."),
];
export const crearVentaValidation = [
    body("fecha").notEmpty().withMessage("La fecha es obligatoria.").isISO8601().withMessage("La fecha debe tener formato YYYY-MM-DD."),
    ...cabeceraVenta,
    ...lineasVenta(false),
];
export const actualizarVentaValidation = [id("id_venta"), ...cabeceraVenta, ...lineasVenta(true)];
export const anularVentaValidation = [
    id("id_venta"),
    body("motivo").trim().isLength({ min: 5, max: 255 }).withMessage("Indica el motivo de la anulación (5 a 255 caracteres)."),
];
export const devolucionValidation = [
    id("id_venta"),
    body("motivo").trim().isLength({ min: 3, max: 150 }).withMessage("Indica el motivo de la devolución (3 a 150 caracteres)."),
    body("reintegrar").optional().isBoolean().withMessage("reintegrar debe ser true o false."),
    body("detalles").isArray({ min: 1 }).withMessage("Indica al menos un producto a devolver."),
    body("detalles.*.fk_producto").isInt({ min: 1 }).withMessage("Producto inválido."),
    body("detalles.*.cantidad").isInt({ min: 1 }).withMessage("La cantidad a devolver debe ser mayor a 0."),
];
export const listarVentasValidation = [
    query("pagina").optional().isInt({ min: 1 }).withMessage("La página debe ser un entero positivo."),
    query("limite").optional().isInt({ min: 1, max: 500 }).withMessage("El límite debe estar entre 1 y 500."),
    fechaOpcional("fechaInicio"), fechaOpcional("fechaFin"),
];
export const idVentaValidation = [id("id_venta")];

// ---------- Clientes (HU-VEN-006) ----------
const camposCliente = (opcional) => {
    const req = (campo) => (opcional ? body(campo).optional() : body(campo));
    return [
        req("identificacion").isInt({ min: 1000, max: 9999999999999 }).withMessage("La identificación debe ser numérica (4 a 13 dígitos)."),
        req("nombre_cliente").trim().isLength({ min: 2, max: 45 }).withMessage("El nombre es obligatorio (máximo 45 caracteres)."),
        body("apellido_cliente").optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 45 }).withMessage("Máximo 45 caracteres."),
        body("telefono_cliente").optional({ nullable: true, checkFalsy: true }).matches(/^[0-9+\s-]{7,20}$/).withMessage("Teléfono inválido."),
        body("correo_cliente").optional({ nullable: true, checkFalsy: true }).isEmail().withMessage("Correo inválido.").isLength({ max: 45 }).withMessage("Máximo 45 caracteres."),
        body("direccion_cliente").optional({ nullable: true, checkFalsy: true }).isLength({ max: 255 }).withMessage("Máximo 255 caracteres."),
        body("ciudad_cliente").optional({ nullable: true, checkFalsy: true }).isLength({ max: 45 }).withMessage("Máximo 45 caracteres."),
    ];
};
export const crearClienteValidation = camposCliente(false);
export const actualizarClienteValidation = [id("id"), ...camposCliente(true)];
export const idValidation = [id("id")];

// ---------- Órdenes de compra (HU-PROV-006) ----------
export const crearOrdenValidation = [
    body("fk_proveedor").isInt({ min: 1 }).withMessage("Selecciona un proveedor."),
    body("fecha_entrega_estimada").optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage("Fecha de entrega inválida."),
    body("observacion").optional({ nullable: true }).isLength({ max: 255 }).withMessage("Máximo 255 caracteres."),
    body("detalles").isArray({ min: 1 }).withMessage("La orden debe tener al menos un producto."),
    body("detalles.*.fk_producto").isInt({ min: 1 }).withMessage("Producto inválido."),
    body("detalles.*.cantidad").isInt({ min: 1 }).withMessage("La cantidad debe ser mayor a 0."),
    body("detalles.*.precio_unitario").optional({ nullable: true }).isFloat({ min: 0 }).withMessage("El precio no puede ser negativo."),
];
export const recibirOrdenValidation = [
    id("id"),
    body("detalles").isArray({ min: 1 }).withMessage("Indica el lote de cada producto."),
    body("detalles.*.fk_producto").isInt({ min: 1 }).withMessage("Producto inválido."),
    body("detalles.*.numero_lote").trim().notEmpty().withMessage("Cada producto necesita número de lote."),
    body("detalles.*.fecha_vencimiento").isISO8601().withMessage("Cada producto necesita fecha de vencimiento."),
    body("registrar_pago").optional().isBoolean(),
    body("fk_metodo_pago").optional({ nullable: true }).isInt({ min: 1 }).withMessage("Método de pago inválido."),
];
export const cancelarOrdenValidation = [
    id("id"),
    body("motivo").trim().isLength({ min: 3, max: 200 }).withMessage("Indica el motivo de la cancelación."),
];

// ---------- Evaluación de proveedores (HU-PROV-007) ----------
const nota = (campo) => body(campo).isInt({ min: 1, max: 5 }).withMessage(`${campo.replace("_", " ")} debe ser de 1 a 5.`);
export const crearEvaluacionValidation = [
    id("id_proveedor"), nota("cumplimiento"), nota("calidad"), nota("tiempo_respuesta"),
    body("observaciones").optional({ nullable: true }).isLength({ max: 255 }).withMessage("Máximo 255 caracteres."),
];

// ---------- Contabilidad (HU-CON-001..004) ----------
export const TIPOS_CUENTA = ["Activo", "Pasivo", "Patrimonio", "Ingreso", "Gasto", "Costo"];
const camposCuenta = (opcional) => {
    const req = (c) => (opcional ? body(c).optional() : body(c));
    return [
        req("codigo").trim().matches(/^[0-9]{1,10}$/).withMessage("El código debe ser numérico (hasta 10 dígitos)."),
        req("nombre_cuenta").trim().isLength({ min: 3, max: 100 }).withMessage("El nombre es obligatorio (máximo 100 caracteres)."),
        req("tipo").isIn(TIPOS_CUENTA).withMessage(`Tipo inválido: ${TIPOS_CUENTA.join(", ")}.`),
        req("naturaleza").isIn(["Débito", "Crédito"]).withMessage("La naturaleza debe ser Débito o Crédito."),
    ];
};
export const crearCuentaValidation = camposCuenta(false);
export const actualizarCuentaValidation = [id("id"), ...camposCuenta(true)];
export const estadoCuentaValidation = [id("id"), body("estado").isIn(["Activa", "Inactiva"]).withMessage("Estado inválido.")];
export const movimientoValidation = [
    body("fecha").isISO8601().withMessage("La fecha es obligatoria (YYYY-MM-DD)."),
    body("concepto").trim().isLength({ min: 3, max: 150 }).withMessage("El concepto es obligatorio (máximo 150 caracteres)."),
    body("valor").isFloat({ gt: 0 }).withMessage("El valor debe ser mayor a 0."),
    body("fk_cuenta").isInt({ min: 1 }).withMessage("Selecciona la cuenta contable."),
    body("fk_metodo_pago").isInt({ min: 1 }).withMessage("Selecciona el método de pago."),
    body("fk_cliente").optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage("Cliente inválido."),
    body("fk_proveedor").optional({ nullable: true, checkFalsy: true }).isInt({ min: 1 }).withMessage("Proveedor inválido."),
    body("observaciones").optional({ nullable: true }).isLength({ max: 150 }).withMessage("Máximo 150 caracteres."),
];
export const anularMovimientoValidation = [id("id"), body("motivo").trim().isLength({ min: 3, max: 120 }).withMessage("Indica el motivo.")];
export const fechaCorteValidation = [query("fechaCorte").optional().isISO8601().withMessage("fechaCorte debe tener formato YYYY-MM-DD.")];

// ---------- Permisos (HU-SEG-007) ----------
export const permisosValidation = [
    param("idrol").isIn(["2", "3"]).withMessage("Solo se configuran los roles Vendedor (2) y Finanzas (3)."),
    body("permisos").isArray().withMessage("permisos debe ser una lista."),
];
