import OrdenCompraService from "../services/OrdenCompraService.js";
import PdfGenerator from "../utils/pdfGenerator.js";

const manejar = (fn, mensaje, status = 200) => async (req, res, next) => {
    try {
        return res.status(status).json({ success: true, message: mensaje, data: await fn(req) });
    } catch (error) {
        next(error);
    }
};

export default {
    listar: manejar((req) => OrdenCompraService.listar(req.query)),
    obtener: manejar((req) => OrdenCompraService.obtener(req.params.id)),
    crear: manejar((req) => OrdenCompraService.crear(req.body, req.usuario), "Orden de compra registrada.", 201),
    recibir: manejar((req) => OrdenCompraService.recibir(req.params.id, req.body, req.usuario), "Orden recibida: inventario actualizado."),
    cancelar: manejar((req) => OrdenCompraService.cancelar(req.params.id, req.body.motivo, req.usuario), "Orden cancelada."),
    async pdf(req, res, next) {
        try {
            const o = (await OrdenCompraService.obtener(req.params.id)).toJSON();
            PdfGenerator.generarComprobante(res, {
                titulo: "ORDEN DE COMPRA",
                numero: `OC-${o.numero_orden}`,
                archivo: `orden-compra-OC-${o.numero_orden}`,
                datos: [
                    ["Proveedor", `${o.proveedor?.razon_social ?? "—"} (NIT ${o.proveedor?.nit ?? "—"})`],
                    ["Teléfono / ciudad", `${o.proveedor?.telefono_proveedor ?? "—"} · ${o.proveedor?.ciudad ?? "—"}`],
                    ["Fecha", new Date(o.fecha).toLocaleDateString("es-CO")],
                    ["Entrega estimada", o.fecha_entrega_estimada ?? "—"],
                    ["Estado", o.estado],
                    ["Observación", o.observacion ?? "—"],
                ],
                columnas: ["Producto", "Cant.", "Precio unit.", "IVA", "Total"],
                filas: o.detalles.map((d) => [d.producto?.nombre_producto ?? `#${d.fk_det_compra_id_producto}`, d.cantidad, d.precio_unitario, d.iva, d.total]),
                total: o.total,
            });
        } catch (error) {
            next(error);
        }
    },
};
