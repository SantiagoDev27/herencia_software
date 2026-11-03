import { useState, useEffect, useCallback } from "react";
import { Download, RefreshCw, Package, AlertTriangle, CheckCircle, XCircle, Clock } from "lucide-react";
import reporteService from "../service/reporteService";
import { PageHeader } from "../components/ui/PageHeader";
import { Notice } from "../components/ui/Notice";
import { EstadoBadge } from "../components/ui/Badge";
import { fmtCOP, UMBRAL_STOCK_BAJO, DIAS_POR_VENCER } from "../lib/format";

export default function Reportes() {
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [aviso, setAviso] = useState(null);

  // Parámetros que acepta el backend: umbral de stock bajo y ventana de "próximo a vencer"
  const [umbral, setUmbral] = useState(UMBRAL_STOCK_BAJO);
  const [dias, setDias] = useState(DIAS_POR_VENCER);
  const [aplicados, setAplicados] = useState({ umbral: UMBRAL_STOCK_BAJO, dias: DIAS_POR_VENCER });

  const cargarReporte = useCallback(async () => {
    setCargando(true);
    try {
      const res = await reporteService.obtenerReporteInventario(aplicados);
      setReporte(res?.data ?? null);
    } catch (err) {
      setReporte(null);
      setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      setCargando(false);
    }
  }, [aplicados]);

  useEffect(() => {
    cargarReporte();
  }, [cargarReporte]);

  const aplicarParametros = (e) => {
    e.preventDefault();
    setAplicados({ umbral: Math.max(1, Number(umbral) || 1), dias: Math.max(1, Number(dias) || 1) });
  };

  const descargarPDF = async () => {
    setDescargandoPdf(true);
    try {
      await reporteService.descargarReporteInventarioPDF(aplicados);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje || "Error al generar el PDF del reporte de inventario." });
    } finally {
      setDescargandoPdf(false);
    }
  };

  const resumen = reporte?.resumen ?? {};
  const inventario = reporte?.inventario ?? [];

  const kpisExistencias = [
    { label: "Total productos", valor: resumen.totalProductos, Icono: Package, color: "bg-accent text-accent-foreground" },
    { label: "Con stock", valor: resumen.productosConStock, Icono: CheckCircle, color: "bg-primary-soft text-primary" },
    { label: "Stock bajo", valor: resumen.productosConStockBajo, Icono: AlertTriangle, color: "bg-secondary text-secondary-foreground" },
    { label: "Próximos a vencer", valor: resumen.productosProximosAVencer, Icono: Clock, color: "bg-secondary text-secondary-foreground" },
    { label: "Agotados", valor: resumen.productosSinStock, Icono: XCircle, color: "bg-destructive-soft text-destructive" },
  ];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Reportes de inventario"
        description="Valoración del inventario, rentabilidad estimada e informe imprimible."
      >
        <button onClick={cargarReporte} className="btn btn-outline btn-sm" title="Recargar" aria-label="Recargar">
          <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
        </button>
        <button onClick={descargarPDF} disabled={descargandoPdf} className="btn btn-primary">
          <Download size={16} className={descargandoPdf ? "animate-bounce" : ""} />
          {descargandoPdf ? "Generando reporte..." : "Exportar PDF"}
        </button>
      </PageHeader>

      <Notice aviso={aviso} onClose={() => setAviso(null)} />

      {/* Parámetros */}
      <form onSubmit={aplicarParametros} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="r-umbral">Stock bajo hasta (unidades)</label>
          <input id="r-umbral" type="number" min="1" step="1" value={umbral} onChange={(e) => setUmbral(e.target.value)} className="input w-40" />
        </div>
        <div>
          <label className="label" htmlFor="r-dias">Próximo a vencer en (días)</label>
          <input id="r-dias" type="number" min="1" step="1" value={dias} onChange={(e) => setDias(e.target.value)} className="input w-40" />
        </div>
        <button type="submit" className="btn btn-soft btn-sm py-2.5">Aplicar</button>
        <p className="hint ml-auto max-w-xs">El reporte en pantalla y el PDF usan estos mismos parámetros.</p>
      </form>

      {/* Indicadores financieros */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-bold text-muted-foreground">Costo total del inventario</p>
          <h3 className="mt-1 text-2xl font-extrabold text-foreground">{fmtCOP(resumen.costoTotalInventario)}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">Capital invertido en existencias</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold text-muted-foreground">Valor potencial de venta</p>
          <h3 className="mt-1 text-2xl font-extrabold text-accent-foreground">{fmtCOP(resumen.valorPotencialVentas)}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">Ingresos esperados al vender todo</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold text-muted-foreground">Ganancia potencial</p>
          <h3 className="mt-1 text-2xl font-extrabold text-primary">{fmtCOP(resumen.gananciaPotencial)}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">Margen de utilidad proyectado</p>
        </div>
      </div>

      {/* Existencias */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {kpisExistencias.map(({ label, valor, Icono, color }) => (
          <div key={label} className="card flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${color}`}>
              <Icono size={19} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-extrabold text-foreground">{valor ?? 0}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Detalle */}
      <div className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-extrabold text-foreground">Detalle del inventario</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Listado valorizado de existencias</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Producto</th>
                <th className="px-5 py-3 text-center">Stock</th>
                <th className="px-5 py-3 text-right">Costo unit.</th>
                <th className="px-5 py-3 text-right">Precio venta</th>
                <th className="px-5 py-3 text-right">Valor a costo</th>
                <th className="px-5 py-3 text-right">Ganancia pot.</th>
                <th className="px-5 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cargando ? (
                <tr><td colSpan={8} className="py-10 text-center text-xs text-muted-foreground">Cargando reporte...</td></tr>
              ) : inventario.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-xs text-muted-foreground">No hay registros disponibles en el inventario.</td></tr>
              ) : (
                inventario.map((p) => (
                  <tr key={p.id_producto} className="transition-colors hover:bg-muted/50">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-primary">{p.codigo_producto}</td>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-foreground">{p.nombre_producto}</p>
                      {p.categoria?.nombre_categoria && <p className="text-[11px] text-muted-foreground">{p.categoria.nombre_categoria}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs font-extrabold">{p.stock}</td>
                    <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">{fmtCOP(p.costo_produccion)}</td>
                    <td className="px-5 py-3.5 text-right text-xs font-bold text-foreground">{fmtCOP(p.precio_venta)}</td>
                    <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">{fmtCOP(p.costoTotalInventario)}</td>
                    <td className="px-5 py-3.5 text-right text-xs font-bold text-primary">{fmtCOP(p.gananciaPotencial)}</td>
                    <td className="px-5 py-3.5 text-center"><EstadoBadge estado={p.estado} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
