import axiosClient from "./axiosClient";

// OJO: en el backend el router de proveedores se monta en /api/proveedores y define sus
// rutas internas como "/proveedores/...", por eso el prefijo queda duplicado:
//   /api/proveedores/proveedores, /api/proveedores/productos/:id/proveedores, etc.
const BASE = "/proveedores";

const proveedorService = {
  obtenerTodos: () => axiosClient.get(`${BASE}/proveedores`),
  obtenerPorId: (id) => axiosClient.get(`${BASE}/proveedores/${id}`),
  crear: (datos) => axiosClient.post(`${BASE}/proveedores`, datos),
  actualizar: (id, datos) => axiosClient.patch(`${BASE}/proveedores/${id}`, datos),
  eliminar: (id) => axiosClient.delete(`${BASE}/proveedores/${id}`),
  restaurar: (id) => axiosClient.patch(`${BASE}/proveedores/${id}/restaurar`),

  // Asociación proveedor <-> producto (con precio de compra)
  asociarProducto: (idProveedor, datos) =>
    axiosClient.post(`${BASE}/proveedores/${idProveedor}/productos`, datos),
  obtenerProductosDeProveedor: (idProveedor) =>
    axiosClient.get(`${BASE}/proveedores/${idProveedor}/productos`),
  obtenerProveedoresDeProducto: (idProducto) =>
    axiosClient.get(`${BASE}/productos/${idProducto}/proveedores`),
  actualizarPrecioCompra: (idAsociacion, datos) =>
    axiosClient.patch(`${BASE}/proveedor-producto/${idAsociacion}`, datos),
  eliminarAsociacion: (idAsociacion) =>
    axiosClient.delete(`${BASE}/proveedor-producto/${idAsociacion}`),
};

export default proveedorService;
