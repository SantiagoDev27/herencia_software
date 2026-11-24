import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import proveedorService from "../service/proveedorService";
import { Modal } from "./ui/Modal";
import { Notice } from "./ui/Notice";
import { fmtFecha, toList } from "../lib/format";

// HU-PROV-007: evaluar a un proveedor y ver su historial de desempeño
const CRITERIOS = [
  ["cumplimiento", "Cumplimiento de entregas"],
  ["calidad", "Calidad de los productos"],
  ["tiempo_respuesta", "Tiempo de respuesta"],
];

export const Estrellas = ({ valor, tam = 13 }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${valor} de 5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={tam} className={n <= Math.round(valor) ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground/40"} />
    ))}
  </span>
);

export function EvaluacionProveedorModal({ proveedor, puedeEvaluar, onClose, onCambio }) {
  const [historial, setHistorial] = useState([]);
  const [form, setForm] = useState({ cumplimiento: 5, calidad: 5, tiempo_respuesta: 5, observaciones: "" });
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!proveedor) return;
    setAviso(null);
    setForm({ cumplimiento: 5, calidad: 5, tiempo_respuesta: 5, observaciones: "" });
    proveedorService.evaluaciones(proveedor.id_proveedor).then((r) => setHistorial(toList(r))).catch(() => setHistorial([]));
  }, [proveedor]);

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = await proveedorService.evaluar(proveedor.id_proveedor, form);
      setAviso({ tipo: "success", texto: `Evaluación registrada: ${Number(r.data.calificacion).toFixed(2)} / 5.` });
      setHistorial(toList(await proveedorService.evaluaciones(proveedor.id_proveedor)));
      onCambio?.();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal open={!!proveedor} onClose={onClose} title={`Desempeño de ${proveedor?.razon_social ?? ""}`} subtitle="Calificación de 1 a 5 en cada criterio; el promedio queda en el historial." maxWidth="max-w-xl">
      <div className="space-y-4">
        <Notice aviso={aviso} onClose={() => setAviso(null)} />
        {puedeEvaluar && (
          <form onSubmit={guardar} className="space-y-2 rounded-xl border border-border p-3">
            {CRITERIOS.map(([k, label]) => (
              <div key={k} className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold">{label}</span>
                <span className="flex gap-1" role="radiogroup" aria-label={label}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} role="radio" aria-checked={form[k] === n} aria-label={`${label}: ${n}`} onClick={() => setForm({ ...form, [k]: n })}>
                      <Star size={20} className={n <= form[k] ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground/40"} />
                    </button>
                  ))}
                </span>
              </div>
            ))}
            <input aria-label="Observaciones" maxLength={255} placeholder="Observaciones (opcional)" className="input text-xs" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            <div className="flex justify-end"><button type="submit" disabled={guardando} className="btn btn-primary btn-sm">{guardando ? "Guardando..." : "Registrar evaluación"}</button></div>
          </form>
        )}
        <div>
          <p className="mb-1 text-xs font-bold">Historial ({historial.length})</p>
          {historial.length === 0 ? <p className="text-xs text-muted-foreground">Sin evaluaciones todavía.</p> : (
            <ul className="divide-y divide-border text-xs">
              {historial.map((h) => (
                <li key={h.id_evaluacion} className="flex items-center justify-between gap-2 py-2">
                  <span>{fmtFecha(h.fecha)} · C{h.cumplimiento} Q{h.calidad} T{h.tiempo_respuesta}{h.observaciones && <span className="block text-muted-foreground">{h.observaciones}</span>}</span>
                  <span className="flex items-center gap-2"><Estrellas valor={Number(h.calificacion)} /> <b>{Number(h.calificacion).toFixed(2)}</b></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
