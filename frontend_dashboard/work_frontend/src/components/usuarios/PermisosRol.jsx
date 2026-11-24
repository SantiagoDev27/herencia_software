import { useState, useEffect, useMemo } from "react";
import { Save } from "lucide-react";
import usuarioService from "../../service/usuarioService";
import { Notice } from "../ui/Notice";

// HU-SEG-007: el administrador decide qué módulos y acciones tiene cada rol
const ROLES = [
  { id: 2, nombre: "Vendedor" },
  { id: 3, nombre: "Finanzas" },
];

export default function PermisosRol() {
  const [catalogo, setCatalogo] = useState([]);
  const [matriz, setMatriz] = useState({}); // idrol -> Set
  const [original, setOriginal] = useState({});
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const { data } = await usuarioService.permisos();
      setCatalogo(data.catalogo);
      const m = Object.fromEntries(data.roles.map((r) => [r.idrol, new Set(r.permisos)]));
      setMatriz(m);
      setOriginal(Object.fromEntries(data.roles.map((r) => [r.idrol, new Set(r.permisos)])));
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje });
    }
  };
  useEffect(() => {
    cargar();
  }, []);

  const grupos = useMemo(() => {
    const g = new Map();
    catalogo.forEach((p) => g.set(p.grupo, [...(g.get(p.grupo) ?? []), p]));
    return [...g];
  }, [catalogo]);

  const alternar = (rol, clave) =>
    setMatriz((m) => {
      const s = new Set(m[rol]);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return { ...m, [rol]: s };
    });

  const cambios = ROLES.some((r) => {
    const a = matriz[r.id] ?? new Set();
    const b = original[r.id] ?? new Set();
    return a.size !== b.size || [...a].some((x) => !b.has(x));
  });

  const guardar = async () => {
    setGuardando(true);
    try {
      for (const r of ROLES) await usuarioService.guardarPermisos(r.id, [...(matriz[r.id] ?? [])]);
      setAviso({ tipo: "success", texto: "Permisos guardados. Se aplican de inmediato en el servidor y en las sesiones abiertas en menos de un minuto." });
      cargar();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-3">
      <Notice aviso={aviso} onClose={() => setAviso(null)} />
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h3 className="text-sm font-extrabold">Permisos por rol</h3>
            <p className="text-xs text-muted-foreground">El Administrador siempre tiene todos los permisos y es el único que gestiona usuarios.</p>
          </div>
          <button onClick={guardar} disabled={!cambios || guardando} className="btn btn-primary btn-sm"><Save size={14} /> {guardando ? "Guardando..." : "Guardar cambios"}</button>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="table-head">
            <tr><th className="px-5 py-2.5">Permiso</th>{ROLES.map((r) => <th key={r.id} className="w-28 px-5 py-2.5 text-center">{r.nombre}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {grupos.map(([grupo, permisos]) => [
              <tr key={grupo} className="bg-muted/50"><td colSpan={3} className="px-5 py-1.5 text-[11px] font-extrabold uppercase text-muted-foreground">{grupo}</td></tr>,
              ...permisos.map((p) => (
                <tr key={p.clave}>
                  <td className="px-5 py-2 text-xs">{p.nombre}</td>
                  {ROLES.map((r) => (
                    <td key={r.id} className="px-5 py-2 text-center">
                      <input type="checkbox" aria-label={`${p.nombre} para ${r.nombre}`} checked={matriz[r.id]?.has(p.clave) ?? false} onChange={() => alternar(r.id, p.clave)} />
                    </td>
                  ))}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}
