import axiosClient from "./axiosClient";

// Rutas del backend: /api/productos
// (el backend no expone GET /productos/:id; el detalle viene en el listado)
const productoService = {
  obtenerTodos: () => axiosClient.get("/productos"),
  obtenerConStock: () => axiosClient.get("/productos/con-stock"),
  obtenerSinStock: () => axiosClient.get("/productos/sin-stock"),
  obtenerStockBajo: (umbral) =>
    axiosClient.get("/productos/stock-bajo", { params: umbral ? { umbral } : undefined }),
  obtenerProximosAVencer: (dias) =>
    axiosClient.get("/productos/proximos-vencer", { params: dias ? { dias } : undefined }),
  obtenerPorCodigo: (codigo) => axiosClient.get(`/productos/codigo/${encodeURIComponent(codigo)}`),
  crear: (datos) => axiosClient.post("/productos", datos),
  actualizar: (id, datos) => axiosClient.put(`/productos/${id}`, datos),
  eliminar: (id) => axiosClient.delete(`/productos/${id}`),
};

export default productoService;
