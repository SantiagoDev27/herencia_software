import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Download, FileSpreadsheet, Ban, Pencil, Receipt, Landmark, Scale, TrendingUp, Wallet, ListChecks } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import contabilidadService from "../service/contabilidadService";
import clienteService from "../service/clienteService";
import proveedorService from "../service/proveedorService";
import { useAuth } from "../context/AuthContext";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { PageHeader } from "../components/ui/PageHeader";
import { Modal } from "../components/ui/Modal";
import { Notice } from "../components/ui/Notice";
import { Badge } from "../components/ui/Badge";
import { fmtCOP, fmtCompacto, fmtFecha, toList, hoyISO, haceDiasISO, exportarCSV } from "../lib/format";

// HU-CON-001 a HU-CON-008: gestión contable
const TABS = [
  { id: "movimientos", label: "Movimientos", Icono: ListChecks },
  { id: "resultados", label: "Estado de resultados", Icono: TrendingUp },
  { id: "balance", label: "Balance general", Icono: Scale },
  { id: "flujo", label: "Flujo de caja", Icono: Wallet },
  { id: "cuentas", label: "Cuentas contables", Icono: Landmark },
];
const TIPOS_CUENTA = ["Activo", "Pasivo", "Patrimonio", "Ingreso", "Gasto", "Costo"];
const ORIGEN = { MANUAL: "Manual", VENTA: "Venta", DEVOLUCION: "Devolución", COMPRA: "Compra" };

// Selector de periodo compartido por las pestañas con rango
function Rango({ rango, setRango }) {
  const [f, setF] = useState(rango);
  useEffect(() => setF(rango), [rango]);
  const rapido = (d) => setRango({ fechaInicio: haceDiasISO(d), fechaFin: hoyISO() });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (f.fechaInicio <= f.fechaFin) setRango(f); }} className="card flex flex-wrap items-end gap-3 p-3">
      {[[30, "Último mes"], [90, "3 meses"], [365, "Año"]].map(([d, l]) => (
        <button type="button" key={d} onClick={() => rapido(d)} className="rounded-xl bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-accent">{l}</button>
      ))}
      <div><label className="label" htmlFor="r-ini">Desde</label><input id="r-ini" type="date" className="input py-1.5" value={f.fechaInicio} max={f.fechaFin} onChange={(e) => setF({ ...f, fechaInicio: e.target.value })} /></div>
      <div><label className="label" htmlFor="r-fin">Hasta</label><input id="r-fin" type="date" className="input py-1.5" value={f.fechaFin} min={f.fechaInicio} onChange={(e) => setF({ ...f, fechaFin: e.target.value })} /></div>
      <button type="submit" className="btn btn-soft btn-sm py-2.5">Aplicar</button>
      <span className="hint ml-auto">{fmtFecha(rango.fechaInicio)} – {fmtFecha(rango.fechaFin)}</span>
    </form>
  );
}

const Kpi = ({ label, valor, tono = "text-foreground" }) => (
  <div className="card p-4">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={`text-lg font-extrabold ${tono}`}>{valor}</p>
  </div>
);

const Fila = ({ label, valor, fuerte, signo }) => (
  <div className={`flex justify-between px-4 py-2 text-sm ${fuerte ? "bg-muted/60 font-extrabold" : ""}`}>
    <span>{signo && <span className="mr-1 text-muted-foreground">{signo}</span>}{label}</span>
    <span className={Number(valor) < 0 ? "text-destructive" : ""}>{fmtCOP(valor)}</span>
  </div>
);

export default function Contabilidad() {
  const { puede } = useAuth();
  const puedeRegistrar = puede("registrarContable");
  const puedeCuentas = puede("gestionarCuentas");
  const [tab, setTab] = useState("movimientos");
  const [rango, setRango] = useState({ fechaInicio: haceDiasISO(30), fechaFin: hoyISO() });
  const [fechaCorte, setFechaCorte] = useState(hoyISO());
  const [aviso, setAviso] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [cuentas, setCuentas] = useState([]);
  const [metodos, setMetodos] = useState([]);
  const [movs, setMovs] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCuenta, setFiltroCuenta] = useState("");
  const [resultados, setResultados] = useState(null);
  const [balance, setBalance] = useState(null);
  const [flujo, setFlujo] = useState(null);

  const [terceros, setTerceros] = useState({ clientes: [], proveedores: [] });
  const [nuevoMov, setNuevoMov] = useState(null);
  const [anulando, setAnulando] = useState(null);
  const [cuentaForm, setCuentaForm] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const [c, m] = await Promise.all([contabilidadService.cuentas(), contabilidadService.metodosPago()]);
      setCuentas(toList(c));
      setMetodos(toList(m));
      if (tab === "movimientos") {
        const r = await contabilidadService.movimientos({ ...rango, ...(filtroTipo ? { tipo: filtroTipo } : {}), ...(filtroCuenta ? { fk_cuenta: filtroCuenta } : {}), incluirAnulados: true });
        setMovs(r.data);
      } else if (tab === "resultados") setResultados((await contabilidadService.resultados(rango)).data);
      else if (tab === "balance") setBalance((await contabilidadService.balance({ fechaCorte })).data);
      else if (tab === "flujo") setFlujo((await contabilidadService.flujo(rango)).data);
    } catch (err) {
      if (!silencioso) setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [tab, rango, fechaCorte, filtroTipo, filtroCuenta]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useAutoRefresh(cargar);

  const cuentasActivas = cuentas.filter((c) => c.estado === "Activa");

  const abrirMovimiento = async (tipo) => {
    setError("");
    const porDefecto = cuentasActivas.find((c) => (tipo === "Ingreso" ? c.codigo === "4250" : c.codigo === "5195")) ?? cuentasActivas[0];
    setNuevoMov({ tipo, fecha: hoyISO(), concepto: "", valor: "", fk_cuenta: porDefecto?.id_cuenta ?? "", fk_metodo_pago: "1", tercero: "", observaciones: "" });
    const [c, p] = await Promise.allSettled([clienteService.listar(), proveedorService.obtenerTodos()]);
    setTerceros({ clientes: c.status === "fulfilled" ? toList(c.value) : [], proveedores: p.status === "fulfilled" ? toList(p.value) : [] });
  };

  const guardarMovimiento = async (e) => {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const { tipo, tercero, ...d } = nuevoMov;
      const res = await contabilidadService.registrar(tipo, {
        ...d,
        valor: Number(d.valor),
        fk_cuenta: Number(d.fk_cuenta),
        fk_metodo_pago: Number(d.fk_metodo_pago),
        ...(tipo === "Ingreso" ? { fk_cliente: tercero ? Number(tercero) : null } : { fk_proveedor: tercero ? Number(tercero) : null }),
      });
      setAviso({ tipo: "success", texto: `${tipo} ${res.data.referencia} registrado por ${fmtCOP(res.data.valor)}.` });
      contabilidadService.comprobante(tipo, tipo === "Ingreso" ? res.data.id_ingreso : res.data.id_egreso, res.data.referencia).catch(() => {});
      setNuevoMov(null);
      cargar(true);
    } catch (err) {
      setError(err.mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const anular = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await contabilidadService.anular(anulando.mov.tipo, anulando.mov.id, anulando.motivo.trim());
      setAviso({ tipo: "success", texto: `${anulando.mov.referencia} anulado.` });
      setAnulando(null);
      cargar(true);
    } catch (err) {
      setError(err.mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const guardarCuenta = async (e) => {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const { id_cuenta, codigo, nombre_cuenta, tipo, naturaleza } = cuentaForm;
      if (id_cuenta) await contabilidadService.actualizarCuenta(id_cuenta, { codigo, nombre_cuenta, tipo, naturaleza });
      else await contabilidadService.crearCuenta({ codigo, nombre_cuenta, tipo, naturaleza });
      setAviso({ tipo: "success", texto: `Cuenta ${codigo} ${id_cuenta ? "actualizada" : "creada"}.` });
      setCuentaForm(null);
      cargar(true);
    } catch (err) {
      setError(err.mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstadoCuenta = async (c) => {
    try {
      await contabilidadService.estadoCuenta(c.id_cuenta, c.estado === "Activa" ? "Inactiva" : "Activa");
      cargar(true);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje });
    }
  };

  // Exportaciones (requisito 2.2.4.8: PDF y Excel)
  const descargar = async (fn) => {
    try {
      await fn();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje || "No se pudo generar el archivo." });
    }
  };
  const excel = () => {
    const per = `${rango.fechaInicio}-a-${rango.fechaFin}`;
    if (tab === "movimientos" && movs) exportarCSV([["Referencia", "Fecha", "Tipo", "Concepto", "Cuenta", "Método", "Tercero", "Origen", "Estado", "Valor"], ...movs.movimientos.map((m) => [m.referencia, m.fecha, m.tipo, m.concepto, m.cuenta, m.metodo_pago, m.tercero, ORIGEN[m.origen], m.estado, m.valor])], `Movimientos-${per}.csv`);
    if (tab === "resultados" && resultados) exportarCSV([["Estado de resultados", per], ["Ventas brutas", resultados.ingresos.ventasBrutas], ["Descuentos", -resultados.ingresos.descuentos], ["Devoluciones", -resultados.ingresos.devoluciones], ["Ingresos netos", resultados.ingresos.ingresosNetos], ["Costo de ventas", -resultados.costos.total], ["Utilidad bruta", resultados.utilidadBruta], ...resultados.gastos.detalle.map((g) => [g.cuenta, -g.valor]), ["Utilidad operacional", resultados.utilidadOperacional], ...resultados.otrosIngresos.detalle.map((o) => [o.cuenta, o.valor]), [`${resultados.resultado} neta`, resultados.utilidadNeta]], `Estado-Resultados-${per}.csv`);
    if (tab === "balance" && balance) exportarCSV([["Balance general", balance.fechaCorte], ["ACTIVOS"], ...balance.activos.map((a) => [`${a.codigo} ${a.cuenta}`, a.valor]), ["Total activos", balance.totales.activos], ["PASIVOS"], ...balance.pasivos.map((a) => [`${a.codigo} ${a.cuenta}`, a.valor]), ["Total pasivos", balance.totales.pasivos], ["PATRIMONIO"], ...balance.patrimonio.map((a) => [`${a.codigo} ${a.cuenta}`, a.valor]), ["Total pasivo + patrimonio", balance.totales.pasivoMasPatrimonio]], `Balance-General-${balance.fechaCorte}.csv`);
    if (tab === "flujo" && flujo) exportarCSV([["Flujo de caja", per], ["Saldo inicial", flujo.saldoInicial], [], ["Fecha", "Entradas", "Salidas", "Neto", "Saldo"], ...flujo.porDia.map((d) => [d.fecha, d.entradas, d.salidas, d.neto, d.saldo]), [], ["Saldo final", flujo.saldoFinal]], `Flujo-Caja-${per}.csv`);
    if (tab === "cuentas") exportarCSV([["Código", "Cuenta", "Tipo", "Naturaleza", "Estado"], ...cuentas.map((c) => [c.codigo, c.nombre_cuenta, c.tipo, c.naturaleza, c.estado])], "Cuentas-Contables.csv");
  };
  const pdf = () => {
    if (tab === "resultados") descargar(() => contabilidadService.resultadosPDF(rango));
    if (tab === "balance") descargar(() => contabilidadService.balancePDF({ fechaCorte }));
    if (tab === "flujo") descargar(() => contabilidadService.flujoPDF(rango));
  };

  const graficoFlujo = useMemo(() => (flujo?.porDia ?? []).map((d) => ({ ...d, dia: fmtFecha(d.fecha).replace(/ de \d{4}$/, "") })), [flujo]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader title="Contabilidad" description="Ingresos, egresos, cuentas y estados financieros. Las ventas, devoluciones y compras se registran solas.">
        <button onClick={() => cargar()} className="btn btn-outline btn-sm" aria-label="Recargar"><RefreshCw size={15} className={cargando ? "animate-spin" : ""} /></button>
        <button onClick={excel} className="btn btn-outline"><FileSpreadsheet size={16} /> Excel</button>
        {["resultados", "balance", "flujo"].includes(tab) && <button onClick={pdf} className="btn btn-secondary"><Download size={16} /> PDF</button>}
        {puedeRegistrar && tab === "movimientos" && (
          <>
            <button onClick={() => abrirMovimiento("Ingreso")} className="btn btn-primary"><Plus size={16} /> Ingreso</button>
            <button onClick={() => abrirMovimiento("Egreso")} className="btn btn-secondary"><Plus size={16} /> Egreso</button>
          </>
        )}
        {puedeCuentas && tab === "cuentas" && (
          <button onClick={() => { setError(""); setCuentaForm({ codigo: "", nombre_cuenta: "", tipo: "Gasto", naturaleza: "Débito" }); }} className="btn btn-primary"><Plus size={16} /> Nueva cuenta</button>
        )}
      </PageHeader>
      <Notice aviso={aviso} onClose={() => setAviso(null)} />

      <div className="flex flex-wrap gap-1.5" role="tablist">
        {TABS.map(({ id, label, Icono }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${tab === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
            <Icono size={14} /> {label}
          </button>
        ))}
      </div>

      {["movimientos", "resultados", "flujo"].includes(tab) && <Rango rango={rango} setRango={setRango} />}

      {/* ---------- Movimientos (HU-CON-004) ---------- */}
      {tab === "movimientos" && movs && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Ingresos" valor={fmtCOP(movs.totales.ingresos)} tono="text-primary" />
            <Kpi label="Egresos" valor={fmtCOP(movs.totales.egresos)} tono="text-destructive" />
            <Kpi label="Neto" valor={fmtCOP(movs.totales.neto)} />
            <Kpi label="Registros" valor={movs.totales.movimientos} />
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Tipo" className="input w-40" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
              <option value="">Ingresos y egresos</option><option value="ingreso">Solo ingresos</option><option value="egreso">Solo egresos</option>
            </select>
            <select aria-label="Cuenta" className="input w-72" value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value)}>
              <option value="">Todas las cuentas</option>
              {cuentas.map((c) => <option key={c.id_cuenta} value={c.id_cuenta}>{c.codigo} {c.nombre_cuenta}</option>)}
            </select>
          </div>
          <div className="card overflow-hidden">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="table-head sticky top-0">
                  <tr><th className="px-4 py-3">Ref.</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Concepto</th><th className="px-4 py-3">Cuenta</th><th className="px-4 py-3">Método</th><th className="px-4 py-3 text-center">Origen</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right" /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {movs.movimientos.length === 0 ? (
                    <tr><td colSpan={8} className="py-10 text-center text-xs text-muted-foreground">Sin movimientos en el periodo.</td></tr>
                  ) : movs.movimientos.map((m) => (
                    <tr key={`${m.tipo}-${m.id}`} className={m.estado === "Anulado" ? "opacity-50" : ""}>
                      <td className="px-4 py-2.5 font-mono text-[11px] font-bold">{m.referencia}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtFecha(m.fecha)}</td>
                      <td className="px-4 py-2.5 text-xs">{m.concepto}{m.tercero && <span className="block text-[10px] text-muted-foreground">{m.tercero}</span>}</td>
                      <td className="px-4 py-2.5 text-[11px]">{m.cuenta}</td>
                      <td className="px-4 py-2.5 text-xs capitalize">{m.metodo_pago}</td>
                      <td className="px-4 py-2.5 text-center"><Badge variant={m.estado === "Anulado" ? "danger" : m.origen === "MANUAL" ? "neutral" : "info"}>{m.estado === "Anulado" ? "Anulado" : ORIGEN[m.origen]}</Badge></td>
                      <td className={`px-4 py-2.5 text-right text-xs font-bold ${m.tipo === "Ingreso" ? "text-primary" : "text-destructive"}`}>{m.tipo === "Ingreso" ? "+" : "−"}{fmtCOP(m.valor)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <button onClick={() => descargar(() => contabilidadService.comprobante(m.tipo, m.id, m.referencia ?? `${m.tipo}-${m.id}`))} className="btn-icon hover:text-primary" title="Comprobante" aria-label={`Comprobante ${m.referencia}`}><Receipt size={14} /></button>
                        {puedeRegistrar && m.origen === "MANUAL" && m.estado === "Activo" && (
                          <button onClick={() => { setError(""); setAnulando({ mov: m, motivo: "" }); }} className="btn-icon hover:text-destructive" title="Anular" aria-label={`Anular ${m.referencia}`}><Ban size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {movs.porCuenta.length > 0 && (
            <div className="card p-4">
              <h3 className="mb-2 text-sm font-extrabold">Totales por cuenta</h3>
              <div className="grid gap-1 text-xs sm:grid-cols-2">
                {movs.porCuenta.map((c) => (
                  <div key={c.cuenta} className="flex justify-between rounded-lg bg-muted/50 px-3 py-1.5"><span>{c.cuenta}</span><span><span className="text-primary">+{fmtCOP(c.ingresos)}</span> · <span className="text-destructive">−{fmtCOP(c.egresos)}</span></span></div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ---------- Estado de resultados (HU-CON-006) ---------- */}
      {tab === "resultados" && resultados && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-4">
            <Kpi label="Ingresos operacionales netos" valor={fmtCOP(resultados.ingresos.ingresosNetos)} />
            <Kpi label="Utilidad bruta" valor={fmtCOP(resultados.utilidadBruta)} tono="text-primary" />
            <Kpi label={`${resultados.resultado} neta (margen ${resultados.margenNeto}%)`} valor={fmtCOP(resultados.utilidadNeta)} tono={resultados.utilidadNeta >= 0 ? "text-primary" : "text-destructive"} />
          </div>
          <div className="card divide-y divide-border overflow-hidden lg:col-span-2">
            <Fila label="Ventas brutas" valor={resultados.ingresos.ventasBrutas} />
            <Fila signo="(−)" label="Descuentos" valor={resultados.ingresos.descuentos} />
            <Fila signo="(−)" label="Devoluciones en ventas" valor={resultados.ingresos.devoluciones} />
            <Fila fuerte label="Ingresos operacionales netos" valor={resultados.ingresos.ingresosNetos} />
            <Fila signo="(−)" label="Costo de la mercancía vendida" valor={resultados.costos.costoMercanciaVendida} />
            {resultados.costos.otrosCostos.map((c) => <Fila key={c.cuenta} signo="(−)" label={c.cuenta} valor={c.valor} />)}
            <Fila fuerte label="Utilidad bruta" valor={resultados.utilidadBruta} />
            {resultados.gastos.detalle.map((g) => <Fila key={g.cuenta} signo="(−)" label={g.cuenta} valor={g.valor} />)}
            <Fila fuerte label="Utilidad operacional" valor={resultados.utilidadOperacional} />
            {resultados.otrosIngresos.detalle.map((o) => <Fila key={o.cuenta} signo="(+)" label={o.cuenta} valor={o.valor} />)}
            <Fila fuerte label={`${resultados.resultado} neta del periodo`} valor={resultados.utilidadNeta} />
          </div>
        </div>
      )}

      {/* ---------- Balance general (HU-CON-005) ---------- */}
      {tab === "balance" && (
        <>
          <div className="card flex flex-wrap items-end gap-3 p-3">
            <div><label className="label" htmlFor="b-corte">Fecha de corte</label><input id="b-corte" type="date" max={hoyISO()} className="input py-1.5" value={fechaCorte} onChange={(e) => e.target.value && setFechaCorte(e.target.value)} /></div>
            {balance && (
              <Badge variant={Math.abs(balance.totales.activos - balance.totales.pasivoMasPatrimonio) < 1 ? "success" : "danger"}>
                Activo = Pasivo + Patrimonio
              </Badge>
            )}
          </div>
          {balance && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="card divide-y divide-border overflow-hidden">
                <p className="px-4 py-2 text-xs font-extrabold uppercase text-muted-foreground">Activos</p>
                {balance.activos.map((a) => <Fila key={a.codigo} label={`${a.codigo} ${a.cuenta}`} valor={a.valor} />)}
                <Fila fuerte label="Total activos" valor={balance.totales.activos} />
              </div>
              <div className="card divide-y divide-border overflow-hidden">
                <p className="px-4 py-2 text-xs font-extrabold uppercase text-muted-foreground">Pasivos</p>
                {balance.pasivos.map((a) => <Fila key={a.codigo} label={`${a.codigo} ${a.cuenta}`} valor={a.valor} />)}
                <Fila fuerte label="Total pasivos" valor={balance.totales.pasivos} />
                <p className="px-4 py-2 text-xs font-extrabold uppercase text-muted-foreground">Patrimonio</p>
                {balance.patrimonio.map((a) => <Fila key={a.codigo} label={`${a.codigo} ${a.cuenta}`} valor={a.valor} />)}
                <Fila fuerte label="Total pasivo + patrimonio" valor={balance.totales.pasivoMasPatrimonio} />
              </div>
              <p className="hint lg:col-span-2">{balance.nota}</p>
            </div>
          )}
        </>
      )}

      {/* ---------- Flujo de caja (HU-CON-007) ---------- */}
      {tab === "flujo" && flujo && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Kpi label="Saldo inicial" valor={fmtCOP(flujo.saldoInicial)} />
            <Kpi label="Entradas" valor={fmtCOP(flujo.entradas)} tono="text-primary" />
            <Kpi label="Salidas" valor={fmtCOP(flujo.salidas)} tono="text-destructive" />
            <Kpi label="Flujo neto" valor={fmtCOP(flujo.flujoNeto)} />
            <Kpi label="Saldo final" valor={fmtCOP(flujo.saldoFinal)} tono="text-primary" />
          </div>
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-extrabold">Entradas, salidas y saldo por día</h3>
            {graficoFlujo.length === 0 ? <p className="py-8 text-center text-xs text-muted-foreground">Sin movimientos de caja en el periodo.</p> : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={graficoFlujo}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E1EBE2" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "#587063" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#587063" }} tickFormatter={(v) => `$${fmtCompacto(v)}`} width={60} />
                    <Tooltip formatter={(v) => fmtCOP(v)} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="entradas" name="Entradas" fill="#25794D" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="salidas" name="Salidas" fill="#E08A7A" radius={[6, 6, 0, 0]} />
                    <Line dataKey="saldo" name="Saldo" stroke="#4A9CC9" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="card divide-y divide-border overflow-hidden">
            {flujo.porConcepto.map((c) => <Fila key={c.concepto} label={c.concepto} valor={c.valor} />)}
          </div>
        </>
      )}

      {/* ---------- Cuentas contables (HU-CON-003) ---------- */}
      {tab === "cuentas" && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="table-head"><tr><th className="px-4 py-3">Código</th><th className="px-4 py-3">Cuenta</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Naturaleza</th><th className="px-4 py-3 text-center">Estado</th>{puedeCuentas && <th className="px-4 py-3 text-right" />}</tr></thead>
            <tbody className="divide-y divide-border">
              {cuentas.map((c) => (
                <tr key={c.id_cuenta}>
                  <td className="px-4 py-2.5 font-mono text-xs font-bold">{c.codigo}</td>
                  <td className="px-4 py-2.5 text-xs">{c.nombre_cuenta}</td>
                  <td className="px-4 py-2.5 text-xs">{c.tipo}</td>
                  <td className="px-4 py-2.5 text-xs">{c.naturaleza}</td>
                  <td className="px-4 py-2.5 text-center"><Badge variant={c.estado === "Activa" ? "success" : "neutral"}>{c.estado}</Badge></td>
                  {puedeCuentas && (
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => { setError(""); setCuentaForm({ ...c }); }} className="btn-icon hover:text-primary" aria-label={`Editar ${c.codigo}`}><Pencil size={14} /></button>
                      <button onClick={() => cambiarEstadoCuenta(c)} className="btn btn-outline btn-sm ml-1">{c.estado === "Activa" ? "Desactivar" : "Activar"}</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Registrar ingreso / egreso (HU-CON-001 / 002) */}
      <Modal open={!!nuevoMov} onClose={() => setNuevoMov(null)} title={`Registrar ${nuevoMov?.tipo?.toLowerCase() ?? ""}`} subtitle="Se genera el comprobante en PDF al guardar.">
        {nuevoMov && (
          <form onSubmit={guardarMovimiento} className="space-y-3">
            <Notice aviso={error ? { tipo: "error", texto: error } : null} />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="m-fecha">Fecha *</label><input id="m-fecha" type="date" required max={hoyISO()} className="input" value={nuevoMov.fecha} onChange={(e) => setNuevoMov({ ...nuevoMov, fecha: e.target.value })} /></div>
              <div><label className="label" htmlFor="m-valor">Valor ($) *</label><input id="m-valor" type="number" min="1" step="any" required className="input" value={nuevoMov.valor} onChange={(e) => setNuevoMov({ ...nuevoMov, valor: e.target.value })} /></div>
            </div>
            <div><label className="label" htmlFor="m-concepto">Concepto *</label><input id="m-concepto" required minLength={3} maxLength={150} className="input" value={nuevoMov.concepto} onChange={(e) => setNuevoMov({ ...nuevoMov, concepto: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="m-cuenta">Cuenta contable *</label>
                <select id="m-cuenta" required className="input" value={nuevoMov.fk_cuenta} onChange={(e) => setNuevoMov({ ...nuevoMov, fk_cuenta: e.target.value })}>
                  {cuentasActivas.map((c) => <option key={c.id_cuenta} value={c.id_cuenta}>{c.codigo} {c.nombre_cuenta}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="m-metodo">Método de pago *</label>
                <select id="m-metodo" className="input capitalize" value={nuevoMov.fk_metodo_pago} onChange={(e) => setNuevoMov({ ...nuevoMov, fk_metodo_pago: e.target.value })}>
                  {metodos.map((m) => <option key={m.id_metodopago} value={m.id_metodopago}>{m.metodo_pago}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="m-tercero">{nuevoMov.tipo === "Ingreso" ? "Cliente (si aplica)" : "Proveedor (si aplica)"}</label>
              <select id="m-tercero" className="input" value={nuevoMov.tercero} onChange={(e) => setNuevoMov({ ...nuevoMov, tercero: e.target.value })}>
                <option value="">—</option>
                {nuevoMov.tipo === "Ingreso"
                  ? terceros.clientes.map((c) => <option key={c.id_cliente} value={c.id_cliente}>{c.nombre_cliente} {c.apellido_cliente ?? ""}</option>)
                  : terceros.proveedores.map((p) => <option key={p.id_proveedor} value={p.id_proveedor}>{p.razon_social}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="m-obs">Observaciones</label><input id="m-obs" maxLength={150} className="input" value={nuevoMov.observaciones} onChange={(e) => setNuevoMov({ ...nuevoMov, observaciones: e.target.value })} /></div>
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button type="button" onClick={() => setNuevoMov(null)} className="btn btn-outline btn-sm">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn btn-primary btn-sm">{guardando ? "Guardando..." : `Registrar ${nuevoMov.tipo.toLowerCase()}`}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!anulando} onClose={() => setAnulando(null)} title={`Anular ${anulando?.mov?.referencia ?? ""}`} maxWidth="max-w-md">
        {anulando && (
          <form onSubmit={anular} className="space-y-3">
            <Notice aviso={error ? { tipo: "error", texto: error } : null} />
            <label className="label" htmlFor="a-motivo">Motivo *</label>
            <input id="a-motivo" required minLength={3} className="input" value={anulando.motivo} onChange={(e) => setAnulando({ ...anulando, motivo: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAnulando(null)} className="btn btn-outline btn-sm">Volver</button>
              <button type="submit" disabled={guardando} className="btn btn-danger btn-sm">Anular</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!cuentaForm} onClose={() => setCuentaForm(null)} title={cuentaForm?.id_cuenta ? "Editar cuenta" : "Nueva cuenta contable"} maxWidth="max-w-md">
        {cuentaForm && (
          <form onSubmit={guardarCuenta} className="space-y-3">
            <Notice aviso={error ? { tipo: "error", texto: error } : null} />
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label" htmlFor="k-cod">Código *</label><input id="k-cod" required pattern="[0-9]{1,10}" className="input" value={cuentaForm.codigo} onChange={(e) => setCuentaForm({ ...cuentaForm, codigo: e.target.value })} /></div>
              <div className="col-span-2"><label className="label" htmlFor="k-nom">Nombre *</label><input id="k-nom" required minLength={3} className="input" value={cuentaForm.nombre_cuenta} onChange={(e) => setCuentaForm({ ...cuentaForm, nombre_cuenta: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="k-tipo">Tipo</label><select id="k-tipo" className="input" value={cuentaForm.tipo} onChange={(e) => setCuentaForm({ ...cuentaForm, tipo: e.target.value })}>{TIPOS_CUENTA.map((t) => <option key={t}>{t}</option>)}</select></div>
              <div><label className="label" htmlFor="k-nat">Naturaleza</label><select id="k-nat" className="input" value={cuentaForm.naturaleza} onChange={(e) => setCuentaForm({ ...cuentaForm, naturaleza: e.target.value })}><option>Débito</option><option>Crédito</option></select></div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCuentaForm(null)} className="btn btn-outline btn-sm">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn btn-primary btn-sm">Guardar</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
