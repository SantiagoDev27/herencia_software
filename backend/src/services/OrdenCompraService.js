import { Op } from "sequelize";
import sequelize from "../configuration/database.js";
import AppError from "../utils/AppError.js";
import Proveedor from "../models/ProovedorModel.js";
import Producto from "../models/ProductModels.js";
import ProductoProveedor from "../models/Producto-ProovedorModel.js";
import { OrdenCompra, DetCompra } from "../models/NegocioModels.js";
import IngresoMercanciaService from "./IngresoMercancia.service.js";
import ContabilidadRepository from "../repositories/ContabilidadRepository.js";
import AuditoriaRepository from "../repositories/AuditoriaRepository.js";
import { fechaContable, redondear } from "../utils/fechas.js";

export const ESTADOS_ORDEN = Object.freeze({ PENDIENTE: "Pendiente", RECIBIDA: "Recibida", CANCELADA: "Cancelada" });

const INCLUDE = [
    { model: Proveedor, as: "proveedor", paranoid: false },
    { model: DetCompra, as: "detalles", include: [{ model: Producto, as: "producto", paranoid: false, attributes: ["id_producto", "codigo_producto", "nombre_producto", "iva"] }] },
    { association: "usuario", attributes: ["idusuario", "nombre_usuario", "apellido_usuario"] },
];

// HU-PROV-006: Gestionar órdenes de compra
class OrdenCompraService {
    async listar({ estado, fk_proveedor, fechaInicio, fechaFin } = {}) {
        const where = {};
        if (estado) where.estado = estado;
        if (fk_proveedor) where.fk_orden_compra_id_proveedor = fk_proveedor;
        const fechas = ContabilidadRepository.condicionFechas(fechaInicio, fechaFin, "OrdenCompra.fecha");
        if (fechas.length) where[Op.and] = fechas;
        return await OrdenCompra.findAll({ where, include: INCLUDE, order: [["numero_orden", "DESC"]] });
    }

    async obtener(id) {
        const orden = await OrdenCompra.findByPk(id, { include: INCLUDE });
        if (!orden) throw new AppError("Orden de compra no encontrada.", 404);
        return orden;
    }

    async crear({ fk_proveedor, fecha_entrega_estimada, observacion, detalles }, usuario) {
        const proveedor = await Proveedor.findByPk(fk_proveedor);
        if (!proveedor) throw new AppError("El proveedor no existe o está desactivado.", 404);
        const ids = detalles.map((d) => Number(d.fk_producto));
        if (new Set(ids).size !== ids.length) throw new AppError("Hay productos repetidos en la orden.", 400);

        return await sequelize.transaction(async (transaction) => {
            let subtotal = 0;
            let iva = 0;
            const lineas = [];
            for (const d of detalles) {
                const producto = await Producto.findByPk(d.fk_producto, { transaction });
                if (!producto) throw new AppError(`El producto ${d.fk_producto} no existe.`, 404);
                let precio = d.precio_unitario;
                if (precio === undefined || precio === null || precio === "") {
                    const pactado = await ProductoProveedor.findOne({
                        where: { fk_producto_proveedor_id_proveedor: fk_proveedor, fk_producto_proveedor_id_producto: d.fk_producto },
                        transaction,
                    });
                    precio = pactado ? pactado.precio_compra : producto.costo_produccion;
                }
                const sub = Number(d.cantidad) * Number(precio);
                const ivaLinea = sub * (Number(producto.iva || 0) / 100);
                subtotal += sub;
                iva += ivaLinea;
                lineas.push({ fk_det_compra_id_producto: d.fk_producto, cantidad: d.cantidad, precio_unitario: precio, subtotal: redondear(sub), iva: redondear(ivaLinea), total: redondear(sub + ivaLinea) });
            }

            const ultimo = (await OrdenCompra.max("numero_orden", { transaction })) || 0;
            const orden = await OrdenCompra.create({
                numero_orden: Number(ultimo) + 1,
                fk_orden_compra_id_proveedor: fk_proveedor,
                fecha: new Date(),
                subtotal: redondear(subtotal),
                iva: redondear(iva),
                total: redondear(subtotal + iva),
                estado: ESTADOS_ORDEN.PENDIENTE,
                observacion: observacion || null,
                fecha_entrega_estimada: fecha_entrega_estimada || null,
                fk_orden_compra_id_usuario: usuario.idusuario,
            }, { transaction });
            await DetCompra.bulkCreate(lineas.map((l) => ({ ...l, fk_det_compra_id_ordencompra: orden.id_orden_compra })), { transaction });
            await AuditoriaRepository.registrar({ idusuario: usuario.idusuario, correo: usuario.correo_usuario, accion: "CREAR_ORDEN_COMPRA", detalle: `OC-${orden.numero_orden} a ${proveedor.razon_social}` });
            return orden;
        }).then((orden) => this.obtener(orden.id_orden_compra));
    }

    // Recibir: crea la entrada de mercancía con sus lotes y, si se indica, el egreso del pago
    async recibir(id, { detalles, registrar_pago = true, fk_metodo_pago = 4 }, usuario) {
        const transaction = await sequelize.transaction();
        try {
            const orden = await OrdenCompra.findByPk(id, { include: [{ model: DetCompra, as: "detalles" }], transaction, lock: transaction.LOCK.UPDATE });
            if (!orden) throw new AppError("Orden de compra no encontrada.", 404);
            if (orden.estado !== ESTADOS_ORDEN.PENDIENTE) throw new AppError(`La orden OC-${orden.numero_orden} ya está ${orden.estado.toLowerCase()}.`, 409);

            const lotes = new Map(detalles.map((d) => [Number(d.fk_producto), d]));
            const lineas = orden.detalles.map((det) => {
                const lote = lotes.get(Number(det.fk_det_compra_id_producto));
                if (!lote) throw new AppError(`Falta el lote del producto ${det.fk_det_compra_id_producto}.`, 400);
                return {
                    fk_det_entrada_id_producto: det.fk_det_compra_id_producto,
                    cantidad: det.cantidad,
                    precio_unitario: det.precio_unitario,
                    iva: Number(det.subtotal) > 0 ? (Number(det.iva) / Number(det.subtotal)) * 100 : 0,
                    numero_lote: lote.numero_lote,
                    fecha_vencimiento: lote.fecha_vencimiento,
                    fecha_produccion: lote.fecha_produccion || null,
                };
            });

            const entrada = await IngresoMercanciaService.registrarEntrada({
                codigo_entrada: `OC-${orden.numero_orden}`,
                observacion: `Recepción de la orden de compra OC-${orden.numero_orden}`,
                detalles: lineas,
            }, transaction);

            await orden.update({ estado: ESTADOS_ORDEN.RECIBIDA, fecha_recepcion: new Date(), fk_orden_compra_id_entrada: entrada.id_entrada }, { transaction });

            if (registrar_pago) {
                await ContabilidadRepository.egresoAutomatico({
                    fecha: fechaContable(),
                    concepto: `Pago orden de compra OC-${orden.numero_orden}`,
                    codigoCuenta: "1435",
                    valor: orden.total,
                    metodo: fk_metodo_pago,
                    proveedor: orden.fk_orden_compra_id_proveedor,
                    usuario: usuario.idusuario,
                    referencia: `OC-${orden.numero_orden}`,
                    origen: "COMPRA",
                }, transaction);
            }
            await transaction.commit();
            await AuditoriaRepository.registrar({ idusuario: usuario.idusuario, correo: usuario.correo_usuario, accion: "RECIBIR_ORDEN_COMPRA", detalle: `OC-${orden.numero_orden} recibida (entrada ${entrada.codigo_entrada})` });
            return await this.obtener(id);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async cancelar(id, motivo, usuario) {
        const orden = await OrdenCompra.findByPk(id);
        if (!orden) throw new AppError("Orden de compra no encontrada.", 404);
        if (orden.estado !== ESTADOS_ORDEN.PENDIENTE) throw new AppError(`Solo se cancelan órdenes pendientes. OC-${orden.numero_orden} está ${orden.estado.toLowerCase()}.`, 409);
        await orden.update({ estado: ESTADOS_ORDEN.CANCELADA, observacion: `${orden.observacion ? orden.observacion + " | " : ""}Cancelada: ${motivo}`.slice(0, 255) });
        await AuditoriaRepository.registrar({ idusuario: usuario.idusuario, correo: usuario.correo_usuario, accion: "CANCELAR_ORDEN_COMPRA", detalle: `OC-${orden.numero_orden}: ${motivo}` });
        return await this.obtener(id);
    }

    async pendientesDeProveedor(fk_proveedor) {
        return await OrdenCompra.count({ where: { fk_orden_compra_id_proveedor: fk_proveedor, estado: ESTADOS_ORDEN.PENDIENTE } });
    }
}

export default new OrdenCompraService();
