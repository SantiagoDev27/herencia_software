import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, Bell, AlertTriangle, AlertCircle, Clock, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import notificacionService from "../../service/notificacionService";
import { fmtFecha } from "../../lib/format";

const VACIO = { stockMinimo: [], proximosVencer: [], agotados: [] };

export function Topbar({ title, subtitle, onMenuClick }) {
  const [busqueda, setBusqueda] = useState("");
  const [mostrarAlertas, setMostrarAlertas] = useState(false);
  const [notificaciones, setNotificaciones] = useState(VACIO);
  const [cargandoNotif, setCargandoNotif] = useState(false);
  const alertasRef = useRef(null);
  const { usuario } = useAuth();
  const navigate = useNavigate();

  const iniciales = usuario
    ? `${usuario.nombre_usuario?.[0] ?? ""}${usuario.apellido_usuario?.[0] ?? ""}`.toUpperCase()
    : "??";

  const totalAlertas =
    notificaciones.stockMinimo.length + notificaciones.proximosVencer.length + notificaciones.agotados.length;

  const cargarNotificaciones = useCallback(async () => {
    setCargandoNotif(true);
    try {
      setNotificaciones(await notificacionService.obtenerTodas());
    } finally {
      setCargandoNotif(false);
    }
  }, []);

  useEffect(() => {
    cargarNotificaciones();
    const timer = setInterval(cargarNotificaciones, 60000); // refresco cada 60 s
    return () => clearInterval(timer);
  }, [cargarNotificaciones]);

  // Cerrar el panel al hacer clic afuera
  useEffect(() => {
    const alHacerClic = (e) => {
      if (alertasRef.current && !alertasRef.current.contains(e.target)) setMostrarAlertas(false);
    };
    document.addEventListener("mousedown", alHacerClic);
    return () => document.removeEventListener("mousedown", alHacerClic);
  }, []);

  // El buscador global lleva al catálogo con el texto ya aplicado
  const buscar = (e) => {
    e.preventDefault();
    const q = busqueda.trim();
    navigate(q ? `/dashboard/productos?q=${encodeURIComponent(q)}` : "/dashboard/productos");
    setBusqueda("");
  };

  return (
    <header className="relative z-20 flex items-center gap-3 border-b border-border bg-card px-4 py-3.5 sm:px-6">
      <button onClick={onMenuClick} className="btn-icon md:hidden" aria-label="Abrir menú">
        <Menu size={19} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-extrabold leading-none text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <form onSubmit={buscar} className="hidden w-60 items-center gap-2 rounded-xl bg-muted px-3 py-2 md:flex">
        <Search size={14} className="flex-shrink-0 text-muted-foreground" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          aria-label="Buscar producto"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </form>

      {/* Alertas de inventario */}
      <div className="relative" ref={alertasRef}>
        <button
          onClick={() => setMostrarAlertas((v) => !v)}
          className="btn-icon relative p-2"
          title="Alertas de inventario"
          aria-label="Alertas de inventario"
        >
          <Bell size={18} />
          {totalAlertas > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {totalAlertas}
            </span>
          )}
        </button>

        {mostrarAlertas && (
          <div className="card absolute right-0 mt-2 w-80 overflow-hidden shadow-xl animate-in fade-in-50 sm:w-96">
            <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-primary" />
                <h3 className="text-sm font-bold">Alertas de inventario</h3>
              </div>
              <button onClick={() => setMostrarAlertas(false)} className="btn-icon" aria-label="Cerrar">
                <X size={14} />
              </button>
            </div>

            <div className="max-h-80 space-y-1 overflow-y-auto p-2">
              {cargandoNotif && totalAlertas === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Cargando alertas...</p>
              ) : totalAlertas === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">Todo en orden. No hay alertas pendientes.</p>
              ) : (
                <>
                  {notificaciones.agotados.map((item) => (
                    <div key={`ag-${item.id_producto}`} className="flex items-start gap-2.5 rounded-xl bg-destructive-soft p-2.5">
                      <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-destructive" />
                      <div className="min-w-0 text-xs">
                        <p className="truncate font-bold text-destructive">{item.nombre_producto}</p>
                        <p className="text-[11px] text-muted-foreground">Agotado · 0 unidades</p>
                      </div>
                    </div>
                  ))}
                  {notificaciones.stockMinimo.map((item) => (
                    <div key={`sm-${item.id_producto}`} className="flex items-start gap-2.5 rounded-xl bg-warning-soft p-2.5">
                      <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-warning-foreground" />
                      <div className="min-w-0 text-xs">
                        <p className="truncate font-bold text-warning-foreground">{item.nombre_producto}</p>
                        <p className="text-[11px] text-muted-foreground">Stock bajo · quedan {item.stock} unidades</p>
                      </div>
                    </div>
                  ))}
                  {notificaciones.proximosVencer.map((item) => (
                    <div key={`pv-${item.id_producto}`} className="flex items-start gap-2.5 rounded-xl bg-accent p-2.5">
                      <Clock size={15} className="mt-0.5 flex-shrink-0 text-accent-foreground" />
                      <div className="min-w-0 text-xs">
                        <p className="truncate font-bold text-accent-foreground">{item.nombre_producto}</p>
                        <p className="text-[11px] text-muted-foreground">Vence: {fmtFecha(item.fecha_vencimiento)}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-l border-border pl-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {iniciales}
        </div>
        <div className="hidden md:block">
          <p className="text-xs font-bold leading-none">{usuario?.nombre_usuario ?? "Usuario"}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{usuario?.rol?.nombre_rol ?? "—"}</p>
        </div>
      </div>
    </header>
  );
}
