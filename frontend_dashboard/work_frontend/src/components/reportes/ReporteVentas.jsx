import { useState, useEffect, useCallback, useMemo } from "react";
import { Download, RefreshCw, FileSpreadsheet, Receipt, ShoppingBag, Wallet, Percent, TrendingUp, Tag } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import reporteService from "../../service/reporteService";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { PageHeader } from "../ui/PageHeader";
import { Notice } from "../ui/Notice";
import { fmtCOP, fmtCompacto, fmtFecha, hoyISO, haceDiasISO, exportarCSV } from "../../lib/format";

// HU-VEN-008 / HU-CON-008: reporte general de ventas para Finanzas.
// Por defecto muestra el último mes; se puede elegir otro rango de fechas.
const RANGOS = [
  { id: "mes", label: "Último mes", dias: 30 },
  { id: "semana", label: "Últimos 7 días", dias: 7 },
  { id: "trimestre", label: "Últimos 3 meses", dias: 90 },
  { id: "personalizado", label: "Personalizado", dias: null },
];

const VERDE = "#25794D";
const AZUL = "#7CC4EA";
const estiloTooltip = { borderRadius: 12, border: "1px solid #E1EBE2", fontSize: 12 };
const ejeTick = { fontSize: 11, fill: "#587063" };

export default function ReporteVentas() {
  const [rango, setRango] = useState("mes");
  const [fechas, setFechas] = useState({ fechaInicio: haceDiasISO(30), fechaFin: hoyISO() });
  const [aplicadas, setAplicadas] = useState({ fechaInicio: haceDiasISO(30), fechaFin: hoyISO() });
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const elegirRango = (id) => {
    setRango(id);
    const r = RANGOS.find((x) => x.id === id);
    if (r?.dias) {
      const nuevo = { fechaInicio: haceDiasISO(r.dias), fechaFin: hoyISO() };
      setFechas(nuevo);
      setAplicadas(nuevo);
    }
  };

  const aplicarPersonalizado = (e) => {
    e.preventDefault();
    if (fechas.fechaInicio > fechas.fechaFin) {
      setAviso({ tipo: "error", texto: "La fecha inicial no puede ser posterior a la final." });
      return;
    }
    setAplicadas({ ...fechas });
  };

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const res = await reporteService.obtenerReporteVentas(aplicadas);
      setReporte(res?.data ?? null);
    } catch (err) {
      if (!silencioso) {
        setReporte(null);
        setAviso({ tipo: "error", texto: err.mensaje });
      }
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [aplicadas]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  // Las ventas nuevas se reflejan solas en el reporte
  useAutoRefresh(cargar);

  const r = reporte?.resumen ?? {};
  const porDia = useMemo(
    () => (reporte?.porDia ?? []).map((d) => ({ ...d, dia: fmtFecha(d.fecha).replace(/ de \d{4}$/, "") })),
    [reporte]
  );

  const descargarPDF = async () => {
    setDescargando(true);
    try {
      await reporteService.descargarReporteVentasPDF(aplicadas);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje || "No se pudo generar el PDF." });
    } finally {
      setDescargando(false);
    }
  };

  // Requisito 2.2.3.8: exportación a Excel (CSV que Excel abre directamente)
  const descargarExcel = () => {
    if (!reporte) return;
    const { fechaInicio, fechaFin } = reporte.periodo;
    const filas = [
      ["REPORTE GENERAL DE VENTAS - HERENCIA DE PAPÁ"],
      [`Periodo: ${fechaInicio} a ${fechaFin}`],
      [],
      ["Indicador", "Valor"],
      ["Número de ventas", r.cantidadVentas],
      ["Unidades vendidas", r.unidadesVendidas],
      ["Subtotal", r.subtotal],
      ["IVA", r.iva],
      ["Descuentos", r.descuentos],
      ["Total vendido", r.totalVentas],
      ["Costo de ventas", r.costoVentas],
      ["Utilidad bruta", r.utilidadBruta],
      ["Margen bruto %", r.margenBruto],
      ["Ticket promedio", r.ticketPromedio],
      [],
      ["Ventas e IVA por día"],
      ["Fecha", "N° ventas", "Subtotal", "IVA", "Total"],
      ...reporte.porDia.map((d) => [d.fecha, d.cantidadVentas, d.subtotal, d.iva, d.total]),
      [],
      ["Productos vendidos"],
      ["Código", "Producto", "Unidades", "Ventas sin IVA", "Costo", "Utilidad", "Total con IVA"],
      ...reporte.porProducto.map((p) => [p.codigo_producto ?? "", p.nombre_producto, p.unidades, p.subtotal, p.costo, p.utilidad, p.total]),
      [],
      ["Ventas por vendedor"],
      ["Vendedor", "N° ventas", "Total"],
      ...reporte.porVendedor.map((v) => [v.vendedor, v.cantidadVentas, v.total]),
      [],
      ["Detalle de ventas"],
      ["N° venta", "Fecha", "Cliente", "Vendedor", "Unidades", "Subtotal", "IVA", "Descuento", "Total"],
      ...reporte.ventas.map((v) => [v.numero_venta, v.fecha, v.cliente, v.vendedor, v.unidades, v.subtotal, v.iva, v.descuento, v.total]),
    ];
    exportarCSV(filas, `Reporte-Ventas-${fechaInicio}-a-${fechaFin}.csv`);
  };

  const kpis = [
    { label: "Total vendido", valor: fmtCOP(r.totalVentas), Icono: Wallet, color: "bg-primary-soft text-primary" },
    { label: "Número de ventas", valor: r.cantidadVentas ?? 0, Icono: Receipt, color: "bg-accent text-accent-foreground" },
    { label: "Unidades vendidas", valor: r.unidadesVendidas ?? 0, Icono: ShoppingBag, color: "bg-accent text-accent-foreground" },
    { label: "Ticket promedio", valor: fmtCOP(r.ticketPromedio), Icono: Tag, color: "bg-secondary text-secondary-foreground" },
    { label: "IVA recaudado", valor: fmtCOP(r.iva), Icono: Percent, color: "bg-secondary text-secondary-foreground" },
    { label: `Utilidad bruta (${Number(r.margenBruto || 0).toFixed(1)}%)`, valor: fmtCOP(r.utilidadBruta), Icono: TrendingUp, color: "bg-primary-soft text-primary" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reporte general de ventas"
        description="Ventas, IVA, costo y utilidad del periodo. Por defecto se muestra el último mes."
      >
        <button onClick={() => cargar()} className="btn btn-outline btn-sm" title="Recargar" aria-label="Recargar">
          <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
        </button>
        <button onClick={descargarExcel} disabled={!reporte} className="btn btn-outline">
          <FileSpreadsheet size={16} /> Excel
        </button>
        <button onClick={descargarPDF} disabled={descargando} className="btn btn-primary">
          <Download size={16} className={descargando ? "animate-bounce" : ""} />
          {descargando ? "Generando..." : "Exportar PDF"}
        </button>
      </PageHeader>

      <Notice aviso={aviso} onClose={() => setAviso(null)} />

      <form onSubmit={aplicarPersonalizado} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Periodo">
          {RANGOS.map((x) => (
            <button
              type="button"
              key={x.id}
              onClick={() => elegirRango(x.id)}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold ${
                rango === x.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
        {rango === "personalizado" && (
          <>
            <div>
              <label className="label" htmlFor="rv-ini">Desde</label>
              <input id="rv-ini" type="date" max={fechas.fechaFin} className="input" value={fechas.fechaInicio} onChange={(e) => setFechas({ ...fechas, fechaInicio: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="rv-fin">Hasta</label>
              <input id="rv-fin" type="date" min={fechas.fechaInicio} max={hoyISO()} className="input" value={fechas.fechaFin} onChange={(e) => setFechas({ ...fechas, fechaFin: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-soft btn-sm py-2.5">Aplicar</button>
          </>
        )}
        <p className="hint ml-auto">
          Periodo: {fmtFecha(aplicadas.fechaInicio)} – {fmtFecha(aplicadas.fechaFin)}
        </p>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map(({ label, valor, Icono, color }) => (
          <div key={label} className="card flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${color}`}>
              <Icono size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-extrabold text-foreground">{cargando ? "…" : valor}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-extrabold">Ventas e IVA por día</h3>
        <p className="mb-3 text-xs text-muted-foreground">Informe diario de ventas e IVA (requisitos 3.3.1 y 3.3.2)</p>
        {porDia.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">{cargando ? "Cargando..." : "No hubo ventas en este periodo."}</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={porDia}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1EBE2" vertical={false} />
                <XAxis dataKey="dia" tick={ejeTick} />
                <YAxis tick={ejeTick} tickFormatter={(v) => `$${fmtCompacto(v)}`} width={60} />
                <Tooltip contentStyle={estiloTooltip} formatter={(v) => fmtCOP(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" name="Total vendido" fill={VERDE} radius={[6, 6, 0, 0]} />
                <Line dataKey="iva" name="IVA" stroke={AZUL} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-extrabold">Productos vendidos</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Ordenados por valor vendido</p>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-head sticky top-0">
                <tr>
                  <th className="px-5 py-3">Producto</th>
                  <th className="px-5 py-3 text-center">Unid.</th>
                  <th className="px-5 py-3 text-right">Ventas sin IVA</th>
                  <th className="px-5 py-3 text-right">Costo</th>
                  <th className="px-5 py-3 text-right">Utilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(reporte?.porProducto ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">Sin productos vendidos.</td></tr>
                ) : (
                  reporte.porProducto.map((p) => (
                    <tr key={p.id_producto}>
                      <td className="px-5 py-2.5 text-xs font-semibold">{p.nombre_producto}</td>
                      <td className="px-5 py-2.5 text-center text-xs">{p.unidades}</td>
                      <td className="px-5 py-2.5 text-right text-xs">{fmtCOP(p.subtotal)}</td>
                      <td className="px-5 py-2.5 text-right text-xs text-muted-foreground">{fmtCOP(p.costo)}</td>
                      <td className="px-5 py-2.5 text-right text-xs font-bold text-primary">{fmtCOP(p.utilidad)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-extrabold">Ventas por vendedor</h3>
          </div>
          <ul className="divide-y divide-border">
            {(reporte?.porVendedor ?? []).length === 0 ? (
              <li className="py-8 text-center text-xs text-muted-foreground">Sin ventas.</li>
            ) : (
              reporte.porVendedor.map((v) => (
                <li key={v.idusuario ?? "sin"} className="flex items-center justify-between px-5 py-3 text-xs">
                  <span>
                    <span className="font-semibold">{v.vendedor}</span>
                    <span className="block text-muted-foreground">{v.cantidadVentas} venta(s)</span>
                  </span>
                  <span className="font-extrabold">{fmtCOP(v.total)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-extrabold">Detalle de ventas del periodo</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{reporte?.ventas?.length ?? 0} venta(s), de la más reciente a la más antigua</p>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head sticky top-0">
              <tr>
                <th className="px-5 py-3">N° venta</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Vendedor</th>
                <th className="px-5 py-3 text-right">Subtotal</th>
                <th className="px-5 py-3 text-right">IVA</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(reporte?.ventas ?? []).map((v) => (
                <tr key={v.id_venta}>
                  <td className="px-5 py-2.5 font-mono text-xs font-bold text-primary">{v.numero_venta}</td>
                  <td className="px-5 py-2.5 text-xs text-muted-foreground">{fmtFecha(v.fecha)}</td>
                  <td className="px-5 py-2.5 text-xs">{v.vendedor}</td>
                  <td className="px-5 py-2.5 text-right text-xs">{fmtCOP(v.subtotal)}</td>
                  <td className="px-5 py-2.5 text-right text-xs">{fmtCOP(v.iva)}</td>
                  <td className="px-5 py-2.5 text-right text-xs font-extrabold">{fmtCOP(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
