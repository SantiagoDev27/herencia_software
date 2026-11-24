import axiosClient from "./axiosClient";

// HU-VEN-006: clientes -> /api/clientes
const clienteService = {
  listar: (busqueda) => axiosClient.get("/clientes", { params: busqueda ? { busqueda } : undefined }),
  crear: (datos) => axiosClient.post("/clientes", datos),
  actualizar: (id, datos) => axiosClient.put(`/clientes/${id}`, datos),
  eliminar: (id) => axiosClient.delete(`/clientes/${id}`),
};

export default clienteService;
