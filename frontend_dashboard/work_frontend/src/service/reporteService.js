import axiosClient from "./axiosClient";
import { descargarBlob, hoyISO } from "../lib/format";

// params: { umbral, dias }  (el backend usa 15 y 30 si no se envían)
const reporteService = {
  obtenerReporteInventario: (params = {}) => axiosClient.get("/reportes/inventario", { params }),
  descargarReporteInventarioPDF: async (params = {}) => {
    const blob = await axiosClient.get("/reportes/inventario/pdf", { params, responseType: "blob" });
    descargarBlob(blob, `Reporte-Inventario-${hoyISO()}.pdf`);
  },
};

export default reporteService;
