import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Notice } from "./ui/Notice";
import "./AuthModal.css";

// Roles sembrados por el backend (src/scrips/seedUsuario.js). No hay endpoint para listarlos.
const ROLES = [
  { id: 2, nombre: "Vendedor" },
  { id: 1, nombre: "Administrador" },
  { id: 3, nombre: "Cliente" },
];

const FORM_REGISTRO = {
  nombre: "",
  apellido: "",
  correo: "",
  contraseña: "",
  telefono: "",
  rol: "2",
};

// Tarjeta de acceso: inicio de sesión y registro contra /api/auth/login y /api/auth/register
export default function AuthModal() {
  const [modo, setModo] = useState("login"); // "login" | "registro"
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [verClave, setVerClave] = useState(false);

  const [loginForm, setLoginForm] = useState({ correo: "", contraseña: "" });
  const [registro, setRegistro] = useState(FORM_REGISTRO);

  const { login, registrar } = useAuth();
  const navigate = useNavigate();

  const cambiarModo = (nuevo) => {
    setModo(nuevo);
    setError(null);
  };

  const enviarLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login(loginForm.correo.trim(), loginForm.contraseña);
      navigate("/dashboard");
    } catch (err) {
      setError(err.mensaje || "Credenciales incorrectas.");
    } finally {
      setCargando(false);
    }
  };

  const enviarRegistro = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const datos = {
        nombre_usuario: registro.nombre.trim(),
        apellido_usuario: registro.apellido.trim(),
        correo_usuario: registro.correo.trim(),
        contraseña_usuario: registro.contraseña,
        fk_usuario_id_rol: Number(registro.rol),
      };
      if (registro.telefono.trim()) datos.telefono_usuario = registro.telefono.trim();
      await registrar(datos);
      navigate("/dashboard");
    } catch (err) {
      setError(err.mensaje || "No se pudo crear la cuenta.");
    } finally {
      setCargando(false);
    }
  };

  const botonClave = (
    <button
      type="button"
      onClick={() => setVerClave((v) => !v)}
      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
    >
      {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  const esLogin = modo === "login";

  return (
    <div className="auth-card card w-full max-w-md p-7 sm:p-8">
      <div role="tablist" className="auth-tabs mb-6">
        <button
          type="button"
          role="tab"
          aria-selected={esLogin}
          onClick={() => cambiarModo("login")}
          className={esLogin ? "is-active" : ""}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!esLogin}
          onClick={() => cambiarModo("registro")}
          className={!esLogin ? "is-active" : ""}
        >
          Registrarse
        </button>
      </div>

      <h2 className="text-xl font-extrabold text-foreground">{esLogin ? "Bienvenido de nuevo" : "Crea tu cuenta"}</h2>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">
        {esLogin
          ? "Ingresa tu correo y contraseña para continuar."
          : "Completa tus datos para empezar a usar el sistema."}
      </p>

      {error && (
        <div className="mb-4">
          <Notice aviso={{ tipo: "error", texto: error }} />
        </div>
      )}

      {esLogin ? (
        <form onSubmit={enviarLogin} className="space-y-4">
          <div>
            <label htmlFor="login-correo" className="label">Correo electrónico</label>
            <input
              id="login-correo"
              type="email"
              required
              autoComplete="email"
              placeholder="correo@ejemplo.com"
              className="input"
              value={loginForm.correo}
              onChange={(e) => setLoginForm({ ...loginForm, correo: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="login-clave" className="label">Contraseña</label>
            <div className="relative">
              <input
                id="login-clave"
                type={verClave ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="Tu contraseña"
                className="input pr-10"
                value={loginForm.contraseña}
                onChange={(e) => setLoginForm({ ...loginForm, contraseña: e.target.value })}
              />
              {botonClave}
            </div>
          </div>
          <button type="submit" disabled={cargando} className="btn btn-primary w-full py-2.5">
            {cargando && <Loader2 size={16} className="animate-spin" />}
            {cargando ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      ) : (
        <form onSubmit={enviarRegistro} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-nombre" className="label">Nombre</label>
              <input
                id="reg-nombre"
                required
                maxLength={100}
                className="input"
                value={registro.nombre}
                onChange={(e) => setRegistro({ ...registro, nombre: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="reg-apellido" className="label">Apellido</label>
              <input
                id="reg-apellido"
                required
                maxLength={100}
                className="input"
                value={registro.apellido}
                onChange={(e) => setRegistro({ ...registro, apellido: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label htmlFor="reg-correo" className="label">Correo electrónico</label>
            <input
              id="reg-correo"
              type="email"
              required
              maxLength={150}
              autoComplete="email"
              className="input"
              value={registro.correo}
              onChange={(e) => setRegistro({ ...registro, correo: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="reg-clave" className="label">Contraseña</label>
            <div className="relative">
              <input
                id="reg-clave"
                type={verClave ? "text" : "password"}
                required
                minLength={6}
                maxLength={255}
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                className="input pr-10"
                value={registro.contraseña}
                onChange={(e) => setRegistro({ ...registro, contraseña: e.target.value })}
              />
              {botonClave}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-tel" className="label">Teléfono (opcional)</label>
              <input
                id="reg-tel"
                type="tel"
                maxLength={20}
                className="input"
                value={registro.telefono}
                onChange={(e) => setRegistro({ ...registro, telefono: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="reg-rol" className="label">Rol</label>
              <select
                id="reg-rol"
                className="input"
                value={registro.rol}
                onChange={(e) => setRegistro({ ...registro, rol: e.target.value })}
              >
                {ROLES.map((rol) => (
                  <option key={rol.id} value={rol.id}>{rol.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={cargando} className="btn btn-primary w-full py-2.5">
            {cargando && <Loader2 size={16} className="animate-spin" />}
            {cargando ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>
      )}
    </div>
  );
}
