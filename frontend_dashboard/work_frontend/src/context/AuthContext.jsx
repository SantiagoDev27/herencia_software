import { createContext, useContext, useState, useEffect } from "react";
import authService from "../service/authService";
import { rolDe, puede as puedeRol } from "../config/roles";

const AuthContext = createContext(null);

const leerUsuarioGuardado = () => {
    try {
        const usuario = localStorage.getItem("usuario");
        return usuario && localStorage.getItem("token") ? JSON.parse(usuario) : null;
    } catch {
        return null;
    }
};

export function AuthProvider({ children }) {
    const [usuario, setUsuario] = useState(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        // Al cargar la app, revisa si ya hay una sesión guardada
        setUsuario(leerUsuarioGuardado());
        setCargando(false);
    }, []);

    const guardarSesion = (respuesta) => {
        localStorage.setItem("token", respuesta.token);
        localStorage.setItem("usuario", JSON.stringify(respuesta.data));
        setUsuario(respuesta.data);
        return respuesta;
    };

    const login = async (correo_usuario, contraseña_usuario) =>
        guardarSesion(await authService.login({ correo_usuario, contraseña_usuario }));

    // Crear la cuenta NO inicia sesión: el usuario debe entrar luego con su correo y contraseña
    const registrar = async (datosUsuario) => authService.registrar(datosUsuario);

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        setUsuario(null);
    };

    return (
        <AuthContext.Provider
            value={{
                usuario,
                login,
                registrar,
                logout,
                cargando,
                rol: rolDe(usuario),
                puede: (permiso) => puedeRol(usuario, permiso),
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    return useContext(AuthContext);
}
