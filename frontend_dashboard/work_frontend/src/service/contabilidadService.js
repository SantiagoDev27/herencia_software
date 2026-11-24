import axiosClient from "./axiosClient";
import { descargarBlob } from "../lib/format";

// HU-CON-001..008: contabilidad -> /api/contabilidad
const B = "/contabilidad";
const pdf = (ruta, nombre) => async (params = {}) => {
  const blob = await axiosClient.get(`${B}${ruta}`, { params, responseType: "blob" });
  descargarBlob(blob, nombre(params));
};

const contabilidadService = {
  metodosPago: () => axiosClient.get(`${B}/metodos-pago`),
  cuentas: (params = {}) => axiosClient.get(`${B}/cuentas`, { params }),
  crearCuenta: (datos) => axiosClient.post(`${B}/cuentas`, datos),
  actualizarCuenta: (id, datos) => axiosClient.put(`${B}/cuentas/${id}`, datos),
  estadoCuenta: (id, estado) => axiosClient.patch(`${B}/cuentas/${id}/estado`, { estado }),

  movimientos: (params = {}) => axiosClient.get(`${B}/movimientos`, { params }),
  registrar: (tipo, datos) => axiosClient.post(`${B}/${tipo === "Ingreso" ? "ingresos" : "egresos"}`, datos),
  anular: (tipo, id, motivo) => axiosClient.patch(`${B}/${tipo === "Ingreso" ? "ingresos" : "egresos"}/${id}/anular`, { motivo }),
  comprobante: async (tipo, id, referencia) => {
    const blob = await axiosClient.get(`${B}/${tipo === "Ingreso" ? "ingresos" : "egresos"}/${id}/comprobante-pdf`, { responseType: "blob" });
    descargarBlob(blob, `Comprobante-${referencia}.pdf`);
  },

  balance: (params = {}) => axiosClient.get(`${B}/balance-general`, { params }),
  balancePDF: pdf("/balance-general/pdf", (p) => `Balance-General-${p.fechaCorte ?? ""}.pdf`),
  resultados: (params = {}) => axiosClient.get(`${B}/estado-resultados`, { params }),
  resultadosPDF: pdf("/estado-resultados/pdf", (p) => `Estado-Resultados-${p.fechaInicio}-a-${p.fechaFin}.pdf`),
  flujo: (params = {}) => axiosClient.get(`${B}/flujo-caja`, { params }),
  flujoPDF: pdf("/flujo-caja/pdf", (p) => `Flujo-Caja-${p.fechaInicio}-a-${p.fechaFin}.pdf`),
};

export default contabilidadService;
