import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Plus, RefreshCw, ChevronDown, ChevronRight, X } from "lucide-react";
import movimientoService from "../service/movimientoService";
import productoService from "../service/productoService";
import proveedorService from "../service/proveedorService";
import { PageHeader } from "../components/ui/PageHeader";
import { Modal } from "../components/ui/Modal";
import { Notice } from "../components/ui/Notice";
import { fmtCOP, fmtFecha, toList, codigoAuto } from "../lib/format";

const MOTIVOS_SALIDA = ["Merma / daño", "Producto vencido", "Ajuste de inventario", "Consumo interno"];

// Cada línea de entrada crea un lote: se sugiere un número de lote que el usuario puede cambiar
const nuevaLineaIngreso = (producto, precio, indice = 0) => ({
  id_producto: producto?.id_producto ?? "",
  cantidad: 1,
  precio_unitario: precio ?? producto?.costo_produccion ?? "",
  precio_editado: false,
  iva: producto?.iva ?? 0,
  numero_lote: `${codigoAuto("LOT")}-${indice + 1}`,
  fecha_produccion: "",
  fecha_vencimiento: "",
});

const Chevron = ({ abierto }) => (abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} />);

export default function Movimientos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabActiva = searchParams.get("tab") === "salidas" ? "salidas" : "ingresos";
  const cambiarTab = (tab) => setSearchParams(tab === "salidas" ? { tab } : {}, { replace: true });

  const [ingresos, setIngresos] = useState([]);
  const [salidas, setSalidas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null);
  const [expandidos, setExpandidos] = useState(new Set());

  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState("");

  // Formulario de entrada
  const [modalIngreso, setModalIngreso] = useState(false);
  const [formIngreso, setFormIngreso] = useState({ codigo: "", id_proveedor: "", factura: "", notas: "", lineas: [] });
  const [preciosProveedor, setPreciosProveedor] = useState(new Map());

  // Formulario de salida
  const [modalSalida, setModalSalida] = useState(false);
  const [formSalida, setFormSalida] = useState({ codigo: "", motivo: MOTIVOS_SALIDA[0], notas: "", lineas: [] });

  const mapaProductos = useMemo(() => new Map(productos.map((p) => [p.id_producto, p])), [productos]);
  const nombreProducto = (id) => mapaProductos.get(id)?.nombre_producto ?? `Producto #${id}`;

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    const [resIng, resSal, resProd, resProv] = await Promise.allSettled([
      movimientoService.listarIngresos(),
      movimientoService.listarSalidas(),
      productoService.obtenerTodos(),
      proveedorService.obtenerTodos(),
    ]);
    setIngresos(resIng.status === "fulfilled" ? toList(resIng.value) : []);
    setSalidas(resSal.status === "fulfilled" ? toList(resSal.value) : []);
    setProductos(resProd.status === "fulfilled" ? toList(resProd.value) : []);
    setProveedores(resProv.status === "fulfilled" ? toList(resProv.value) : []);

    const fallo = [resIng, resSal].find((r) => r.status === "rejected");
    if (fallo) setAviso({ tipo: "error", texto: fallo.reason?.mensaje ?? "No se pudieron cargar los movimientos." });
    setCargando(false);
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const alternarFila = (clave) =>
    setExpandidos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(clave)) siguiente.delete(clave);
      else siguiente.add(clave);
      return siguiente;
    });

  // ============================ ENTRADAS ============================
  const abrirIngreso = () => {
    setErrorModal("");
    setPreciosProveedor(new Map());
    setFormIngreso({
      codigo: codigoAuto("ENT"),
      id_proveedor: "",
      factura: "",
      notas: "",
      lineas: productos.length ? [nuevaLineaIngreso(productos[0])] : [],
    });
    setModalIngreso(true);
  };

  // Al elegir proveedor se traen sus precios pactados para sugerir el costo unitario
  const elegirProveedor = async (idProveedor) => {
    let precios = new Map();
    if (idProveedor) {
      try {
        const lista = toList(await proveedorService.obtenerProductosDeProveedor(idProveedor));
        precios = new Map(lista.map((a) => [a.fk_producto_proveedor_id_producto, a.precio_compra]));
      } catch {
        /* sin precios pactados: se sugiere el costo del producto */
      }
    }
    setPreciosProveedor(precios);
    setFormIngreso((f) => ({
      ...f,
      id_proveedor: idProveedor,
      lineas: f.lineas.map((l) =>
        l.precio_editado
          ? l
          : { ...l, precio_unitario: precios.get(Number(l.id_producto)) ?? mapaProductos.get(Number(l.id_producto))?.costo_produccion ?? "" }
      ),
    }));
  };

  const cambiarLineaIngreso = (indice, patch) =>
    setFormIngreso((f) => ({ ...f, lineas: f.lineas.map((l, i) => (i === indice ? { ...l, ...patch } : l)) }));

  const elegirProductoIngreso = (indice, idProducto) => {
    const p = mapaProductos.get(Number(idProducto));
    cambiarLineaIngreso(indice, {
      id_producto: Number(idProducto),
      precio_unitario: preciosProveedor.get(Number(idProducto)) ?? p?.costo_produccion ?? "",
      precio_editado: false,
      iva: p?.iva ?? 0,
    });
  };

  const agregarLineaIngreso = () =>
    setFormIngreso((f) => {
      const usados = new Set(f.lineas.map((l) => Number(l.id_producto)));
      const libre = productos.find((p) => !usados.has(p.id_producto)) ?? productos[0];
      return {
        ...f,
        lineas: [...f.lineas, nuevaLineaIngreso(libre, preciosProveedor.get(libre?.id_producto), f.lineas.length)],
      };
    });

  const guardarIngreso = async (e) => {
    e.preventDefault();
    setErrorModal("");

    for (const [i, l] of formIngreso.lineas.entries()) {
      if (l.fecha_produccion && l.fecha_vencimiento < l.fecha_produccion) {
        setErrorModal(`Línea ${i + 1}: el vencimiento no puede ser anterior a la fecha de producción.`);
        return;
      }
    }

    // Proveedor y factura no tienen columna propia en el backend: se guardan en la observación
    const proveedor = proveedores.find((p) => String(p.id_proveedor) === String(formIngreso.id_proveedor));
    const observacion = [
      proveedor && `Proveedor: ${proveedor.razon_social}`,
      formIngreso.factura.trim() && `Factura: ${formIngreso.factura.trim()}`,
      formIngreso.notas.trim(),
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 255);

    const payload = {
      codigo_entrada: formIngreso.codigo.trim(),
      detalles: formIngreso.lineas.map((l) => ({
        fk_det_entrada_id_producto: Number(l.id_producto),
        cantidad: Number(l.cantidad),
        precio_unitario: Number(l.precio_unitario),
        iva: Number(l.iva) || 0,
        numero_lote: l.numero_lote.trim(),
        fecha_vencimiento: l.fecha_vencimiento,
        ...(l.fecha_produccion ? { fecha_produccion: l.fecha_produccion } : {}),
      })),
    };
    if (observacion) payload.observacion = observacion;

    setGuardando(true);
    try {
      await movimientoService.registrarIngreso(payload);
      setModalIngreso(false);
      setAviso({ tipo: "success", texto: `Entrada ${payload.codigo_entrada} registrada: el stock y los lotes se actualizaron.` });
      cambiarTab("ingresos");
      cargarDatos();
    } catch (err) {
      setErrorModal(err.mensaje || "Error al registrar la entrada de mercancía.");
    } finally {
      setGuardando(false);
    }
  };

  // ============================ SALIDAS ============================
  const conStock = productos.filter((p) => Number(p.stock) > 0);

  const abrirSalida = () => {
    setErrorModal("");
    setFormSalida({
      codigo: codigoAuto("SAL"),
      motivo: MOTIVOS_SALIDA[0],
      notas: "",
      lineas: conStock.length ? [{ id_producto: conStock[0].id_producto, cantidad: 1 }] : [],
    });
    setModalSalida(true);
  };

  const usadosSalida = new Set(formSalida.lineas.map((l) => Number(l.id_producto)));

  const cambiarLineaSalida = (indice, campo, valor) =>
    setFormSalida((f) => ({
      ...f,
      lineas: f.lineas.map((l, i) => {
        if (i !== indice) return l;
        if (campo === "id_producto") return { id_producto: Number(valor), cantidad: 1 };
        const max = mapaProductos.get(Number(l.id_producto))?.stock ?? 1;
        return { ...l, cantidad: Math.min(Math.max(1, Number(valor) || 1), max) };
      }),
    }));

  const agregarLineaSalida = () => {
    const libre = conStock.find((p) => !usadosSalida.has(p.id_producto));
    if (libre) setFormSalida((f) => ({ ...f, lineas: [...f.lineas, { id_producto: libre.id_producto, cantidad: 1 }] }));
  };

  const guardarSalida = async (e) => {
    e.preventDefault();
    setErrorModal("");

    const observacion = [formSalida.motivo, formSalida.notas.trim()].filter(Boolean).join(" — ").slice(0, 250);
    const payload = {
      codigo_salida: formSalida.codigo.trim(),
      observacion,
      detalles: formSalida.lineas.map((l) => ({
        fk_det_salida_id_producto: Number(l.id_producto),
        cantidad: Number(l.cantidad),
      })),
    };

    setGuardando(true);
    try {
      await movimientoService.registrarSalida(payload);
      setModalSalida(false);
      setAviso({ tipo: "success", texto: `Salida ${payload.codigo_salida} registrada: el stock se descontó.` });
      cambiarTab("salidas");
      cargarDatos();
    } catch (err) {
      setErrorModal(err.mensaje || "Error al registrar la salida de mercancía.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Entradas y salidas de inventario"
        description="Entradas de mercancía (compras con lote y vencimiento) y salidas por merma o ajuste."
      >
        <button onClick={cargarDatos} className="btn btn-outline btn-sm" title="Recargar" aria-label="Recargar">
          <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
        </button>
        <button onClick={abrirIngreso} className="btn btn-primary">
          <ArrowDownLeft size={16} />
          Registrar entrada
        </button>
        <button onClick={abrirSalida} className="btn btn-secondary">
          <ArrowUpRight size={16} />
          Registrar salida
        </button>
      </PageHeader>

      <Notice aviso={aviso} onClose={() => setAviso(null)} />

      {/* Pestañas */}
      <div className="flex items-center gap-1 border-b border-border" role="tablist">
        {[
          { id: "ingresos", label: "Entradas de mercancía", total: ingresos.length, Icono: ArrowDownLeft },
          { id: "salidas", label: "Salidas y bajas", total: salidas.length, Icono: ArrowUpRight },
        ].map(({ id, label, total, Icono }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tabActiva === id}
            onClick={() => cambiarTab(id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 pb-3 text-sm font-bold transition-colors ${
              tabActiva === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icono size={15} />
            {label} ({total})
          </button>
        ))}
      </div>

      {/* Tabla de entradas */}
      {tabActiva === "ingresos" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="w-10 px-3 py-3" />
                  <th className="px-3 py-3">Código</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Observación</th>
                  <th className="px-5 py-3 text-center">Productos</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cargando ? (
                  <tr><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">Cargando entradas...</td></tr>
                ) : ingresos.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">No hay entradas de mercancía registradas todavía.</td></tr>
                ) : (
                  ingresos.map((ing) => {
                    const clave = `ing-${ing.id_entrada}`;
                    const abierto = expandidos.has(clave);
                    return (
                      <Fragment key={clave}>
                        <tr className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => alternarFila(clave)}>
                          <td className="px-3 py-3.5 text-muted-foreground"><Chevron abierto={abierto} /></td>
                          <td className="px-3 py-3.5 font-mono text-xs font-bold text-primary">{ing.codigo_entrada}</td>
                          <td className="px-5 py-3.5 text-xs text-muted-foreground">{fmtFecha(ing.fecha, true)}</td>
                          <td className="max-w-xs truncate px-5 py-3.5 text-xs text-foreground">{ing.observacion || "—"}</td>
                          <td className="px-5 py-3.5 text-center text-xs">{ing.detalles?.length ?? 0}</td>
                          <td className="px-5 py-3.5 text-right text-xs font-extrabold text-primary">{fmtCOP(ing.total)}</td>
                        </tr>
                        {abierto && (
                          <tr className="bg-muted/40">
                            <td />
                            <td colSpan={5} className="px-3 py-3">
                              <table className="w-full text-xs">
                                <thead className="text-[11px] font-bold uppercase text-muted-foreground">
                                  <tr>
                                    <th className="py-1 text-left">Producto</th>
                                    <th className="py-1 text-center">Cant.</th>
                                    <th className="py-1 text-right">Costo unit.</th>
                                    <th className="py-1 text-right">IVA</th>
                                    <th className="py-1 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {ing.detalles?.map((d) => (
                                    <tr key={d.id_det_entrada}>
                                      <td className="py-1.5 font-semibold text-foreground">{nombreProducto(d.fk_det_entrada_id_producto)}</td>
                                      <td className="py-1.5 text-center">{d.cantidad}</td>
                                      <td className="py-1.5 text-right text-muted-foreground">{fmtCOP(d.precio_unitario)}</td>
                                      <td className="py-1.5 text-right text-muted-foreground">{fmtCOP(d.iva)}</td>
                                      <td className="py-1.5 text-right font-bold">{fmtCOP(d.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla de salidas */}
      {tabActiva === "salidas" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="w-10 px-3 py-3" />
                  <th className="px-3 py-3">Código</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Motivo</th>
                  <th className="px-5 py-3 text-center">Productos</th>
                  <th className="px-5 py-3 text-right">Costo total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cargando ? (
                  <tr><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">Cargando salidas...</td></tr>
                ) : salidas.length === 0 ? (
                  <tr><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">No hay salidas de mercancía registradas todavía.</td></tr>
                ) : (
                  salidas.map((sal) => {
                    const clave = `sal-${sal.id_salida}`;
                    const abierto = expandidos.has(clave);
                    return (
                      <Fragment key={clave}>
                        <tr className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => alternarFila(clave)}>
                          <td className="px-3 py-3.5 text-muted-foreground"><Chevron abierto={abierto} /></td>
                          <td className="px-3 py-3.5 font-mono text-xs font-bold text-accent-foreground">{sal.codigo_salida}</td>
                          <td className="px-5 py-3.5 text-xs text-muted-foreground">{fmtFecha(sal.fecha, true)}</td>
                          <td className="max-w-xs truncate px-5 py-3.5 text-xs text-foreground">{sal.observacion || "—"}</td>
                          <td className="px-5 py-3.5 text-center text-xs">{sal.detalles?.length ?? 0}</td>
                          <td className="px-5 py-3.5 text-right text-xs font-extrabold text-foreground">{fmtCOP(sal.total)}</td>
                        </tr>
                        {abierto && (
                          <tr className="bg-muted/40">
                            <td />
                            <td colSpan={5} className="px-3 py-3">
                              <table className="w-full text-xs">
                                <thead className="text-[11px] font-bold uppercase text-muted-foreground">
                                  <tr>
                                    <th className="py-1 text-left">Producto</th>
                                    <th className="py-1 text-center">Cant.</th>
                                    <th className="py-1 text-right">Costo unit.</th>
                                    <th className="py-1 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  {sal.detalles?.map((d) => (
                                    <tr key={d.id_det_salida}>
                                      <td className="py-1.5 font-semibold text-foreground">{nombreProducto(d.fk_det_salida_id_producto)}</td>
                                      <td className="py-1.5 text-center">{d.cantidad}</td>
                                      <td className="py-1.5 text-right text-muted-foreground">{fmtCOP(d.precio_unitario)}</td>
                                      <td className="py-1.5 text-right font-bold">{fmtCOP(d.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Modal: registrar entrada ---------- */}
      <Modal
        open={modalIngreso}
        onClose={() => setModalIngreso(false)}
        title="Registrar entrada de mercancía"
        subtitle="Aumenta el stock y crea un lote por cada producto, con su vencimiento."
        maxWidth="max-w-3xl"
      >
        <form onSubmit={guardarIngreso} className="space-y-4">
          <Notice aviso={errorModal ? { tipo: "error", texto: errorModal } : null} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="i-cod">Código de entrada *</label>
              <input id="i-cod" required className="input font-mono text-xs" value={formIngreso.codigo} onChange={(e) => setFormIngreso({ ...formIngreso, codigo: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="i-prov">Proveedor (opcional)</label>
              <select id="i-prov" className="input" value={formIngreso.id_proveedor} onChange={(e) => elegirProveedor(e.target.value)}>
                <option value="">— Sin proveedor —</option>
                {proveedores.map((p) => (
                  <option key={p.id_proveedor} value={p.id_proveedor}>{p.razon_social}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="i-fac">N° factura proveedor</label>
              <input id="i-fac" placeholder="FAC-2026-001" className="input" value={formIngreso.factura} onChange={(e) => setFormIngreso({ ...formIngreso, factura: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="i-notas">Notas</label>
            <input id="i-notas" placeholder="Opcional" className="input" value={formIngreso.notas} onChange={(e) => setFormIngreso({ ...formIngreso, notas: e.target.value })} />
          </div>

          {productos.length === 0 ? (
            <p className="rounded-xl bg-muted px-4 py-6 text-center text-xs text-muted-foreground">
              Primero registra productos en el catálogo para poder ingresar mercancía.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Productos ingresados</span>
                <button type="button" onClick={agregarLineaIngreso} className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover">
                  <Plus size={14} /> Agregar producto
                </button>
              </div>

              {formIngreso.lineas.map((l, idx) => (
                <div key={idx} className="space-y-2.5 rounded-xl border border-border bg-muted/50 p-3">
                  <div className="flex items-center gap-2">
                    <select value={l.id_producto} onChange={(e) => elegirProductoIngreso(idx, e.target.value)} className="input flex-1 py-1.5 text-xs" aria-label="Producto" required>
                      {productos.map((p) => (
                        <option key={p.id_producto} value={p.id_producto}>
                          {p.codigo_producto} · {p.nombre_producto} (stock {p.stock})
                        </option>
                      ))}
                    </select>
                    {formIngreso.lineas.length > 1 && (
                      <button type="button" onClick={() => setFormIngreso((f) => ({ ...f, lineas: f.lineas.filter((_, i) => i !== idx) }))} className="btn-icon hover:text-destructive" aria-label="Quitar producto">
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <div>
                      <label className="label">Cantidad *</label>
                      <input type="number" required min="1" step="1" className="input py-1.5 text-xs" value={l.cantidad} onChange={(e) => cambiarLineaIngreso(idx, { cantidad: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Costo unit. ($) *</label>
                      <input type="number" required min="0" step="any" className="input py-1.5 text-xs" value={l.precio_unitario} onChange={(e) => cambiarLineaIngreso(idx, { precio_unitario: e.target.value, precio_editado: true })} />
                    </div>
                    <div>
                      <label className="label">IVA (%)</label>
                      <input type="number" min="0" step="any" className="input py-1.5 text-xs" value={l.iva} onChange={(e) => cambiarLineaIngreso(idx, { iva: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">N° lote *</label>
                      <input
                        required
                        placeholder="LOT-001"
                        className="input py-1.5 text-xs"
                        value={l.numero_lote}
                        onChange={(e) => cambiarLineaIngreso(idx, { numero_lote: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="label">Fecha de producción</label>
                      <input type="date" className="input py-1.5 text-xs" value={l.fecha_produccion} onChange={(e) => cambiarLineaIngreso(idx, { fecha_produccion: e.target.value })} />
                    </div>
                    <div>
                      <label className="label">Fecha de vencimiento *</label>
                      <input type="date" required min={l.fecha_produccion || undefined} className="input py-1.5 text-xs" value={l.fecha_vencimiento} onChange={(e) => cambiarLineaIngreso(idx, { fecha_vencimiento: e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => setModalIngreso(false)} className="btn btn-outline btn-sm">Cancelar</button>
            <button type="submit" disabled={guardando || formIngreso.lineas.length === 0} className="btn btn-primary btn-sm">
              {guardando ? "Procesando..." : "Confirmar entrada"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ---------- Modal: registrar salida ---------- */}
      <Modal
        open={modalSalida}
        onClose={() => setModalSalida(false)}
        title="Registrar salida / merma"
        subtitle="Disminuye las existencias por merma, vencimiento o ajuste."
        maxWidth="max-w-xl"
      >
        <form onSubmit={guardarSalida} className="space-y-4">
          <Notice aviso={errorModal ? { tipo: "error", texto: errorModal } : null} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="s-cod">Código de salida *</label>
              <input id="s-cod" required className="input font-mono text-xs" value={formSalida.codigo} onChange={(e) => setFormSalida({ ...formSalida, codigo: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="s-mot">Motivo *</label>
              <select id="s-mot" className="input" value={formSalida.motivo} onChange={(e) => setFormSalida({ ...formSalida, motivo: e.target.value })}>
                {MOTIVOS_SALIDA.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="s-notas">Notas</label>
            <input id="s-notas" placeholder="Detalle o justificación (opcional)" className="input" value={formSalida.notas} onChange={(e) => setFormSalida({ ...formSalida, notas: e.target.value })} />
          </div>

          {conStock.length === 0 ? (
            <p className="rounded-xl bg-muted px-4 py-6 text-center text-xs text-muted-foreground">
              No hay productos con existencias para dar de baja.
            </p>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Productos retirados</span>
                <button type="button" onClick={agregarLineaSalida} disabled={formSalida.lineas.length >= conStock.length} className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-40">
                  <Plus size={14} /> Agregar producto
                </button>
              </div>
              {formSalida.lineas.map((l, idx) => {
                const p = mapaProductos.get(Number(l.id_producto));
                return (
                  <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/50 p-2.5">
                    <select value={l.id_producto} onChange={(e) => cambiarLineaSalida(idx, "id_producto", e.target.value)} className="input min-w-0 flex-1 basis-56 py-1.5 text-xs" aria-label="Producto">
                      {conStock
                        .filter((prod) => prod.id_producto === Number(l.id_producto) || !usadosSalida.has(prod.id_producto))
                        .map((prod) => (
                          <option key={prod.id_producto} value={prod.id_producto}>
                            {prod.codigo_producto} · {prod.nombre_producto} (stock {prod.stock})
                          </option>
                        ))}
                    </select>
                    <input type="number" required min="1" max={p?.stock ?? 1} value={l.cantidad} onChange={(e) => cambiarLineaSalida(idx, "cantidad", e.target.value)} className="input w-24 py-1.5 text-center text-xs" aria-label="Cantidad" />
                    {formSalida.lineas.length > 1 && (
                      <button type="button" onClick={() => setFormSalida((f) => ({ ...f, lineas: f.lineas.filter((_, i) => i !== idx) }))} className="btn-icon hover:text-destructive" aria-label="Quitar producto">
                        <X size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => setModalSalida(false)} className="btn btn-outline btn-sm">Cancelar</button>
            <button type="submit" disabled={guardando || formSalida.lineas.length === 0} className="btn btn-primary btn-sm">
              {guardando ? "Procesando..." : "Confirmar salida"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
