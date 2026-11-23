import axiosClient from "./axiosClient";

// Gestión de usuarios (solo Administrador) -> /api/usuarios
const usuarioService = {
  // params: { busqueda, rol, estado: "activos" | "inactivos" }
  listar: (params = {}) => axiosClient.get("/usuarios", { params }),
  obtener: (id) => axiosClient.get(`/usuarios/${id}`),
  // body: { nombre_usuario, apellido_usuario, correo_usuario, contraseña_usuario, telefono_usuario?, fk_usuario_id_rol }
  crear: (datos) => axiosClient.post("/usuarios", datos),
  actualizar: (id, datos) => axiosClient.put(`/usuarios/${id}`, datos),
  cambiarEstado: (id, activo) => axiosClient.patch(`/usuarios/${id}/estado`, { activo }),
  restablecerContrasena: (id, nueva_contrasena) => axiosClient.patch(`/usuarios/${id}/contrasena`, { nueva_contrasena }),
  roles: () => axiosClient.get("/usuarios/roles"),
  auditoria: (limite = 100) => axiosClient.get("/usuarios/auditoria", { params: { limite } }),
};

export default usuarioService;
