import VentaService from "../services/VentaService.js";
import PdfGenerator from "../utils/pdfGenerator.js";

const ok = (res, data, message, status = 200) => res.status(status).json({ success: true, message, data });

class VentaController {

    // POST /ventas — el vendedor es siempre el usuario autenticado
    async crear(req, res, next) {
        try {
            const { fecha, fk_venta_id_cliente, fk_venta_id_metodopago, descuento, detalles } = req.body;
            const resultado = await VentaService.crearVentaCompleta(
                { fecha, fk_venta_id_cliente, fk_venta_id_metodopago, descuento, fk_venta_id_usuario: req.usuario.idusuario },
                detalles
            );
            return ok(res, resultado, "Venta creada exitosamente", 201);
        } catch (error) {
            next(error);
        }
    }

    async obtenerPorId(req, res, next) {
        try {
            return ok(res, await VentaService.obtenerVentaConDetalles(req.params.id_venta));
        } catch (error) {
            next(error);
        }
    }

    async obtenerPorCodigo(req, res, next) {
        try {
            return ok(res, await VentaService.obtenerPorCodigo(req.params.numero_venta));
        } catch (error) {
            next(error);
        }
    }

    async listar(req, res, next) {
        try {
            const { pagina, limite, fechaInicio, fechaFin, fk_venta_id_cliente, numero_venta, estado } = req.query;
            return ok(res, await VentaService.listarVentas({ pagina, limite, fechaInicio, fechaFin, fk_venta_id_cliente, numero_venta, estado }));
        } catch (error) {
            next(error);
        }
    }

    // PUT /ventas/:id_venta — HU-VEN-002
    async actualizar(req, res, next) {
        try {
            const resultado = await VentaService.actualizarVenta(req.params.id_venta, req.body, req.usuario);
            return ok(res, resultado, "Venta actualizada exitosamente");
        } catch (error) {
            next(error);
        }
    }

    // PATCH /ventas/:id_venta/anular — HU-VEN-003
    async anular(req, res, next) {
        try {
            const resultado = await VentaService.anularVenta(req.params.id_venta, req.body.motivo, req.usuario);
            return ok(res, resultado, "Venta anulada. El inventario fue restaurado.");
        } catch (error) {
            next(error);
        }
    }

    // POST /ventas/:id_venta/devoluciones — HU-VEN-007
    async registrarDevolucion(req, res, next) {
        try {
            const resultado = await VentaService.registrarDevolucion(req.params.id_venta, req.body, req.usuario);
            return ok(res, resultado, "Devolución registrada", 201);
        } catch (error) {
            next(error);
        }
    }

    async listarDevoluciones(req, res, next) {
        try {
            const { fechaInicio, fechaFin, id_venta } = req.query;
            return ok(res, await VentaService.listarDevoluciones({ fechaInicio, fechaFin, id_venta }));
        } catch (error) {
            next(error);
        }
    }

    async comprobanteDevolucionPDF(req, res, next) {
        try {
            const dev = (await VentaService.obtenerDevolucion(req.params.id)).toJSON();
            PdfGenerator.generarComprobante(res, {
                titulo: "COMPROBANTE DE DEVOLUCIÓN",
                numero: `DEV-${dev.id_devolucion}`,
                archivo: `devolucion-DEV-${dev.id_devolucion}`,
                datos: [
                    ["Venta", dev.venta?.numero_venta ?? "—"],
                    ["Fecha", new Date(dev.fecha).toLocaleString("es-CO")],
                    ["Motivo", dev.motivo],
                    ["Reintegrado al inventario", dev.reintegrado ? "Sí" : "No"],
                    ["Registró", `${dev.usuario?.nombre_usuario ?? ""} ${dev.usuario?.apellido_usuario ?? ""}`.trim()],
                ],
                columnas: ["Producto", "Cant.", "Subtotal", "IVA", "Total"],
                filas: dev.detalles.map((d) => [d.producto?.nombre_producto ?? `#${d.fk_det_devolucion_id_producto}`, d.cantidad, d.subtotal, d.iva, d.total]),
                total: dev.total,
            });
        } catch (error) {
            next(error);
        }
    }

    async recalcularTotales(req, res, next) {
        try {
            return ok(res, await VentaService.recalcularTotales(req.params.id_venta), "Totales recalculados exitosamente");
        } catch (error) {
            next(error);
        }
    }

    async generarFacturaPDF(req, res, next) {
        try {
            const { venta, detalles } = await VentaService.obtenerVentaConDetalles(req.params.id_venta);
            venta.cantidad_items = detalles.reduce((acc, d) => acc + Number(d.cantidad || 0), 0);
            PdfGenerator.generarFacturaVenta(res, venta, detalles);
        } catch (error) {
            next(error);
        }
    }
}

export default new VentaController();
