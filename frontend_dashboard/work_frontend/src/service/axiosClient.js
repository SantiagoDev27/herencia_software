import axios from "axios";

// La URL del backend viene de VITE_API_URL (ver .env). Si no existe, se usa el puerto por defecto del backend.
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "");

const axiosClient = axios.create({
    baseURL: API_URL,
    headers: { "Content-Type": "application/json" },
});

// Inyecta el token JWT en cada petición si existe
axiosClient.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// El backend responde errores de tres formas:
//  - { success:false, message, detalles:{ campo: "mensaje" } }  (validaciones)
//  - { success:false, message }                                  (reglas de negocio)
//  - sin respuesta                                               (backend apagado / CORS)
const construirMensaje = (error) => {
    if (!error.response) {
        return "No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.";
    }
    const data = error.response.data;
    if (data?.detalles && typeof data.detalles === "object") {
        const lista = Object.values(data.detalles).filter(Boolean);
        if (lista.length) return lista.join(" ");
    }
    return data?.message || "Ocurrió un error inesperado. Intenta de nuevo.";
};

axiosClient.interceptors.response.use(
    (response) => response.data,
    (error) => {
        const status = error.response?.status;
        const esLogin = error.config?.url?.includes("/auth/login");

        // Token vencido o inválido: se cierra la sesión y se vuelve al inicio.
        // (Un 401 en el login significa credenciales incorrectas, no sesión vencida.)
        if (status === 401 && !esLogin && localStorage.getItem("token")) {
            localStorage.removeItem("token");
            localStorage.removeItem("usuario");
            window.location.assign("/");
        }

        return Promise.reject({
            mensaje: construirMensaje(error),
            status,
            detalles: error.response?.data?.detalles,
            original: error,
        });
    }
);

export default axiosClient;
