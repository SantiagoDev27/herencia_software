import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import authService from "../service/authService";
import { rolDe, puede as puedeRol } from "../config/roles";

const AuthContext = createContext(null);

// HU-SEG-012: la sesión se cierra sola tras este tiempo sin actividad
const MINUTOS_INACTIVIDAD = Number(import.meta.env.VITE_MINUTOS_INACTIVIDAD) || 15;
const EVENTOS_ACTIVIDAD = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

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
    const [motivoCierre, setMotivoCierre] = useState(null);
    const ultimaActividad = useRef(Date.now());

    useEffect(() => {
        // Al cargar la app, revisa si ya hay una sesión guardada
        setUsuario(leerUsuarioGuardado());
        setCargando(false);
    }, []);

    const guardarSesion = (respuesta) => {
        localStorage.setItem("token", respuesta.token);
        localStorage.setItem("usuario", JSON.stringify(respuesta.data));
        ultimaActividad.current = Date.now();
        setMotivoCierre(null);
        setUsuario(respuesta.data);
        return respuesta;
    };

    const login = async (correo_usuario, contraseña_usuario) =>
        guardarSesion(await authService.login({ correo_usuario, contraseña_usuario }));

    // HU-SEG-002: cerrar sesión (se avisa al backend para la auditoría, sin bloquear la salida)
    const logout = useCallback((motivo = null) => {
        if (localStorage.getItem("token")) authService.logout().catch(() => {});
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        setMotivoCierre(motivo);
        setUsuario(null);
    }, []);

    // Mantener los datos del usuario en memoria y en localStorage al día (ej. tras editar perfil)
    const actualizarUsuario = (datos) => {
        const nuevo = { ...usuario, ...datos };
        localStorage.setItem("usuario", JSON.stringify(nuevo));
        setUsuario(nuevo);
    };

    // HU-SEG-007: los permisos del rol pueden cambiar mientras la sesión está abierta;
    // se consultan al abrir la app y cada minuto
    useEffect(() => {
        if (!usuario?.idusuario) return undefined;
        const refrescar = async () => {
            try {
                const res = await authService.perfil();
                const nuevo = res?.data;
                if (!nuevo) return;
                setUsuario((actual) => {
                    if (!actual) return actual;
                    const combinado = { ...actual, ...nuevo };
                    if (JSON.stringify(combinado) === JSON.stringify(actual)) return actual;
                    localStorage.setItem("usuario", JSON.stringify(combinado));
                    return combinado;
                });
            } catch {
                /* sin conexión: se conservan los permisos conocidos */
            }
        };
        refrescar();
        const timer = setInterval(refrescar, 60000);
        return () => clearInterval(timer);
    }, [usuario?.idusuario]);

    // HU-SEG-012: cierre automático por inactividad
    useEffect(() => {
        if (!usuario) return undefined;
        const marcar = () => {
            ultimaActividad.current = Date.now();
        };
        EVENTOS_ACTIVIDAD.forEach((ev) => window.addEventListener(ev, marcar, { passive: true }));
        const timer = setInterval(() => {
            if (Date.now() - ultimaActividad.current > MINUTOS_INACTIVIDAD * 60000) {
                logout(`Tu sesión se cerró después de ${MINUTOS_INACTIVIDAD} minutos de inactividad.`);
            }
        }, 30000);
        return () => {
            EVENTOS_ACTIVIDAD.forEach((ev) => window.removeEventListener(ev, marcar));
            clearInterval(timer);
        };
    }, [usuario, logout]);

    return (
        <AuthContext.Provider
            value={{
                usuario,
                login,
                logout,
                actualizarUsuario,
                cargando,
                motivoCierre,
                limpiarMotivoCierre: () => setMotivoCierre(null),
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
