import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Eye, Download, PackageCheck, Ban, X } from "lucide-react";
import ordenCompraService from "../service/ordenCompraService";
import proveedorService from "../service/proveedorService";
import productoService from "../service/productoService";
import ventaService from "../service/ventaService";
import { useAuth } from "../context/AuthContext";
import { useAutoRefresh, avisarCambioDeDatos } from "../hooks/useAutoRefresh";
import { PageHeader } from "../components/ui/PageHeader";
import { Modal } from "../components/ui/Modal";
import { Notice } from "../components/ui/Notice";
import { Badge } from "../components/ui/Badge";
import { fmtCOP, fmtFecha, toList, codigoAuto, PERIODOS, PERIODO_DEFECTO, rangoDePeriodo } from "../lib/format";

// HU-PROV-006: Gestionar órdenes de compra (crear, imprimir, recibir con lotes, cancelar)
const VARIANTE = { Pendiente: "warning", Recibida: "success", Cancelada: "danger" };

export default function Compras() {
  const { puede } = useAuth();
  const puedeGestionar = puede("gestionarCompras");
  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null);
  const [estado, setEstado] = useState("");
  const [periodo, setPeriodo] = useState(PERIODO_DEFECTO);

  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [precios, setPrecios] = useState(new Map());
  const [metodos, setMetodos] = useState([]);

  const [nueva, setNueva] = useState(null); // { fk_proveedor, fecha_entrega_estimada, observacion, lineas }
  const [detalle, setDetalle] = useState(null);
  const [recibiendo, setRecibiendo] = useState(null); // { orden, lotes, registrar_pago, fk_metodo_pago }
  const [cancelando, setCancelando] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const { fechaInicio, fechaFin } = rangoDePeriodo(periodo);
      setOrdenes(toList(await ordenCompraService.listar({ ...(estado ? { estado } : {}), ...(fechaInicio ? { fechaInicio, fechaFin } : {}) })));
    } catch (err) {
      if (!silencioso) setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [estado, periodo]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useAutoRefresh(cargar);

  const abrirNueva = async () => {
    setError("");
    setNueva({ fk_proveedor: "", fecha_entrega_estimada: "", observacion: "", lineas: [] });
    const [p, pr] = await Promise.allSettled([proveedorService.obtenerTodos(), productoService.obtenerTodos()]);
    if (p.status === "fulfilled") setProveedores(toList(p.value));
    if (pr.status === "fulfilled") setProductos(toList(pr.value));
  };

  // Al elegir proveedor se cargan sus precios pactados (proveedor-producto)
  const elegirProveedor = async (id) => {
    setNueva((n) => ({ ...n, fk_proveedor: id, lineas: [] }));
    if (!id) return;
    try {
      const lista = toList(await proveedorService.obtenerProductosDeProveedor(id));
      const mapa = new Map(lista.map((x) => [x.fk_producto_proveedor_id_producto ?? x.producto?.id_producto, Number(x.precio_compra)]));
      setPrecios(mapa);
      const primeros = [...mapa.keys()].slice(0, 1).map((idp) => ({ fk_producto: idp, cantidad: 1, precio_unitario: mapa.get(idp) }));
      setNueva((n) => ({ ...n, lineas: primeros }));
    } catch {
      setPrecios(new Map());
    }
  };

  const mapaProductos = useMemo(() => new Map(productos.map((p) => [p.id_producto, p])), [productos]);
  const setLinea = (i, cambios) => setNueva((n) => ({ ...n, lineas: n.lineas.map((l, j) => (j === i ? { ...l, ...cambios } : l)) }));
  const totalNueva = (nueva?.lineas ?? []).reduce((a, l) => {
    const sub = Number(l.cantidad) * Number(l.precio_unitario || 0);
    return a + sub * (1 + Number(mapaProductos.get(Number(l.fk_producto))?.iva || 0) / 100);
  }, 0);

  const crear = async (e) => {
    e.preventDefault();
    setError("");
    if (!nueva.lineas.length) return setError("Agrega al menos un producto.");
    setGuardando(true);
    try {
      const res = await ordenCompraService.crear({
        fk_proveedor: Number(nueva.fk_proveedor),
        fecha_entrega_estimada: nueva.fecha_entrega_estimada || null,
        observacion: nueva.observacion || null,
        detalles: nueva.lineas.map((l) => ({ fk_producto: Number(l.fk_producto), cantidad: Number(l.cantidad), precio_unitario: Number(l.precio_unitario) })),
      });
      setAviso({ tipo: "success", texto: `Orden OC-${res.data.numero_orden} registrada por ${fmtCOP(res.data.total)}.` });
      setNueva(null);
      setDetalle(res.data);
      cargar(true);
    } catch (err) {
      setError(err.mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const abrirRecepcion = async (orden) => {
    setError("");
    setDetalle(null);
    setRecibiendo({
      orden,
      registrar_pago: true,
      fk_metodo_pago: "4",
      lotes: orden.detalles.map((d, i) => ({ fk_producto: d.fk_det_compra_id_producto, nombre: d.producto?.nombre_producto, cantidad: d.cantidad, numero_lote: `${codigoAuto("LOT")}-${i + 1}`, fecha_vencimiento: "" })),
    });
    try {
      setMetodos(toList(await ventaService.metodosPago()));
    } catch {
      setMetodos([]);
    }
  };

  const recibir = async (e) => {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const res = await ordenCompraService.recibir(recibiendo.orden.id_orden_compra, {
        registrar_pago: recibiendo.registrar_pago,
        fk_metodo_pago: Number(recibiendo.fk_metodo_pago),
        detalles: recibiendo.lotes.map(({ fk_producto, numero_lote, fecha_vencimiento }) => ({ fk_producto, numero_lote, fecha_vencimiento })),
      });
      setAviso({ tipo: "success", texto: `OC-${res.data.numero_orden} recibida: se creó la entrada de mercancía con sus lotes${recibiendo.registrar_pago ? " y el egreso del pago" : ""}.` });
      setRecibiendo(null);
      cargar(true);
      avisarCambioDeDatos();
    } catch (err) {
      setError(err.mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const cancelar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await ordenCompraService.cancelar(cancelando.id_orden_compra, motivo.trim());
      setAviso({ tipo: "success", texto: `OC-${cancelando.numero_orden} cancelada.` });
      setCancelando(null);
      cargar(true);
    } catch (err) {
      setError(err.mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const pdf = (o) => ordenCompraService.descargarPDF(o.id_orden_compra, o.numero_orden).catch((err) => setAviso({ tipo: "error", texto: err.mensaje }));

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader title="Órdenes de compra" description="Pedidos a proveedores: se imprimen, se reciben con sus lotes y alimentan inventario y contabilidad.">
        <button onClick={() => cargar()} className="btn btn-outline btn-sm" aria-label="Recargar"><RefreshCw size={15} className={cargando ? "animate-spin" : ""} /></button>
        {puedeGestionar && <button onClick={abrirNueva} className="btn btn-primary"><Plus size={16} /> Nueva orden</button>}
      </PageHeader>
      <Notice aviso={aviso} onClose={() => setAviso(null)} />

      <div className="flex flex-wrap items-center gap-1.5">
        {["", "Pendiente", "Recibida", "Cancelada"].map((e) => (
          <button key={e || "todas"} onClick={() => setEstado(e)} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${estado === e ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
            {e || "Todas"}
          </button>
        ))}
        <span className="mx-2 text-xs text-muted-foreground">·</span>
        {PERIODOS.map((p) => (
          <button key={p.id} onClick={() => setPeriodo(p.id)} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${periodo === p.id ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}>{p.label}</button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">N° orden</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Proveedor</th>
                <th className="px-5 py-3">Entrega estimada</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-center">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cargando ? (
                <tr><td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">Cargando órdenes...</td></tr>
              ) : ordenes.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">No hay órdenes de compra con esos filtros.</td></tr>
              ) : (
                ordenes.map((o) => (
                  <tr key={o.id_orden_compra} className="hover:bg-muted/50">
                    <td className="px-5 py-3 font-mono text-xs font-bold text-primary">OC-{o.numero_orden}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{fmtFecha(o.fecha)}</td>
                    <td className="px-5 py-3 text-xs font-semibold">{o.proveedor?.razon_social ?? "—"}</td>
                    <td className="px-5 py-3 text-xs">{o.fecha_entrega_estimada ? fmtFecha(o.fecha_entrega_estimada) : "—"}</td>
                    <td className="px-5 py-3 text-right text-xs font-bold">{fmtCOP(o.total)}</td>
                    <td className="px-5 py-3 text-center"><Badge variant={VARIANTE[o.estado]}>{o.estado}</Badge></td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setDetalle(o)} className="btn-icon hover:text-primary" aria-label={`Ver OC-${o.numero_orden}`}><Eye size={15} /></button>
                      <button onClick={() => pdf(o)} className="btn-icon hover:text-primary" aria-label={`PDF OC-${o.numero_orden}`}><Download size={15} /></button>
                      {puedeGestionar && o.estado === "Pendiente" && (
                        <>
                          <button onClick={() => abrirRecepcion(o)} className="btn-icon hover:text-primary" title="Recibir" aria-label={`Recibir OC-${o.numero_orden}`}><PackageCheck size={15} /></button>
                          <button onClick={() => { setMotivo(""); setError(""); setCancelando(o); }} className="btn-icon hover:text-destructive" title="Cancelar" aria-label={`Cancelar OC-${o.numero_orden}`}><Ban size={15} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nueva orden */}
      <Modal open={!!nueva} onClose={() => setNueva(null)} title="Nueva orden de compra" subtitle="El precio sugerido es el pactado con el proveedor; puedes ajustarlo." maxWidth="max-w-2xl">
        {nueva && (
          <form onSubmit={crear} className="space-y-3">
            <Notice aviso={error ? { tipo: "error", texto: error } : null} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="oc-prov">Proveedor *</label>
                <select id="oc-prov" required className="input" value={nueva.fk_proveedor} onChange={(e) => elegirProveedor(e.target.value)}>
                  <option value="">Selecciona...</option>
                  {proveedores.map((p) => <option key={p.id_proveedor} value={p.id_proveedor}>{p.razon_social}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="oc-fecha">Entrega estimada</label>
                <input id="oc-fecha" type="date" className="input" value={nueva.fecha_entrega_estimada} onChange={(e) => setNueva({ ...nueva, fecha_entrega_estimada: e.target.value })} />
              </div>
            </div>
            {nueva.fk_proveedor && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Productos</span>
                  <button type="button" className="text-xs font-bold text-primary" onClick={() => setNueva({ ...nueva, lineas: [...nueva.lineas, { fk_producto: productos[0]?.id_producto ?? "", cantidad: 1, precio_unitario: precios.get(productos[0]?.id_producto) ?? productos[0]?.costo_produccion ?? 0 }] })}>
                    <Plus size={13} className="inline" /> Agregar producto
                  </button>
                </div>
                {nueva.lineas.map((l, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/50 p-2">
                    <select aria-label="Producto" className="input min-w-0 flex-1 basis-48 py-1.5 text-xs" value={l.fk_producto} onChange={(e) => {
                      const id = Number(e.target.value);
                      setLinea(i, { fk_producto: id, precio_unitario: precios.get(id) ?? mapaProductos.get(id)?.costo_produccion ?? 0 });
                    }}>
                      {productos.map((p) => <option key={p.id_producto} value={p.id_producto}>{p.codigo_producto} · {p.nombre_producto}{precios.has(p.id_producto) ? " ★" : ""}</option>)}
                    </select>
                    <input aria-label="Cantidad" type="number" min="1" required className="input w-20 py-1.5 text-center text-xs" value={l.cantidad} onChange={(e) => setLinea(i, { cantidad: e.target.value })} />
                    <input aria-label="Precio unitario" type="number" min="0" step="any" required className="input w-28 py-1.5 text-right text-xs" value={l.precio_unitario} onChange={(e) => setLinea(i, { precio_unitario: e.target.value })} />
                    <button type="button" onClick={() => setNueva({ ...nueva, lineas: nueva.lineas.filter((_, j) => j !== i) })} className="btn-icon" aria-label="Quitar"><X size={14} /></button>
                  </div>
                ))}
                <p className="hint">★ producto con precio pactado con este proveedor.</p>
              </div>
            )}
            <div>
              <label className="label" htmlFor="oc-obs">Observación</label>
              <input id="oc-obs" maxLength={255} className="input" value={nueva.observacion} onChange={(e) => setNueva({ ...nueva, observacion: e.target.value })} />
            </div>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm font-extrabold">Total estimado (con IVA): <span className="text-primary">{fmtCOP(totalNueva)}</span></span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setNueva(null)} className="btn btn-outline btn-sm">Cancelar</button>
                <button type="submit" disabled={guardando || !nueva.fk_proveedor} className="btn btn-primary btn-sm">{guardando ? "Guardando..." : "Registrar orden"}</button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Detalle */}
      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={`Orden de compra OC-${detalle?.numero_orden ?? ""}`} subtitle={detalle ? `${detalle.proveedor?.razon_social ?? ""} · ${detalle.estado}` : ""} maxWidth="max-w-2xl">
        {detalle && (
          <div className="space-y-3 text-xs">
            <table className="w-full text-left">
              <thead className="table-head"><tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2 text-center">Cant.</th><th className="px-3 py-2 text-right">Precio</th><th className="px-3 py-2 text-right">IVA</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-border">
                {detalle.detalles?.map((d) => (
                  <tr key={d.id_detallecompra}><td className="px-3 py-2">{d.producto?.nombre_producto}</td><td className="px-3 py-2 text-center">{d.cantidad}</td><td className="px-3 py-2 text-right">{fmtCOP(d.precio_unitario)}</td><td className="px-3 py-2 text-right">{fmtCOP(d.iva)}</td><td className="px-3 py-2 text-right font-bold">{fmtCOP(d.total)}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="text-right text-sm font-extrabold">Total {fmtCOP(detalle.total)}</p>
            {detalle.observacion && <p className="text-muted-foreground">Observación: {detalle.observacion}</p>}
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <button onClick={() => pdf(detalle)} className="btn btn-secondary btn-sm"><Download size={13} /> PDF</button>
              {puedeGestionar && detalle.estado === "Pendiente" && <button onClick={() => abrirRecepcion(detalle)} className="btn btn-primary btn-sm"><PackageCheck size={13} /> Recibir</button>}
              <button onClick={() => setDetalle(null)} className="btn btn-outline btn-sm">Cerrar</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Recibir */}
      <Modal open={!!recibiendo} onClose={() => setRecibiendo(null)} title={`Recibir OC-${recibiendo?.orden?.numero_orden ?? ""}`} subtitle="Cada producto entra como un lote con su vencimiento." maxWidth="max-w-2xl">
        {recibiendo && (
          <form onSubmit={recibir} className="space-y-3">
            <Notice aviso={error ? { tipo: "error", texto: error } : null} />
            {recibiendo.lotes.map((l, i) => (
              <div key={l.fk_producto} className="grid grid-cols-1 items-end gap-2 rounded-xl border border-border p-2.5 sm:grid-cols-3">
                <p className="text-xs font-semibold">{l.nombre}<span className="block text-[10px] font-normal text-muted-foreground">{l.cantidad} unidades</span></p>
                <div><label className="label" htmlFor={`lote-${i}`}>Lote</label><input id={`lote-${i}`} required className="input py-1.5 text-xs" value={l.numero_lote} onChange={(e) => setRecibiendo({ ...recibiendo, lotes: recibiendo.lotes.map((x, j) => (j === i ? { ...x, numero_lote: e.target.value } : x)) })} /></div>
                <div><label className="label" htmlFor={`venc-${i}`}>Vencimiento</label><input id={`venc-${i}`} type="date" required className="input py-1.5 text-xs" value={l.fecha_vencimiento} onChange={(e) => setRecibiendo({ ...recibiendo, lotes: recibiendo.lotes.map((x, j) => (j === i ? { ...x, fecha_vencimiento: e.target.value } : x)) })} /></div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 p-3 text-xs">
              <label className="flex items-center gap-2"><input type="checkbox" checked={recibiendo.registrar_pago} onChange={(e) => setRecibiendo({ ...recibiendo, registrar_pago: e.target.checked })} /> Registrar el pago al proveedor (egreso de {fmtCOP(recibiendo.orden.total)})</label>
              {recibiendo.registrar_pago && (
                <select aria-label="Método de pago" className="input w-44 py-1.5 text-xs capitalize" value={recibiendo.fk_metodo_pago} onChange={(e) => setRecibiendo({ ...recibiendo, fk_metodo_pago: e.target.value })}>
                  {metodos.map((m) => <option key={m.id_metodopago} value={m.id_metodopago}>{m.metodo_pago}</option>)}
                </select>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRecibiendo(null)} className="btn btn-outline btn-sm">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn btn-primary btn-sm">{guardando ? "Recibiendo..." : "Confirmar recepción"}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Cancelar */}
      <Modal open={!!cancelando} onClose={() => setCancelando(null)} title={`Cancelar OC-${cancelando?.numero_orden ?? ""}`} maxWidth="max-w-md">
        <form onSubmit={cancelar} className="space-y-3">
          <Notice aviso={error ? { tipo: "error", texto: error } : null} />
          <label className="label" htmlFor="oc-motivo">Motivo *</label>
          <input id="oc-motivo" required minLength={3} className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCancelando(null)} className="btn btn-outline btn-sm">Volver</button>
            <button type="submit" disabled={guardando} className="btn btn-danger btn-sm">Cancelar orden</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
