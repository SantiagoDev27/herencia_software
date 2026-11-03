import axiosClient from "./axiosClient";

// Ingresos de mercancía  -> /api/ingreso-mercancia
//   body: { codigo_entrada, fecha?, observacion?, detalles:[{ fk_det_entrada_id_producto, cantidad,
//           precio_unitario, iva?, numero_lote, fecha_vencimiento, fecha_produccion? }] }
// Salidas de mercancía   -> /api/salida-mercancia
//   body: { codigo_salida, fecha?, observacion?, detalles:[{ fk_det_salida_id_producto, cantidad }] }
const movimientoService = {
  listarIngresos: () => axiosClient.get("/ingreso-mercancia"),
  obtenerIngresoPorId: (id) => axiosClient.get(`/ingreso-mercancia/${id}`),
  registrarIngreso: (datos) => axiosClient.post("/ingreso-mercancia", datos),

  listarSalidas: () => axiosClient.get("/salida-mercancia"),
  obtenerSalidaPorId: (id) => axiosClient.get(`/salida-mercancia/${id}`),
  registrarSalida: (datos) => axiosClient.post("/salida-mercancia", datos),
};

export default movimientoService;
