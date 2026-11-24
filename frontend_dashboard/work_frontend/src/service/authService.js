import axiosClient from "./axiosClient";

// El registro público se eliminó: las cuentas las crea el administrador (ver usuarioService)
const authService = {
    login: (credenciales) => axiosClient.post("/auth/login", credenciales),
    logout: () => axiosClient.post("/auth/logout"),
    perfil: () => axiosClient.get("/auth/perfil"),
    // body: { contrasena_actual, nueva_contrasena }
    cambiarContrasena: (datos) => axiosClient.patch("/auth/cambiar-contrasena", datos),
};

export default authService;
