import { Op } from "sequelize";
import sequelize from "../configuration/database.js";
import Venta from "../models/VentaModel.js";
import DetVenta from "../models/DetVentaModel.js";
import Cliente from "../models/clienteModel.js";
import Usuario from "../models/UsuariosModels.js";

class VentaRepository {

    // Crear venta
    async creardatos(datosVenta, transaction = null) {
        return await Venta.create(datosVenta, { transaction });
    }

    async obtenerporid(id_venta) {
        return await Venta.findByPk(id_venta, {
            include: [
                {
                    model: Cliente,
                    as: "cliente"
                },
                {
                    model: Usuario,
                    as: "usuario"
                }
            ]
        });
    }

    async obtenerporcodigo(numero_venta) {
        return await Venta.findOne({
            where: {
                numero_venta: numero_venta
            }
        });
    }

    async actualizartotales(id_venta, subtotal, iva, total, transaction = null) {
        return await Venta.update(
            {
                subtotal,
                iva,
                total
            },
            {
                where: {
                    id_venta: id_venta
                },
                transaction
            }
        );
    }

    async obtenerTodos({ limit, offset, fechaInicio, fechaFin, fk_venta_id_cliente, numero_venta }) {
        const where = {};

        if (fechaInicio && fechaFin) {
            where.fecha = {
                [Op.between]: [fechaInicio, fechaFin]
            };
        } else if (fechaInicio) {
            where.fecha = {
                [Op.gte]: fechaInicio
            };
        } else if (fechaFin) {
            where.fecha = {
                [Op.lte]: fechaFin
            };
        }

        if (fk_venta_id_cliente) {
            where.fk_venta_id_cliente = fk_venta_id_cliente;
        }

        if (numero_venta) {
            where.numero_venta = { [Op.like]: `%${numero_venta}%` };
        }

        return await Venta.findAndCountAll({
            where,
            limit,
            offset,
            // Se incluyen los productos vendidos para mostrar cada venta como salida de inventario
            include: [{
                model: DetVenta,
                as: "detalles_venta",
                attributes: ["id_detalleventa", "fk_det_venta_id_producto", "cantidad", "precio_venta", "total"]
            }, {
                model: Usuario,
                as: "usuario",
                attributes: ["idusuario", "nombre_usuario", "apellido_usuario"]
            }],
            distinct: true, // el conteo sigue siendo de ventas, no de filas de detalle
            order: [["fecha", "DESC"], ["id_venta", "DESC"]]
        });
    }

    // Ventas de un periodo con sus líneas y productos (reporte general de ventas)
    async obtenerParaReporte({ fechaInicio, fechaFin }) {
        return await Venta.findAll({
            where: { fecha: { [Op.between]: [fechaInicio, fechaFin] } },
            include: [
                {
                    model: DetVenta,
                    as: "detalles_venta",
                    include: [{
                        association: "producto",
                        attributes: ["id_producto", "codigo_producto", "nombre_producto", "costo_produccion"],
                        paranoid: false
                    }]
                },
                { model: Usuario, as: "usuario", attributes: ["idusuario", "nombre_usuario", "apellido_usuario"] },
                { model: Cliente, as: "cliente" }
            ],
            order: [["fecha", "ASC"], ["id_venta", "ASC"]]
        });
    }

    // Venta con el consecutivo "VEN-NNN" más alto. Se ordena por el número y no por el id,
    // para que una venta con otro formato (importada, VEN-H01...) no reinicie el consecutivo.
    async obtenerUltimoNumeroVenta(transaction = null) {
        return await Venta.findOne({
            where: { numero_venta: { [Op.regexp]: "^VEN-[0-9]+$" } },
            order: [[sequelize.literal("CAST(SUBSTRING(numero_venta, 5) AS UNSIGNED)"), "DESC"]],
            transaction
        });
    }
}

export default new VentaRepository();