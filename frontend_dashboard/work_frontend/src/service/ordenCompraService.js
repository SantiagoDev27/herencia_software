import axiosClient from "./axiosClient";
import { descargarBlob } from "../lib/format";

// HU-PROV-006: órdenes de compra -> /api/ordenes-compra
const ordenCompraService = {
  listar: (params = {}) => axiosClient.get("/ordenes-compra", { params }),
  obtener: (id) => axiosClient.get(`/ordenes-compra/${id}`),
  // body: { fk_proveedor, fecha_entrega_estimada?, observacion?, detalles:[{ fk_producto, cantidad, precio_unitario? }] }
  crear: (datos) => axiosClient.post("/ordenes-compra", datos),
  // body: { detalles:[{ fk_producto, numero_lote, fecha_vencimiento }], registrar_pago, fk_metodo_pago }
  recibir: (id, datos) => axiosClient.patch(`/ordenes-compra/${id}/recibir`, datos),
  cancelar: (id, motivo) => axiosClient.patch(`/ordenes-compra/${id}/cancelar`, { motivo }),
  descargarPDF: async (id, numero) => {
    const blob = await axiosClient.get(`/ordenes-compra/${id}/pdf`, { responseType: "blob" });
    descargarBlob(blob, `Orden-Compra-OC-${numero}.pdf`);
  },
};

export default ordenCompraService;
