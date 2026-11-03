import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Package, TrendingUp, Wallet, CheckCircle, XCircle, Truck,
  AlertTriangle, ArrowRight, RefreshCw, Clock,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { KpiCard } from "../components/dashboard/KpiCard";
import { PageHeader } from "../components/ui/PageHeader";
import { Notice } from "../components/ui/Notice";
import { Badge } from "../components/ui/Badge";
import reporteService from "../service/reporteService";
import ventaService from "../service/ventaService";
import movimientoService from "../service/movimientoService";
import notificacionService from "../service/notificacionService";
import proveedorService from "../service/proveedorService";
import { fmtCOP, fmtCompacto, fmtFecha, toList, mesKey, mesCorto } from "../lib/format";

// Mismos colores que los tokens --chart-* de index.css (recharts necesita valores literales)
const VERDE = "#25794D";
const AZUL = "#7CC4EA";
const AMARILLO = "#F2D55C";
const COLORES_PIE = [VERDE, AZUL, AMARILLO, "#8ED3A8", "#4A9CC9"];

const estiloTooltip = { borderRadius: 12, border: "1px solid #E1EBE2", fontSize: 12 };
const ejeTick = { fontSize: 11, fill: "#587063" };

// Últimos 6 meses (incluye el actual) como claves "YYYY-MM"
const ultimosMeses = (cantidad = 6) => {
  const hoy = new Date();
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (cantidad - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
};

export function Dashboard() {
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null);
  const [reporte, setReporte] = useState(null);
  const [ventas, setVentas] = useState({ lista: [], total: 0 });
  const [ingresos, setIngresos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [alertas, setAlertas] = useState({ stockMinimo: [], proximosVencer: [], agotados: [] });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    const [resRep, resVentas, resIng, resProv, resAlertas] = await Promise.allSettled([
      reporteService.obtenerReporteInventario(),
      ventaService.listarVentas({ pagina: 1, limite: 100 }),
      movimientoService.listarIngresos(),
      proveedorService.obtenerTodos(),
      notificacionService.obtenerTodas(),
    ]);

    setReporte(resRep.status === "fulfilled" ? resRep.value?.data ?? null : null);
    setVentas(
      resVentas.status === "fulfilled"
        ? { lista: toList(resVentas.value, "ventas"), total: resVentas.value?.data?.total ?? 0 }
        : { lista: [], total: 0 }
    );
    setIngresos(resIng.status === "fulfilled" ? toList(resIng.value) : []);
    setProveedores(resProv.status === "fulfilled" ? toList(resProv.value) : []);
    if (resAlertas.status === "fulfilled") setAlertas(resAlertas.value);

    const fallos = [resRep, resVentas, resIng, resProv].filter((r) => r.status === "rejected");
    setAviso(
      fallos.length
        ? { tipo: "warning", texto: `${fallos[0].reason?.mensaje ?? "Algunos datos no se pudieron cargar."}` }
        : null
    );
    setCargando(false);
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const resumen = reporte?.resumen ?? {};
  const inventario = useMemo(() => reporte?.inventario ?? [], [reporte]);

  // Ventas del mes actual (de las últimas 100 ventas que devuelve el backend)
  const mesActual = ultimosMeses(1)[0];
  const ventasDelMes = ventas.lista.filter((v) => mesKey(v.fecha) === mesActual);
  const totalVentasMes = ventasDelMes.reduce((acc, v) => acc + Number(v.total || 0), 0);

  // Ventas vs compras (entradas de mercancía) por mes: datos reales
  const serieMensual = useMemo(() => {
    const meses = ultimosMeses(6);
    const ventasPorMes = new Map(meses.map((m) => [m, 0]));
    const comprasPorMes = new Map(meses.map((m) => [m, 0]));
    ventas.lista.forEach((v) => {
      const k = mesKey(v.fecha);
      if (ventasPorMes.has(k)) ventasPorMes.set(k, ventasPorMes.get(k) + Number(v.total || 0));
    });
    ingresos.forEach((ing) => {
      const k = mesKey(ing.fecha);
      if (comprasPorMes.has(k)) comprasPorMes.set(k, comprasPorMes.get(k) + Number(ing.total || 0));
    });
    return meses.map((m) => ({ mes: mesCorto(m), ventas: ventasPorMes.get(m), compras: comprasPorMes.get(m) }));
  }, [ventas.lista, ingresos]);
  const haySerie = serieMensual.some((d) => d.ventas > 0 || d.compras > 0);

  // Productos por categoría (del reporte de inventario)
  const categoriaData = useMemo(() => {
    const conteo = new Map();
    inventario.forEach((p) => {
      const nombre = p.categoria?.nombre_categoria ?? "Sin categoría";
      conteo.set(nombre, (conteo.get(nombre) ?? 0) + 1);
    });
    return [...conteo].map(([name, value]) => ({ name, value }));
  }, [inventario]);

  const topStock = useMemo(
    () =>
      inventario
        .filter((p) => Number(p.stock) > 0)
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 5)
        .map((p) => ({
          nombre: p.nombre_producto?.length > 20 ? `${p.nombre_producto.slice(0, 18)}…` : p.nombre_producto,
          stock: p.stock,
        })),
    [inventario]
  );

  const listaAlertas = [
    ...alertas.agotados.map((p) => ({ id: `ag-${p.id_producto}`, nombre: p.nombre_producto, detalle: "Agotado", tipo: "danger" })),
    ...alertas.stockMinimo.map((p) => ({ id: `sm-${p.id_producto}`, nombre: p.nombre_producto, detalle: `Quedan ${p.stock} uds`, tipo: "warning" })),
    ...alertas.proximosVencer.map((p) => ({ id: `pv-${p.id_producto}`, nombre: p.nombre_producto, detalle: `Vence ${fmtFecha(p.fecha_vencimiento)}`, tipo: "info" })),
  ];

  const sinDatos = (texto) => <div className="py-10 text-center text-xs text-muted-foreground">{texto}</div>;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader title="Resumen general" description="Indicadores del negocio con datos en vivo del backend.">
        <button onClick={cargarDatos} className="btn btn-outline btn-sm">
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
          Actualizar
        </button>
      </PageHeader>

      <Notice aviso={aviso} onClose={() => setAviso(null)} />

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Inventario a costo"
          value={fmtCOP(resumen.costoTotalInventario)}
          sub={`${resumen.totalProductos ?? 0} referencias`}
          icon={Package}
          color="bg-accent text-accent-foreground"
        />
        <KpiCard
          label="Con stock"
          value={String(resumen.productosConStock ?? 0)}
          sub="productos disponibles"
          icon={CheckCircle}
          color="bg-primary-soft text-primary"
        />
        <KpiCard
          label="Agotados"
          value={String(resumen.productosSinStock ?? 0)}
          sub={`${resumen.productosConStockBajo ?? 0} con stock bajo`}
          icon={XCircle}
          color="bg-destructive-soft text-destructive"
        />
        <KpiCard
          label="Ventas del mes"
          value={fmtCOP(totalVentasMes)}
          sub={`${ventasDelMes.length} facturas · ${ventas.total} en total`}
          icon={TrendingUp}
          color="bg-primary-soft text-primary"
        />
        <KpiCard
          label="Valor de venta"
          value={fmtCOP(resumen.valorPotencialVentas)}
          sub="potencial del inventario"
          icon={Wallet}
          color="bg-secondary text-secondary-foreground"
        />
        <KpiCard
          label="Proveedores"
          value={String(proveedores.length)}
          sub="activos"
          icon={Truck}
          color="bg-accent text-accent-foreground"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4">
            <h3 className="text-sm font-extrabold text-foreground">Ventas vs. compras de mercancía</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Últimos 6 meses · ventas facturadas y entradas de inventario</p>
          </div>
          {!haySerie ? (
            sinDatos("Aún no hay ventas ni entradas registradas en los últimos 6 meses.")
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={serieMensual} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={VERDE} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={VERDE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCompras" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={AZUL} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={AZUL} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1EBE2" vertical={false} />
                <XAxis dataKey="mes" tick={ejeTick} axisLine={false} tickLine={false} />
                <YAxis tick={ejeTick} axisLine={false} tickLine={false} tickFormatter={(v) => `$${fmtCompacto(v)}`} width={56} />
                <Tooltip contentStyle={estiloTooltip} formatter={(v) => fmtCOP(v)} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area type="monotone" dataKey="ventas" name="Ventas" stroke={VERDE} fill="url(#gVentas)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="compras" name="Compras" stroke="#4A9CC9" fill="url(#gCompras)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-3">
            <h3 className="text-sm font-extrabold text-foreground">Productos por categoría</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Referencias activas en el catálogo</p>
          </div>
          {categoriaData.length === 0 ? (
            sinDatos("No hay productos registrados.")
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={categoriaData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="value" stroke="none">
                    {categoriaData.map((d, i) => (
                      <Cell key={d.name} fill={COLORES_PIE[i % COLORES_PIE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={estiloTooltip} formatter={(v) => [`${v} productos`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {categoriaData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: COLORES_PIE[i % COLORES_PIE.length] }} />
                    <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
                    <span className="font-bold text-foreground">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mayor existencia y alertas */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <div className="mb-4">
            <h3 className="text-sm font-extrabold text-foreground">Productos con mayor existencia</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Unidades disponibles en bodega</p>
          </div>
          {topStock.length === 0 ? (
            sinDatos("No hay productos con existencias para graficar.")
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={topStock} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E1EBE2" horizontal={false} />
                <XAxis type="number" tick={ejeTick} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nombre" tick={ejeTick} axisLine={false} tickLine={false} width={130} />
                <Tooltip contentStyle={estiloTooltip} cursor={{ fill: "#F3F8F3" }} />
                <Bar dataKey="stock" name="Stock" fill={VERDE} radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-foreground">Alertas de inventario</h3>
            <Link to="/dashboard/productos" className="text-xs font-bold text-primary hover:underline">Ver catálogo</Link>
          </div>
          <div className="max-h-56 space-y-2.5 overflow-y-auto">
            {listaAlertas.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No hay alertas activas de stock o vencimiento.</p>
            ) : (
              listaAlertas.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl bg-muted/70 p-3">
                  <div
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                      a.tipo === "danger" ? "bg-destructive-soft text-destructive" : a.tipo === "info" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {a.tipo === "info" ? <Clock size={13} /> : <AlertTriangle size={13} />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">{a.nombre}</p>
                    <div className="mt-0.5">
                      <Badge variant={a.tipo}>{a.detalle}</Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Últimas ventas */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">Últimas ventas</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Facturas emitidas recientemente</p>
          </div>
          <Link to="/dashboard/ventas" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-hover">
            Ver todas <ArrowRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">Factura</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3 text-right">Subtotal</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ventas.lista.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                    {cargando ? "Cargando..." : "No hay ventas registradas aún. Visita la sección Ventas para emitir una."}
                  </td>
                </tr>
              ) : (
                ventas.lista.slice(0, 5).map((v) => (
                  <tr key={v.id_venta} className="transition-colors hover:bg-muted/50">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-primary">{v.numero_venta}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{fmtFecha(v.fecha)}</td>
                    <td className="px-5 py-3 text-right text-xs text-muted-foreground">{fmtCOP(v.subtotal)}</td>
                    <td className="px-5 py-3 text-right text-xs font-extrabold text-foreground">{fmtCOP(v.total)}</td>
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
