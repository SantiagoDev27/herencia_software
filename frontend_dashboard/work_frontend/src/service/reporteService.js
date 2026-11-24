import axiosClient from "./axiosClient";
import { descargarBlob, hoyISO } from "../lib/format";

const reporteService = {
  // Inventario. params: { umbral, dias }  (el backend usa 15 y 30 si no se envían)
  obtenerReporteInventario: (params = {}) => axiosClient.get("/reportes/inventario", { params }),
  descargarReporteInventarioPDF: async (params = {}) => {
    const blob = await axiosClient.get("/reportes/inventario/pdf", { params, responseType: "blob" });
    descargarBlob(blob, `Reporte-Inventario-${hoyISO()}.pdf`);
  },

  // Reporte general de ventas (Finanzas). params: { fechaInicio, fechaFin } (por defecto el último mes)
  obtenerReporteVentas: (params = {}) => axiosClient.get("/reportes/ventas", { params }),
  descargarReporteVentasPDF: async (params = {}) => {
    const blob = await axiosClient.get("/reportes/ventas/pdf", { params, responseType: "blob" });
    descargarBlob(blob, `Reporte-Ventas-${params.fechaInicio ?? ""}-a-${params.fechaFin ?? hoyISO()}.pdf`);
  },
};

export default reporteService;
