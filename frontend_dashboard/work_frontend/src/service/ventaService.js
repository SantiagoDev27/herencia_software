import axiosClient from "./axiosClient";
import { descargarBlob } from "../lib/format";

// Igual que proveedores, el router de ventas se monta en /api/ventas y define "/ventas/...":
//   /api/ventas/ventas, /api/ventas/ventas/:id_venta, ...
const BASE = "/ventas/ventas";

const ventaService = {
  // params: { pagina, limite }  -> respuesta: data = { ventas, total, paginaActual, totalPaginas }
  listarVentas: (params = {}) => axiosClient.get(BASE, { params }),
  // respuesta: data = { venta (con cliente y usuario), detalles (con producto) }
  obtenerPorId: (id) => axiosClient.get(`${BASE}/${id}`),
  obtenerPorCodigo: (numeroVenta) => axiosClient.get(`${BASE}/codigo/${encodeURIComponent(numeroVenta)}`),
  // body: { fecha, fk_venta_id_cliente?, fk_venta_id_usuario?, descuento?, detalles:[{ fk_det_venta_id_producto, cantidad }] }
  crearVenta: (datos) => axiosClient.post(BASE, datos),
  recalcular: (id) => axiosClient.patch(`${BASE}/${id}/recalcular`),
  descargarFacturaPDF: async (idVenta, numeroVenta = "factura") => {
    const blob = await axiosClient.get(`${BASE}/${idVenta}/factura-pdf`, { responseType: "blob" });
    descargarBlob(blob, `Factura-${numeroVenta}.pdf`);
  },
};

export default ventaService;
