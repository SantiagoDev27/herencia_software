import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Notice } from "./ui/Notice";
import "./AuthModal.css";

// Tarjeta de acceso: solo inicio de sesión contra /api/auth/login.
// El registro público se eliminó: las cuentas (Vendedor o Finanzas) las crea el Administrador
// desde el módulo "Usuarios".
export default function AuthModal() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [verClave, setVerClave] = useState(false);
  const [loginForm, setLoginForm] = useState({ correo: "", contraseña: "" });

  const { login, motivoCierre, limpiarMotivoCierre } = useAuth();
  const navigate = useNavigate();

  const enviarLogin = async (e) => {
    e.preventDefault();
    setError(null);
    limpiarMotivoCierre?.();
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

  return (
    <div className="auth-card card w-full max-w-md p-7 sm:p-8">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <ShieldCheck size={22} />
      </div>
      <h2 className="text-xl font-extrabold text-foreground">Bienvenido de nuevo</h2>
      <p className="mb-5 mt-1 text-sm text-muted-foreground">Ingresa tu correo y contraseña para continuar.</p>

      {motivoCierre && (
        <div className="mb-4">
          <Notice aviso={{ tipo: "warning", texto: motivoCierre }} onClose={limpiarMotivoCierre} />
        </div>
      )}

      {error && (
        <div className="mb-4">
          <Notice aviso={{ tipo: "error", texto: error }} />
        </div>
      )}

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
            <button
              type="button"
              onClick={() => setVerClave((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={cargando} className="btn btn-primary w-full py-2.5">
          {cargando && <Loader2 size={16} className="animate-spin" />}
          {cargando ? "Ingresando..." : "Entrar"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        ¿No tienes cuenta u olvidaste tu contraseña? Solicítala al administrador del sistema.
      </p>
    </div>
  );
}
