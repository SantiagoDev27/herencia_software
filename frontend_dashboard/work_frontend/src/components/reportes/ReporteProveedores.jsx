import { useState, useEffect, useCallback } from "react";
import { Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import reporteService from "../../service/reporteService";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { PageHeader } from "../ui/PageHeader";
import { Notice } from "../ui/Notice";
import { Estrellas } from "../EvaluacionProveedorModal";
import { fmtCOP, hoyISO, haceDiasISO, exportarCSV, fmtFecha } from "../../lib/format";

// HU-PROV-008: compras, cumplimiento y desempeño por proveedor
export default function ReporteProveedores() {
  const [rango, setRango] = useState({ fechaInicio: haceDiasISO(30), fechaFin: hoyISO() });
  const [form, setForm] = useState(rango);
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      setReporte((await reporteService.obtenerReporteProveedores(rango)).data);
    } catch (err) {
      if (!silencioso) setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [rango]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useAutoRefresh(cargar);

  const pct = (v) => (v === null || v === undefined ? "—" : `${v}%`);
  const excel = () =>
    exportarCSV([
      ["REPORTE DE PROVEEDORES", `${rango.fechaInicio} a ${rango.fechaFin}`],
      ["Proveedor", "NIT", "Ciudad", "Productos", "Órdenes", "Recibidas", "Pendientes", "Canceladas", "Total comprado", "Cumplimiento %", "A tiempo %", "Calificación", "Evaluaciones"],
      ...reporte.proveedores.map((p) => [p.razon_social, p.nit, p.ciudad, p.productos, p.ordenes, p.recibidas, p.pendientes, p.canceladas, p.total_comprado, p.cumplimiento, p.entregas_a_tiempo, p.calificacion, p.evaluaciones]),
    ], `Reporte-Proveedores-${rango.fechaInicio}-a-${rango.fechaFin}.csv`);

  return (
    <div className="space-y-5">
      <PageHeader title="Reporte de proveedores" description="Órdenes de compra, valor comprado, cumplimiento de entregas y calificación.">
        <button onClick={() => cargar()} className="btn btn-outline btn-sm" aria-label="Recargar"><RefreshCw size={15} className={cargando ? "animate-spin" : ""} /></button>
        <button onClick={excel} disabled={!reporte} className="btn btn-outline"><FileSpreadsheet size={16} /> Excel</button>
        <button onClick={() => reporteService.descargarReporteProveedoresPDF(rango).catch((e) => setAviso({ tipo: "error", texto: e.mensaje }))} className="btn btn-primary"><Download size={16} /> Exportar PDF</button>
      </PageHeader>
      <Notice aviso={aviso} onClose={() => setAviso(null)} />
      <form onSubmit={(e) => { e.preventDefault(); setRango(form); }} className="card flex flex-wrap items-end gap-3 p-3">
        <div><label className="label" htmlFor="rp-ini">Desde</label><input id="rp-ini" type="date" className="input py-1.5" value={form.fechaInicio} max={form.fechaFin} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} /></div>
        <div><label className="label" htmlFor="rp-fin">Hasta</label><input id="rp-fin" type="date" className="input py-1.5" value={form.fechaFin} min={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} /></div>
        <button type="submit" className="btn btn-soft btn-sm py-2.5">Aplicar</button>
        <span className="hint ml-auto">{fmtFecha(rango.fechaInicio)} – {fmtFecha(rango.fechaFin)}</span>
      </form>
      {reporte && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[["Proveedores activos", reporte.resumen.proveedores], ["Órdenes de compra", reporte.resumen.ordenes], ["Pendientes", reporte.resumen.pendientes], ["Total comprado", fmtCOP(reporte.resumen.total_comprado)]].map(([l, v]) => (
              <div key={l} className="card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-extrabold">{v}</p></div>
            ))}
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-head"><tr><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3 text-center">Órdenes</th><th className="px-4 py-3 text-center">Recibidas</th><th className="px-4 py-3 text-right">Total comprado</th><th className="px-4 py-3 text-center">Cumplimiento</th><th className="px-4 py-3 text-center">A tiempo</th><th className="px-4 py-3">Calificación</th></tr></thead>
              <tbody className="divide-y divide-border">
                {reporte.proveedores.map((p) => (
                  <tr key={p.id_proveedor}>
                    <td className="px-4 py-2.5 text-xs font-semibold">{p.razon_social}{!p.activo && <span className="ml-1 text-[10px] text-muted-foreground">(inactivo)</span>}<span className="block text-[10px] font-normal text-muted-foreground">{p.productos} producto(s) asociados</span></td>
                    <td className="px-4 py-2.5 text-center text-xs">{p.ordenes}</td>
                    <td className="px-4 py-2.5 text-center text-xs">{p.recibidas}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold">{fmtCOP(p.total_comprado)}</td>
                    <td className="px-4 py-2.5 text-center text-xs">{pct(p.cumplimiento)}</td>
                    <td className="px-4 py-2.5 text-center text-xs">{pct(p.entregas_a_tiempo)}</td>
                    <td className="px-4 py-2.5 text-xs">{p.calificacion === null ? "—" : <span className="flex items-center gap-1"><Estrellas valor={p.calificacion} /> {p.calificacion}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
