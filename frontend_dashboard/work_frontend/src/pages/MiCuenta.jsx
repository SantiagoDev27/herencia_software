import { useState } from "react";
import { KeyRound, UserRound } from "lucide-react";
import authService from "../service/authService";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Notice } from "../components/ui/Notice";
import { fmtFecha } from "../lib/format";
import { validarClave } from "../lib/validaciones";

// HU-SEG-004: el usuario autenticado cambia su propia contraseña
export default function MiCuenta() {
  const { usuario, rol } = useAuth();
  const [form, setForm] = useState({ actual: "", nueva: "", confirmar: "" });
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const enviar = async (e) => {
    e.preventDefault();
    setAviso(null);
    const error = validarClave(form.nueva);
    if (error) return setAviso({ tipo: "error", texto: error });
    if (form.nueva !== form.confirmar) return setAviso({ tipo: "error", texto: "La confirmación no coincide con la nueva contraseña." });

    setGuardando(true);
    try {
      await authService.cambiarContrasena({ contrasena_actual: form.actual, nueva_contrasena: form.nueva });
      setForm({ actual: "", nueva: "", confirmar: "" });
      setAviso({ tipo: "success", texto: "Contraseña actualizada. Úsala la próxima vez que inicies sesión." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader title="Mi cuenta" description="Tus datos de acceso y cambio de contraseña." />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2 text-sm font-extrabold"><UserRound size={17} /> Datos del usuario</div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Nombre</dt><dd className="font-semibold">{usuario?.nombre_usuario} {usuario?.apellido_usuario}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Correo</dt><dd>{usuario?.correo_usuario}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Rol</dt><dd>{rol ?? "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Teléfono</dt><dd>{usuario?.telefono_usuario || "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Sesión iniciada</dt><dd>{usuario?.ultimo_acceso ? fmtFecha(usuario.ultimo_acceso, true) : "—"}</dd></div>
          </dl>
          <p className="hint mt-4">Para cambiar tu nombre, correo o rol, solicítalo al administrador.</p>
        </div>

        <form onSubmit={enviar} className="card space-y-3.5 p-6">
          <div className="flex items-center gap-2 text-sm font-extrabold"><KeyRound size={17} /> Cambiar contraseña</div>
          <Notice aviso={aviso} onClose={() => setAviso(null)} />
          <div>
            <label className="label" htmlFor="c-actual">Contraseña actual</label>
            <input id="c-actual" type="password" required autoComplete="current-password" className="input" value={form.actual} onChange={set("actual")} />
          </div>
          <div>
            <label className="label" htmlFor="c-nueva">Nueva contraseña</label>
            <input id="c-nueva" type="password" required autoComplete="new-password" placeholder="Mínimo 8 caracteres, con letras y números" className="input" value={form.nueva} onChange={set("nueva")} />
          </div>
          <div>
            <label className="label" htmlFor="c-conf">Confirmar nueva contraseña</label>
            <input id="c-conf" type="password" required autoComplete="new-password" className="input" value={form.confirmar} onChange={set("confirmar")} />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={guardando} className="btn btn-primary btn-sm">{guardando ? "Guardando..." : "Actualizar contraseña"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
