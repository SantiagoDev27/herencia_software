import { Op } from "sequelize";
import sequelize from "../configuration/database.js";
import AppError from "../utils/AppError.js";
import VentaRepository from "../repositories/VentaRepositories.js";
import DetVentaRepository from "../repositories/DetVentaRepository.js";
import DetVentaLoteRepository from "../repositories/DetVentaLoteRepository.js";
import ProductoRepository from "../repositories/ProductoRepositories.js";
import LoteRepository from "../repositories/LoteRepository.js";
import ContabilidadRepository from "../repositories/ContabilidadRepository.js";
import AuditoriaRepository from "../repositories/AuditoriaRepository.js";
import Venta from "../models/VentaModel.js";
import DetVenta from "../models/DetVentaModel.js";
import DetVentaLote from "../models/DetVentaLoteModel.js";
import Lote from "../models/loteModel.js";
import Cliente from "../models/clienteModel.js";
import { Devolucion, DetDevolucion, MetodoPago } from "../models/NegocioModels.js";
import { fechaContable, fechaLocalISO, redondear } from "../utils/fechas.js";

export const ESTADOS_VENTA = Object.freeze({
    REGISTRADA: "Registrada",
    DEVOLUCION_PARCIAL: "Devolución parcial",
    DEVUELTA: "Devuelta",
    ANULADA: "Anulada",
});

const auditar = (usuario, accion, detalle) =>
    AuditoriaRepository.registrar({ idusuario: usuario?.idusuario, correo: usuario?.correo_usuario, accion, detalle });

class VentaService {

    async generarNumeroVenta(transaction = null) {
        const ultimaVenta = await VentaRepository.obtenerUltimoNumeroVenta(transaction);
        let siguienteNumero = 1;
        if (ultimaVenta && ultimaVenta.numero_venta) {
            const numeroActual = parseInt(ultimaVenta.numero_venta.split("-")[1], 10);
            if (!isNaN(numeroActual)) siguienteNumero = numeroActual + 1;
        }
        return `VEN-${String(siguienteNumero).padStart(3, "0")}`;
    }

    async _validarClienteYMetodo({ fk_venta_id_cliente, fk_venta_id_metodopago }, transaction) {
        if (fk_venta_id_cliente && !(await Cliente.findByPk(fk_venta_id_cliente, { transaction }))) {
            throw new AppError(`El cliente con id ${fk_venta_id_cliente} no existe.`, 404);
        }
        if (fk_venta_id_metodopago && !(await MetodoPago.findByPk(fk_venta_id_metodopago, { transaction }))) {
            throw new AppError(`El método de pago ${fk_venta_id_metodopago} no existe.`, 404);
        }
    }

    // Valida stock por lotes y calcula cada línea con el precio e IVA del catálogo (nunca del body)
    async _calcularLineas(detallesProductos, transaction) {
        if (!detallesProductos || detallesProductos.length === 0) {
            throw new AppError("La venta debe contener al menos un producto", 400);
        }
        const ids = detallesProductos.map((d) => Number(d.fk_det_venta_id_producto));
        if (new Set(ids).size !== ids.length) throw new AppError("Hay productos repetidos en la venta.", 400);

        let subtotal = 0;
        let iva = 0;
        const lineas = [];
        for (const { fk_det_venta_id_producto, cantidad } of detallesProductos) {
            if (!cantidad || cantidad <= 0) throw new AppError(`Cantidad inválida para el producto ${fk_det_venta_id_producto}`, 400);

            const producto = await ProductoRepository.obtenerPorIdSimple(fk_det_venta_id_producto, { transaction, lock: transaction.LOCK.UPDATE });
            if (!producto) throw new AppError(`Producto con id ${fk_det_venta_id_producto} no existe`, 404);

            // Solo cuentan los lotes vigentes: un producto vencido no se puede vender
            const disponible = await LoteRepository.obtenerStockTotalPorProducto(fk_det_venta_id_producto, transaction, { soloVigentes: true });
            if (disponible < cantidad) {
                const vencidas = (await LoteRepository.obtenerStockTotalPorProducto(fk_det_venta_id_producto, transaction)) - disponible;
                const nota = vencidas > 0 ? ` (${vencidas} unidad${vencidas === 1 ? "" : "es"} en lotes vencidos no se pueden vender; dalas de baja con una salida de mercancía)` : "";
                throw new AppError(`Stock insuficiente para "${producto.nombre_producto}". Disponible: ${disponible}, solicitado: ${cantidad}${nota}`, 400);
            }

            const precio = Number(producto.precio_venta);
            const ivaProducto = Number(producto.iva);
            const sub = cantidad * precio;
            const ivaLinea = sub * (ivaProducto / 100);
            subtotal += sub;
            iva += ivaLinea;
            lineas.push({ fk_det_venta_id_producto, cantidad, precio_venta: precio, iva_producto: ivaProducto, subtotal: sub, total: sub + ivaLinea });
        }
        return { lineas, subtotal, iva };
    }

    // Crea los detalles, consume los lotes (FEFO) y descuenta el stock
    async _registrarLineas(id_venta, lineas, transaction) {
        for (const linea of lineas) {
            const det = await DetVentaRepository.creardatos({ ...linea, fk_det_venta_id_venta: id_venta }, transaction);
            const consumo = await LoteRepository.consumirStockFEFO(linea.fk_det_venta_id_producto, linea.cantidad, transaction, { soloVigentes: true });
            await DetVentaLoteRepository.crearVarios(consumo.map((c) => ({
                fk_det_venta_lote_id_detalleventa: det.id_detalleventa,
                fk_det_venta_lote_id_lote: c.id_lote,
                cantidad_tomada: c.cantidad_tomada,
            })), transaction);
            await ProductoRepository.decrementarStock(linea.fk_det_venta_id_producto, linea.cantidad, transaction);
        }
        await ProductoRepository.sincronizarVencimiento(lineas.map((l) => l.fk_det_venta_id_producto), transaction);
    }

    // Devuelve al inventario todo lo que la venta tomó (para anular o modificar)
    async _revertirLineas(id_venta, transaction, { borrar = false } = {}) {
        const detalles = await DetVenta.findAll({ where: { fk_det_venta_id_venta: id_venta }, transaction });
        const ids = [];
        for (const det of detalles) {
            const consumos = await DetVentaLote.findAll({ where: { fk_det_venta_lote_id_detalleventa: det.id_detalleventa }, transaction });
            let devueltoAlStock = 0;
            for (const c of consumos) {
                const pendiente = Number(c.cantidad_tomada) - Number(c.cantidad_devuelta || 0);
                if (pendiente > 0) {
                    await LoteRepository.incrementarCantidad(c.fk_det_venta_lote_id_lote, pendiente, transaction);
                    devueltoAlStock += pendiente;
                }
            }
            if (devueltoAlStock > 0) await ProductoRepository.incrementarStock(det.fk_det_venta_id_producto, devueltoAlStock, transaction);
            ids.push(det.fk_det_venta_id_producto);
            if (borrar) {
                await DetVentaLote.destroy({ where: { fk_det_venta_lote_id_detalleventa: det.id_detalleventa }, transaction });
                await det.destroy({ transaction });
            }
        }
        await ProductoRepository.sincronizarVencimiento(ids, transaction);
    }

    // ============================================
    // HU-VEN-001: Registrar venta (+ ingreso contable automático)
    // ============================================
    async crearVentaCompleta(datosVenta, detallesProductos) {
        const transaction = await sequelize.transaction();
        try {
            await this._validarClienteYMetodo(datosVenta, transaction);
            const { lineas, subtotal, iva } = await this._calcularLineas(detallesProductos, transaction);
            const descuento = Number(datosVenta.descuento) || 0;
            if (descuento > subtotal + iva) throw new AppError("El descuento no puede ser mayor que el total de la venta.", 400);
            const total = subtotal + iva - descuento;

            const numero = await this.generarNumeroVenta(transaction);
            const venta = await VentaRepository.creardatos({
                numero_venta: numero,
                fecha: datosVenta.fecha,
                fk_venta_id_cliente: datosVenta.fk_venta_id_cliente || null,
                fk_venta_id_usuario: datosVenta.fk_venta_id_usuario,
                fk_venta_id_metodopago: datosVenta.fk_venta_id_metodopago || 1,
                estado_venta: ESTADOS_VENTA.REGISTRADA,
                subtotal, iva, descuento, total,
            }, transaction);

            await this._registrarLineas(venta.id_venta, lineas, transaction);

            await ContabilidadRepository.ingresoAutomatico({
                fecha: fechaContable(datosVenta.fecha),
                concepto: `Venta ${numero}`,
                codigoCuenta: "4135",
                valor: total,
                metodo: datosVenta.fk_venta_id_metodopago || 1,
                cliente: datosVenta.fk_venta_id_cliente || null,
                usuario: datosVenta.fk_venta_id_usuario,
                referencia: numero,
                origen: "VENTA",
            }, transaction);

            await transaction.commit();
            return await this.obtenerVentaConDetalles(venta.id_venta);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async _ventaEditable(venta, accion) {
        if (!venta) throw new AppError("Venta no encontrada", 404);
        if (venta.estado_venta === ESTADOS_VENTA.ANULADA) throw new AppError(`La venta ${venta.numero_venta} está anulada.`, 409);
        const devoluciones = await Devolucion.count({ where: { fk_devolucion_id_venta: venta.id_venta } });
        if (devoluciones > 0) throw new AppError(`No se puede ${accion} la venta ${venta.numero_venta} porque tiene devoluciones registradas.`, 409);
    }

    // ============================================
    // HU-VEN-002: Modificar venta. Solo el mismo día (después hace parte del cierre diario),
    // sin devoluciones y no anulada. Revierte las líneas anteriores y aplica las nuevas.
    // ============================================
    async actualizarVenta(id_venta, datos, usuario) {
        const transaction = await sequelize.transaction();
        try {
            const venta = await Venta.findByPk(id_venta, { transaction, lock: transaction.LOCK.UPDATE });
            await this._ventaEditable(venta, "modificar");
            if (String(venta.fecha).slice(0, 10) !== fechaLocalISO()) {
                throw new AppError(`Solo se pueden modificar ventas del día. La venta ${venta.numero_venta} es del ${venta.fecha} y ya hace parte del cierre.`, 409);
            }
            await this._validarClienteYMetodo(datos, transaction);

            let { subtotal, iva } = venta;
            if (Array.isArray(datos.detalles)) {
                await this._revertirLineas(venta.id_venta, transaction, { borrar: true });
                const calculo = await this._calcularLineas(datos.detalles, transaction);
                await this._registrarLineas(venta.id_venta, calculo.lineas, transaction);
                subtotal = calculo.subtotal;
                iva = calculo.iva;
            }
            const descuento = datos.descuento !== undefined ? Number(datos.descuento) || 0 : Number(venta.descuento) || 0;
            const total = Number(subtotal) + Number(iva) - descuento;
            if (total < 0) throw new AppError("El descuento no puede ser mayor que el total de la venta.", 400);

            await venta.update({
                subtotal, iva, descuento, total,
                fk_venta_id_cliente: datos.fk_venta_id_cliente !== undefined ? datos.fk_venta_id_cliente || null : venta.fk_venta_id_cliente,
                fk_venta_id_metodopago: datos.fk_venta_id_metodopago ?? venta.fk_venta_id_metodopago,
                actualizada_en: new Date(),
            }, { transaction });

            await ContabilidadRepository.actualizarIngresoDeVenta(venta.numero_venta, {
                valor: total,
                fk_metodo_pago: venta.fk_venta_id_metodopago ?? 1,
                fk_cliente: venta.fk_venta_id_cliente,
            }, transaction);

            await transaction.commit();
            await auditar(usuario, "EDITAR_VENTA", `Modificó la venta ${venta.numero_venta} (total ${redondear(total)})`);
            return await this.obtenerVentaConDetalles(venta.id_venta);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    // ============================================
    // HU-VEN-003: Anular venta: restaura lotes y stock, anula el ingreso contable y queda en el historial
    // ============================================
    async anularVenta(id_venta, motivo, usuario) {
        const transaction = await sequelize.transaction();
        try {
            const venta = await Venta.findByPk(id_venta, { transaction, lock: transaction.LOCK.UPDATE });
            await this._ventaEditable(venta, "anular");
            await this._revertirLineas(venta.id_venta, transaction);
            await venta.update({
                estado_venta: ESTADOS_VENTA.ANULADA,
                motivo_anulacion: motivo,
                fecha_anulacion: new Date(),
            }, { transaction });
            await ContabilidadRepository.actualizarIngresoDeVenta(venta.numero_venta, { estado: "Anulado" }, transaction);
            await transaction.commit();
            await auditar(usuario, "ANULAR_VENTA", `Anuló la venta ${venta.numero_venta}: ${motivo}`);
            return await this.obtenerVentaConDetalles(venta.id_venta);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    // ============================================
    // HU-VEN-007: Registrar devolución. Valida contra lo vendido y lo ya devuelto,
    // reintegra al inventario (si el producto está en buen estado) y registra el egreso.
    // ============================================
    async registrarDevolucion(id_venta, { motivo, reintegrar = true, detalles }, usuario) {
        const transaction = await sequelize.transaction();
        try {
            const venta = await Venta.findByPk(id_venta, { transaction, lock: transaction.LOCK.UPDATE });
            if (!venta) throw new AppError("Venta no encontrada", 404);
            if (venta.estado_venta === ESTADOS_VENTA.ANULADA) throw new AppError("No se puede devolver una venta anulada.", 409);
            if (!Array.isArray(detalles) || detalles.length === 0) throw new AppError("Indica al menos un producto a devolver.", 400);

            const lineasVenta = await DetVenta.findAll({ where: { fk_det_venta_id_venta: id_venta }, include: [{ association: "producto", paranoid: false }], transaction });
            const yaDevuelto = await this._devueltoPorProducto(id_venta, transaction);

            const factorDescuento = Number(venta.subtotal) + Number(venta.iva) > 0
                ? 1 - (Number(venta.descuento) || 0) / (Number(venta.subtotal) + Number(venta.iva))
                : 1;

            const devolucion = await Devolucion.create({
                fk_devolucion_id_venta: id_venta,
                fecha: new Date(),
                motivo,
                fk_devolucion_id_usuario: usuario.idusuario,
                reintegrado: !!reintegrar,
                total: 0,
            }, { transaction });

            let total = 0;
            const productos = [];
            for (const { fk_producto, cantidad } of detalles) {
                const linea = lineasVenta.find((l) => Number(l.fk_det_venta_id_producto) === Number(fk_producto));
                if (!linea) throw new AppError(`El producto ${fk_producto} no hace parte de la venta ${venta.numero_venta}.`, 400);
                const disponible = Number(linea.cantidad) - (yaDevuelto.get(Number(fk_producto)) ?? 0);
                if (!Number.isInteger(Number(cantidad)) || cantidad <= 0 || cantidad > disponible) {
                    throw new AppError(`Cantidad a devolver inválida para "${linea.producto?.nombre_producto}". Máximo: ${disponible}.`, 400);
                }
                const sub = Number(linea.precio_venta) * cantidad * factorDescuento;
                const ivaLinea = sub * (Number(linea.iva_producto) / 100);
                await DetDevolucion.create({
                    fk_det_devolucion_id_devolucion: devolucion.id_devolucion,
                    fk_det_devolucion_id_producto: fk_producto,
                    cantidad,
                    subtotal: redondear(sub),
                    iva: redondear(ivaLinea),
                    total: redondear(sub + ivaLinea),
                    costo: redondear(cantidad * Number(linea.producto?.costo_produccion || 0)),
                }, { transaction });
                total += sub + ivaLinea;

                if (reintegrar) {
                    // Vuelve a los lotes de donde salió, empezando por el que vence más tarde
                    const consumos = await DetVentaLote.findAll({
                        where: { fk_det_venta_lote_id_detalleventa: linea.id_detalleventa },
                        include: [{ model: Lote, as: "lote" }],
                        transaction,
                    });
                    consumos.sort((a, b) => String(b.lote?.fecha_vencimiento).localeCompare(String(a.lote?.fecha_vencimiento)));
                    let restante = Number(cantidad);
                    for (const c of consumos) {
                        if (restante <= 0) break;
                        const cabe = Number(c.cantidad_tomada) - Number(c.cantidad_devuelta || 0);
                        const n = Math.min(cabe, restante);
                        if (n <= 0) continue;
                        await LoteRepository.incrementarCantidad(c.fk_det_venta_lote_id_lote, n, transaction);
                        await c.update({ cantidad_devuelta: Number(c.cantidad_devuelta || 0) + n }, { transaction });
                        restante -= n;
                    }
                    await ProductoRepository.incrementarStock(fk_producto, Number(cantidad), transaction);
                    productos.push(fk_producto);
                }
            }

            total = redondear(total);
            await devolucion.update({ total }, { transaction });
            if (productos.length) await ProductoRepository.sincronizarVencimiento(productos, transaction);

            // Estado de la venta según lo devuelto
            const devueltoAhora = await this._devueltoPorProducto(id_venta, transaction);
            const todo = lineasVenta.every((l) => (devueltoAhora.get(Number(l.fk_det_venta_id_producto)) ?? 0) >= Number(l.cantidad));
            await venta.update({ estado_venta: todo ? ESTADOS_VENTA.DEVUELTA : ESTADOS_VENTA.DEVOLUCION_PARCIAL }, { transaction });

            await ContabilidadRepository.egresoAutomatico({
                fecha: fechaContable(),
                concepto: `Devolución de la venta ${venta.numero_venta}`,
                codigoCuenta: "4175",
                valor: total,
                metodo: venta.fk_venta_id_metodopago ?? 1,
                usuario: usuario.idusuario,
                referencia: `DEV-${devolucion.id_devolucion}`,
                origen: "DEVOLUCION",
            }, transaction);

            await transaction.commit();
            await auditar(usuario, "DEVOLUCION", `Devolución DEV-${devolucion.id_devolucion} de la venta ${venta.numero_venta} por ${total}`);
            return await this.obtenerDevolucion(devolucion.id_devolucion);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async _devueltoPorProducto(id_venta, transaction = null) {
        const filas = await DetDevolucion.findAll({
            attributes: ["fk_det_devolucion_id_producto", [sequelize.fn("SUM", sequelize.col("DetDevolucion.cantidad")), "cantidad"]],
            include: [{ model: Devolucion, as: "devolucion", attributes: [], where: { fk_devolucion_id_venta: id_venta } }],
            group: ["fk_det_devolucion_id_producto"],
            raw: true,
            transaction,
        });
        return new Map(filas.map((f) => [Number(f.fk_det_devolucion_id_producto), Number(f.cantidad)]));
    }

    async obtenerDevolucion(id_devolucion) {
        const dev = await Devolucion.findByPk(id_devolucion, {
            include: [
                { model: DetDevolucion, as: "detalles", include: [{ association: "producto", paranoid: false }] },
                { model: Venta, as: "venta" },
                { association: "usuario", attributes: ["idusuario", "nombre_usuario", "apellido_usuario"] },
            ],
        });
        if (!dev) throw new AppError("Devolución no encontrada", 404);
        return dev;
    }

    async listarDevoluciones({ fechaInicio, fechaFin, id_venta } = {}) {
        const where = {};
        const and = ContabilidadRepository.condicionFechas(fechaInicio, fechaFin, "Devolucion.fecha");
        if (id_venta) where.fk_devolucion_id_venta = id_venta;
        if (and.length) where[Op.and] = and;
        return await Devolucion.findAll({
            where,
            include: [
                { model: DetDevolucion, as: "detalles", include: [{ association: "producto", paranoid: false, attributes: ["id_producto", "nombre_producto", "codigo_producto"] }] },
                { model: Venta, as: "venta", attributes: ["id_venta", "numero_venta", "fecha"] },
                { association: "usuario", attributes: ["idusuario", "nombre_usuario", "apellido_usuario"] },
            ],
            order: [["fecha", "DESC"]],
        });
    }

    async obtenerVentaConDetalles(id_venta) {
        const venta = await VentaRepository.obtenerporid(id_venta);
        if (!venta) throw new AppError("Venta no encontrada", 404);
        const detalles = await DetVentaRepository.obtenerporventa(id_venta);
        const devueltos = await this._devueltoPorProducto(id_venta);
        const devoluciones = await Devolucion.findAll({ where: { fk_devolucion_id_venta: id_venta }, order: [["fecha", "ASC"]] });
        const editable = venta.estado_venta === ESTADOS_VENTA.REGISTRADA && devoluciones.length === 0
            && String(venta.fecha).slice(0, 10) === fechaLocalISO();
        return {
            venta,
            detalles: detalles.map((d) => ({ ...d.toJSON(), cantidad_devuelta: devueltos.get(Number(d.fk_det_venta_id_producto)) ?? 0 })),
            devoluciones,
            editable,
        };
    }

    async obtenerPorCodigo(numero_venta) {
        const venta = await VentaRepository.obtenerporcodigo(numero_venta);
        if (!venta) throw new AppError("Venta no encontrada", 404);
        return venta;
    }

    async recalcularTotales(id_venta) {
        const detalles = await DetVentaRepository.obtenerporventa(id_venta);
        const subtotal = detalles.reduce((acc, d) => acc + Number(d.subtotal), 0);
        const iva = detalles.reduce((acc, d) => acc + Number(d.subtotal) * (Number(d.iva_producto) / 100), 0);
        const venta = await VentaRepository.obtenerporid(id_venta);
        const total = (subtotal + iva) - (Number(venta.descuento) || 0);
        return await VentaRepository.actualizartotales(id_venta, subtotal, iva, total);
    }

    async listarVentas(filtros) {
        const { pagina = 1, limite = 10, fechaInicio, fechaFin, fk_venta_id_cliente, numero_venta, estado } = filtros;
        const paginaNum = Math.max(parseInt(pagina, 10) || 1, 1);
        const limiteNum = Math.min(Math.max(parseInt(limite, 10) || 10, 1), 500);
        const resultado = await VentaRepository.obtenerTodos({
            limit: limiteNum,
            offset: (paginaNum - 1) * limiteNum,
            fechaInicio, fechaFin, fk_venta_id_cliente, numero_venta, estado,
        });
        return {
            ventas: resultado.rows,
            total: resultado.count,
            paginaActual: paginaNum,
            totalPaginas: Math.ceil(resultado.count / limiteNum),
        };
    }
}

export default new VentaService();
