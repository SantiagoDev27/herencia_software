import ReporteProveedoresService from "../services/ReporteProveedoresService.js";
import PdfGenerator from "../utils/pdfGenerator.js";

export default {
    async generar(req, res, next) {
        try {
            return res.json({ success: true, data: await ReporteProveedoresService.generar(req.query) });
        } catch (error) {
            next(error);
        }
    },
    async pdf(req, res, next) {
        try {
            const r = await ReporteProveedoresService.generar(req.query);
            const pct = (v) => (v === null ? "—" : `${v}%`);
            PdfGenerator.generarReporteTabular(res, {
                titulo: "REPORTE DE PROVEEDORES",
                subtitulo: `Del ${r.periodo.fechaInicio} al ${r.periodo.fechaFin}`,
                archivo: `reporte-proveedores-${r.periodo.fechaInicio}-a-${r.periodo.fechaFin}`,
                cajas: [
                    { label: "Proveedores activos", value: String(r.resumen.proveedores) },
                    { label: "Órdenes de compra", value: String(r.resumen.ordenes) },
                    { label: "Total comprado", value: PdfGenerator._formatearMoneda(r.resumen.total_comprado) },
                ],
                tablas: [{
                    titulo: "Compras y desempeño por proveedor",
                    columnas: [
                        { label: "Proveedor", width: 0.28 }, { label: "Órdenes", width: 0.1, align: "right" },
                        { label: "Recibidas", width: 0.1, align: "right" }, { label: "Total comprado", width: 0.18, align: "right" },
                        { label: "Cumplim.", width: 0.12, align: "right" }, { label: "A tiempo", width: 0.11, align: "right" },
                        { label: "Calif.", width: 0.11, align: "right" },
                    ],
                    filas: r.proveedores.map((p) => [p.razon_social, p.ordenes, p.recibidas, PdfGenerator._formatearMoneda(p.total_comprado, false),
                        pct(p.cumplimiento), pct(p.entregas_a_tiempo), p.calificacion === null ? "—" : `${p.calificacion}/5`]),
                }],
            });
        } catch (error) {
            next(error);
        }
    },
};
