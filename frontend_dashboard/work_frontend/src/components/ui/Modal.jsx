import { useEffect } from "react";
import { X } from "lucide-react";

// Ventana modal reutilizable. Se cierra con la X o con Escape
// (no al hacer clic fuera, para no perder lo que se está escribiendo en un formulario).
export function Modal({ open, onClose, title, subtitle, children, maxWidth = "max-w-lg" }) {
  useEffect(() => {
    if (!open) return undefined;
    const alPresionar = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1D3B2B]/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`card flex max-h-[92vh] w-full ${maxWidth} flex-col p-6 shadow-xl animate-in zoom-in-95 fade-in`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-foreground">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-icon -mr-1 -mt-1" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}

// Confirmación propia (reemplaza window.confirm para mantener el estilo de la app)
export function ConfirmDialog({ open, titulo, mensaje, textoConfirmar = "Eliminar", cargando, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title={titulo} maxWidth="max-w-sm">
      <p className="text-sm text-muted-foreground">{mensaje}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-outline btn-sm">
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} disabled={cargando} className="btn btn-danger btn-sm">
          {cargando ? "Procesando..." : textoConfirmar}
        </button>
      </div>
    </Modal>
  );
}
