import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

const ESTILOS = {
  error: { clase: "border-destructive-border bg-destructive-soft text-destructive", Icono: AlertCircle },
  success: { clase: "border-primary/25 bg-primary-soft text-primary-soft-foreground", Icono: CheckCircle2 },
  info: { clase: "border-info-border bg-accent text-accent-foreground", Icono: Info },
  warning: { clase: "border-warning-border bg-warning-soft text-warning-foreground", Icono: AlertCircle },
};

// Aviso en línea (reemplaza alert()). `aviso` = { tipo, texto } o null.
export function Notice({ aviso, onClose }) {
  if (!aviso?.texto) return null;
  const { clase, Icono } = ESTILOS[aviso.tipo] ?? ESTILOS.info;
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${clase}`} role="status">
      <Icono size={15} className="mt-0.5 flex-shrink-0" />
      <p className="flex-1 leading-relaxed">{aviso.texto}</p>
      {onClose && (
        <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Cerrar aviso">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
