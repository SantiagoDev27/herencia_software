import { Op, fn, col, where as sqlWhere } from "sequelize";
import { CuentaContable, Ingreso, Egreso, MetodoPago } from "../models/NegocioModels.js";
import Cliente from "../models/clienteModel.js";
import Proveedor from "../models/ProovedorModel.js";
import Usuario from "../models/UsuariosModels.js";
import AppError from "../utils/AppError.js";

const INCLUDES = (extra) => [
    { model: CuentaContable, as: "cuenta" },
    { model: MetodoPago, as: "metodo_pago" },
    { model: Usuario, as: "usuario", attributes: ["idusuario", "nombre_usuario", "apellido_usuario"] },
    extra,
];

class ContabilidadRepository {
    async cuentaPorCodigo(codigo, transaction = null) {
        const cuenta = await CuentaContable.findOne({ where: { codigo }, transaction });
        if (!cuenta) throw new AppError(`No existe la cuenta contable ${codigo}.`, 500);
        return cuenta;
    }

    // Registros automáticos (ventas, devoluciones, compras) — requisito 2.2.3.1 y 2.2.4.1
    async ingresoAutomatico({ fecha, concepto, codigoCuenta, valor, metodo, cliente, usuario, referencia, origen }, transaction) {
        const cuenta = await this.cuentaPorCodigo(codigoCuenta, transaction);
        return await Ingreso.create({
            fecha: fecha ?? new Date(), concepto, fk_cuenta: cuenta.id_cuenta, valor,
            fk_metodo_pago: metodo ?? 1, fk_cliente: cliente ?? null, fk_usuario: usuario,
            referencia, origen,
        }, { transaction });
    }

    async egresoAutomatico({ fecha, concepto, codigoCuenta, valor, metodo, proveedor, usuario, referencia, origen }, transaction) {
        const cuenta = await this.cuentaPorCodigo(codigoCuenta, transaction);
        return await Egreso.create({
            fecha: fecha ?? new Date(), concepto, fk_cuenta: cuenta.id_cuenta, valor,
            fk_metodo_pago: metodo ?? 1, fk_proveedor: proveedor ?? null, fk_usuario: usuario,
            referencia, origen,
        }, { transaction });
    }

    async actualizarIngresoDeVenta(referencia, cambios, transaction) {
        return await Ingreso.update(cambios, { where: { referencia, origen: "VENTA" }, transaction });
    }

    async listarIngresos(where) {
        return await Ingreso.findAll({ where, include: INCLUDES({ model: Cliente, as: "cliente" }), order: [["fecha", "DESC"], ["id_ingreso", "DESC"]] });
    }

    async listarEgresos(where) {
        return await Egreso.findAll({ where, include: INCLUDES({ model: Proveedor, as: "proveedor", paranoid: false }), order: [["fecha", "DESC"], ["id_egreso", "DESC"]] });
    }

    // Los movimientos contables son diarios: se filtra por DATE(fecha) para no depender de la zona horaria
    condicionFechas(fechaInicio, fechaFin, columna = "fecha") {
        const c = [];
        if (fechaInicio) c.push(sqlWhere(fn("DATE", col(columna)), Op.gte, fechaInicio));
        if (fechaFin) c.push(sqlWhere(fn("DATE", col(columna)), Op.lte, fechaFin));
        return c;
    }
}

export default new ContabilidadRepository();
