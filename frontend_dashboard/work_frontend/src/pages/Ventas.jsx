import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search, RefreshCw, Download, Eye, X, ChevronLeft, ChevronRight, Info } from "lucide-react";
import ventaService from "../service/ventaService";
import productoService from "../service/productoService";
import { useAuth } from "../context/AuthContext";
import { PageHeader } from "../components/ui/PageHeader";
import { Modal } from "../components/ui/Modal";
import { Notice } from "../components/ui/Notice";
import { fmtCOP, fmtFecha, toList, hoyISO } from "../lib/format";

const POR_PAGINA = 10;

const nombreDe = (persona, prefijo) =>
  persona ? `${persona[`nombre_${prefijo}`] ?? ""} ${persona[`apellido_${prefijo}`] ?? ""}`.trim() : "";

export default function Ventas() {
  const { usuario } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [paginacion, setPaginacion] = useState({ total: 0, paginaActual: 1, totalPaginas: 1 });
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [aviso, setAviso] = useState(null);
  const [descargandoId, setDescargandoId] = useState(null);

  // Nueva venta
  const [modalVenta, setModalVenta] = useState(false);
  const [productos, setProductos] = useState([]);
  const [items, setItems] = useState([]);
  const [descuento, setDescuento] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState("");

  // Detalle de factura
  const [detalle, setDetalle] = useState(null); // { venta, detalles }
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargarVentas = useCallback(async () => {
    setCargando(true);
    try {
      const res = await ventaService.listarVentas({ pagina, limite: POR_PAGINA });
      setVentas(toList(res, "ventas"));
      setPaginacion({
        total: res?.data?.total ?? 0,
        paginaActual: res?.data?.paginaActual ?? 1,
        totalPaginas: Math.max(res?.data?.totalPaginas ?? 1, 1),
      });
    } catch (err) {
      setVentas([]);
      setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      setCargando(false);
    }
  }, [pagina]);

  useEffect(() => {
    cargarVentas();
  }, [cargarVentas]);

  // ---- Nueva venta ---------------------------------------------------------------
  const mapaProductos = useMemo(() => new Map(productos.map((p) => [p.id_producto, p])), [productos]);

  const abrirNuevaVenta = async () => {
    setErrorModal("");
    setDescuento("");
    setItems([]);
    setModalVenta(true);
    try {
      const lista = toList(await productoService.obtenerConStock());
      setProductos(lista);
      if (lista.length > 0) setItems([{ id_producto: lista[0].id_producto, cantidad: 1 }]);
    } catch (err) {
      setErrorModal(err.mensaje);
    }
  };

  const usados = new Set(items.map((i) => Number(i.id_producto)));

  const agregarLinea = () => {
    const libre = productos.find((p) => !usados.has(p.id_producto));
    if (libre) setItems([...items, { id_producto: libre.id_producto, cantidad: 1 }]);
  };

  const quitarLinea = (indice) => setItems(items.filter((_, i) => i !== indice));

  const cambiarLinea = (indice, campo, valor) => {
    setItems(
      items.map((item, i) => {
        if (i !== indice) return item;
        if (campo === "id_producto") return { id_producto: Number(valor), cantidad: 1 };
        const max = mapaProductos.get(Number(item.id_producto))?.stock ?? 1;
        return { ...item, cantidad: Math.min(Math.max(1, Number(valor) || 1), max) };
      })
    );
  };

  // El precio y el IVA los toma el backend del producto; aquí se calculan igual para mostrar el total
  const totales = useMemo(() => {
    let subtotal = 0;
    let iva = 0;
    items.forEach((item) => {
      const p = mapaProductos.get(Number(item.id_producto));
      if (!p) return;
      const lineaSubtotal = Number(p.precio_venta) * Number(item.cantidad);
      subtotal += lineaSubtotal;
      iva += lineaSubtotal * (Number(p.iva) / 100);
    });
    const desc = Number(descuento) || 0;
    return { subtotal, iva, descuento: desc, total: subtotal + iva - desc };
  }, [items, mapaProductos, descuento]);

  const registrarVenta = async (e) => {
    e.preventDefault();
    setErrorModal("");

    if (items.length === 0) {
      setErrorModal("Agrega al menos un producto a la venta.");
      return;
    }
    if (totales.descuento > totales.subtotal + totales.iva) {
      setErrorModal("El descuento no puede ser mayor que el total de la venta.");
      return;
    }

    setGuardando(true);
    try {
      const res = await ventaService.crearVenta({
        fecha: hoyISO(),
        fk_venta_id_usuario: usuario?.idusuario,
        descuento: totales.descuento,
        detalles: items.map((i) => ({
          fk_det_venta_id_producto: Number(i.id_producto),
          cantidad: Number(i.cantidad),
        })),
      });
      setModalVenta(false);
      setDetalle(res?.data ?? null); // se muestra la factura recién creada
      setAviso({ tipo: "success", texto: `Venta ${res?.data?.venta?.numero_venta ?? ""} registrada. El stock se descontó por lote (FEFO).` });
      if (pagina === 1) cargarVentas();
      else setPagina(1);
    } catch (err) {
      setErrorModal(err.mensaje || "Error al registrar la venta.");
    } finally {
      setGuardando(false);
    }
  };

  // ---- Detalle / PDF -------------------------------------------------------------
  const verDetalle = async (venta) => {
    setCargandoDetalle(true);
    try {
      const res = await ventaService.obtenerPorId(venta.id_venta);
      setDetalle(res?.data ?? null);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      setCargandoDetalle(false);
    }
  };

  const descargarPDF = async (idVenta, numeroVenta) => {
    setDescargandoId(idVenta);
    try {
      await ventaService.descargarFacturaPDF(idVenta, numeroVenta);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje || "No se pudo generar la factura en PDF." });
    } finally {
      setDescargandoId(null);
    }
  };

  const ventasFiltradas = ventas.filter((v) =>
    (v.numero_venta ?? "").toLowerCase().includes(busqueda.trim().toLowerCase())
  );

  const hintStock = /stock insuficiente/i.test(errorModal);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Ventas y facturación"
        description="Registro de ventas y generación de facturas en PDF."
      >
        <button onClick={cargarVentas} className="btn btn-outline btn-sm" title="Recargar" aria-label="Recargar">
          <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
        </button>
        <button onClick={abrirNuevaVenta} className="btn btn-primary">
          <Plus size={16} />
          Nueva venta
        </button>
      </PageHeader>

      <Notice aviso={aviso} onClose={() => setAviso(null)} />

      <div className="card flex max-w-md items-center gap-2 p-3">
        <Search size={15} className="flex-shrink-0 text-muted-foreground" />
        <input
          type="text"
          placeholder="Filtrar esta página por número de factura..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Filtrar ventas"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">N° factura</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3 text-right">Subtotal</th>
                <th className="px-5 py-3 text-right">IVA</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Factura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cargando ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">Cargando ventas...</td>
                </tr>
              ) : ventasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
                    {ventas.length === 0
                      ? 'No hay ventas registradas aún. Haz clic en "Nueva venta" para emitir la primera factura.'
                      : "Ninguna venta de esta página coincide con el filtro."}
                  </td>
                </tr>
              ) : (
                ventasFiltradas.map((v) => (
                  <tr key={v.id_venta} className="transition-colors hover:bg-muted/50">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-primary">{v.numero_venta}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{fmtFecha(v.fecha)}</td>
                    <td className="px-5 py-3.5 text-xs text-foreground">
                      {v.fk_venta_id_cliente ? `Cliente #${v.fk_venta_id_cliente}` : "Sin cliente"}
                    </td>
                    <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">{fmtCOP(v.subtotal)}</td>
                    <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">{fmtCOP(v.iva)}</td>
                    <td className="px-5 py-3.5 text-right text-xs font-extrabold text-foreground">{fmtCOP(v.total)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => verDetalle(v)} disabled={cargandoDetalle} className="btn btn-soft btn-sm" aria-label={`Ver ${v.numero_venta}`}>
                          <Eye size={13} /> Ver
                        </button>
                        <button
                          onClick={() => descargarPDF(v.id_venta, v.numero_venta)}
                          disabled={descargandoId === v.id_venta}
                          className="btn btn-secondary btn-sm"
                          aria-label={`Descargar PDF de ${v.numero_venta}`}
                        >
                          <Download size={13} className={descargandoId === v.id_venta ? "animate-bounce" : ""} />
                          {descargandoId === v.id_venta ? "Generando..." : "PDF"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación (la hace el backend) */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>
            {paginacion.total} {paginacion.total === 1 ? "venta" : "ventas"} · página {paginacion.paginaActual} de {paginacion.totalPaginas}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1 || cargando}
              className="btn btn-outline btn-sm"
              aria-label="Página anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPagina((p) => Math.min(paginacion.totalPaginas, p + 1))}
              disabled={pagina >= paginacion.totalPaginas || cargando}
              className="btn btn-outline btn-sm"
              aria-label="Página siguiente"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Nueva venta */}
      <Modal
        open={modalVenta}
        onClose={() => setModalVenta(false)}
        title="Registrar nueva venta"
        subtitle="Selecciona los productos y cantidades. El precio y el IVA se toman del catálogo."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={registrarVenta} className="space-y-4">
          <Notice aviso={errorModal ? { tipo: "error", texto: errorModal } : null} />
          {hintStock && (
            <div className="flex items-start gap-2 rounded-xl border border-info-border bg-accent px-3 py-2.5 text-xs text-accent-foreground">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              <p>
                El backend valida el stock por <strong>lotes</strong>. Si el producto tiene unidades pero ningún lote,
                regístralas con una entrada de mercancía (Entradas y salidas) indicando número de lote y vencimiento.
              </p>
            </div>
          )}

          {productos.length === 0 ? (
            <p className="rounded-xl bg-muted px-4 py-6 text-center text-xs text-muted-foreground">
              No hay productos con existencias para vender. Registra una entrada de mercancía primero.
            </p>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Productos de la venta</span>
                <button
                  type="button"
                  onClick={agregarLinea}
                  disabled={items.length >= productos.length}
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={14} /> Agregar línea
                </button>
              </div>

              {items.map((item, idx) => {
                const p = mapaProductos.get(Number(item.id_producto));
                const subtotalLinea = p ? Number(p.precio_venta) * Number(item.cantidad) : 0;
                return (
                  <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/50 p-2.5">
                    <select
                      value={item.id_producto}
                      onChange={(e) => cambiarLinea(idx, "id_producto", e.target.value)}
                      className="input min-w-0 flex-1 basis-56 py-1.5 text-xs"
                      aria-label="Producto"
                    >
                      {productos
                        .filter((prod) => prod.id_producto === Number(item.id_producto) || !usados.has(prod.id_producto))
                        .map((prod) => (
                          <option key={prod.id_producto} value={prod.id_producto}>
                            {prod.codigo_producto} · {prod.nombre_producto} (stock {prod.stock})
                          </option>
                        ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      max={p?.stock ?? 1}
                      value={item.cantidad}
                      onChange={(e) => cambiarLinea(idx, "cantidad", e.target.value)}
                      className="input w-20 py-1.5 text-center text-xs"
                      aria-label="Cantidad"
                      required
                    />
                    <div className="w-28 text-right text-xs">
                      <p className="font-extrabold text-foreground">{fmtCOP(subtotalLinea)}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtCOP(p?.precio_venta)} c/u · IVA {Number(p?.iva) || 0}%</p>
                    </div>
                    {items.length > 1 && (
                      <button type="button" onClick={() => quitarLinea(idx)} className="btn-icon hover:text-destructive" aria-label="Quitar línea">
                        <X size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Totales */}
          <div className="space-y-2 rounded-xl border border-border bg-warning-soft/60 p-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span>{fmtCOP(totales.subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>IVA</span>
              <span>{fmtCOP(totales.iva)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <label htmlFor="v-desc">Descuento ($)</label>
              <input
                id="v-desc"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
                className="input w-32 py-1 text-right text-xs"
              />
            </div>
            <div className="flex justify-between border-t border-warning-border pt-2 text-sm font-extrabold text-foreground">
              <span>Total factura</span>
              <span className="text-primary">{fmtCOP(Math.max(0, totales.total))}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => setModalVenta(false)} className="btn btn-outline btn-sm">
              Cancelar
            </button>
            <button type="submit" disabled={guardando || items.length === 0} className="btn btn-primary btn-sm">
              {guardando ? "Procesando venta..." : "Finalizar y facturar"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detalle de factura */}
      <Modal
        open={!!detalle}
        onClose={() => setDetalle(null)}
        title={`Factura ${detalle?.venta?.numero_venta ?? ""}`}
        subtitle={detalle?.venta ? `Emitida el ${fmtFecha(detalle.venta.fecha)}` : undefined}
        maxWidth="max-w-2xl"
      >
        {detalle?.venta && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-[11px] font-bold uppercase text-muted-foreground">Cliente</p>
                <p className="mt-0.5 font-semibold text-foreground">
                  {nombreDe(detalle.venta.cliente, "cliente") || "Sin cliente registrado"}
                </p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-[11px] font-bold uppercase text-muted-foreground">Atendió</p>
                <p className="mt-0.5 font-semibold text-foreground">
                  {nombreDe(detalle.venta.usuario, "usuario") || "—"}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="table-head">
                  <tr>
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2 text-center">Cant.</th>
                    <th className="px-3 py-2 text-right">Precio</th>
                    <th className="px-3 py-2 text-center">IVA</th>
                    <th className="px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detalle.detalles?.map((d) => (
                    <tr key={d.id_detalleventa}>
                      <td className="px-3 py-2 font-semibold text-foreground">
                        {d.producto?.nombre_producto ?? `Producto #${d.fk_det_venta_id_producto}`}
                      </td>
                      <td className="px-3 py-2 text-center">{d.cantidad}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{fmtCOP(d.precio_venta)}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{Number(d.iva_producto)}%</td>
                      <td className="px-3 py-2 text-right font-bold">{fmtCOP(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto w-full max-w-xs space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmtCOP(detalle.venta.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>IVA</span><span>{fmtCOP(detalle.venta.iva)}</span></div>
              {Number(detalle.venta.descuento) > 0 && (
                <div className="flex justify-between text-muted-foreground"><span>Descuento</span><span>-{fmtCOP(detalle.venta.descuento)}</span></div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-extrabold text-foreground">
                <span>Total</span><span className="text-primary">{fmtCOP(detalle.venta.total)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button onClick={() => setDetalle(null)} className="btn btn-outline btn-sm">Cerrar</button>
              <button
                onClick={() => descargarPDF(detalle.venta.id_venta, detalle.venta.numero_venta)}
                disabled={descargandoId === detalle.venta.id_venta}
                className="btn btn-primary btn-sm"
              >
                <Download size={14} />
                {descargandoId === detalle.venta.id_venta ? "Generando..." : "Descargar PDF"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
