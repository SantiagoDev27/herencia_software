import ReporteVentasService from "../services/ReporteVentasService.js";
import PdfGenerator from "../utils/pdfGenerator.js";

class ReporteVentasController {

    // GET /api/reportes/ventas?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD  (por defecto: último mes)
    async generarReporteVentas(req, res, next) {
        try {
            const { fechaInicio, fechaFin } = req.query;
            const reporte = await ReporteVentasService.generarReporteVentas({ fechaInicio, fechaFin });
            return res.status(200).json({
                success: true,
                message: "Reporte general de ventas generado correctamente.",
                data: reporte
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/reportes/ventas/pdf
    async generarReporteVentasPDF(req, res, next) {
        try {
            const { fechaInicio, fechaFin } = req.query;
            const reporte = await ReporteVentasService.generarReporteVentas({ fechaInicio, fechaFin });
            PdfGenerator.generarReporteVentas(res, reporte);
        } catch (error) {
            next(error);
        }
    }
}

export default new ReporteVentasController();
