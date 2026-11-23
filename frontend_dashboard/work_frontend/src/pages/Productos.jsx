import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, RefreshCw, Trash2, Pencil, Info, Truck, Archive } from "lucide-react";
import productoService from "../service/productoService";
import proveedorService from "../service/proveedorService";
import { ProveedoresDeProductoModal } from "../components/ProveedoresDeProductoModal";
import { useAuth } from "../context/AuthContext";
import { useAutoRefresh, avisarCambioDeDatos } from "../hooks/useAutoRefresh";
import { PageHeader } from "../components/ui/PageHeader";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Notice } from "../components/ui/Notice";
import { Badge, EstadoBadge } from "../components/ui/Badge";
import {
  fmtCOP, fmtFecha, toList, estadoStock, diasParaVencer,
  UMBRAL_STOCK_BAJO, DIAS_POR_VENCER,
} from "../lib/format";

// El backend no expone un endpoint de categorías. Estas son las que siembra
// src/scrips/seedUsuario.js; además se agregan las que lleguen dentro de los productos.
const CATEGORIAS_BASE = [
  { id: 1, nombre: "Lácteos y Derivados" },
  { id: 2, nombre: "Cárnicos" },
  { id: 3, nombre: "Abarrotes" },
  { id: 4, nombre: "Bebidas" },
];

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "con-stock", label: "Con stock" },
  { id: "stock-bajo", label: "Stock bajo" },
  { id: "sin-stock", label: "Agotados" },
  { id: "por-vencer", label: "Por vencer" },
];

const FORM_VACIO = {
  codigo_producto: "",
  nombre_producto: "",
  fk_producto_id_categoria: 1,
  costo_produccion: "",
  precio_venta: "",
  iva: 19,
};

export default function Productos() {
  const [searchParams] = useSearchParams();
  const { puede } = useAuth();
  const puedeRetirar = puede("retirarProducto");
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState(searchParams.get("q") ?? "");
  const [aviso, setAviso] = useState(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState("");

  // Proveedores vinculados (tabla proveedor-producto)
  const [relaciones, setRelaciones] = useState([]);
  const [productoProveedores, setProductoProveedores] = useState(null);

  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [confirmarRetiroMasivo, setConfirmarRetiroMasivo] = useState(false);

  // El buscador de la barra superior navega aquí con ?q=texto
  const q = searchParams.get("q");
  useEffect(() => {
    if (q !== null) setBusqueda(q);
  }, [q]);

  // silencioso = true en la actualización automática: no muestra "Cargando..." ni vacía la tabla
  const cargarProductos = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      let res;
      if (filtro === "con-stock") res = await productoService.obtenerConStock();
      else if (filtro === "sin-stock") res = await productoService.obtenerSinStock();
      else if (filtro === "stock-bajo") res = await productoService.obtenerStockBajo(UMBRAL_STOCK_BAJO);
      else if (filtro === "por-vencer") res = await productoService.obtenerProximosAVencer(DIAS_POR_VENCER);
      else res = await productoService.obtenerTodos();

      let lista = toList(res);
      // El backend incluye el stock 0 dentro de "stock bajo"; aquí los agotados tienen su propio filtro
      if (filtro === "stock-bajo") lista = lista.filter((p) => Number(p.stock) > 0);
      setProductos(lista);
    } catch (err) {
      if (!silencioso) {
        setProductos([]);
        setAviso({ tipo: "error", texto: err.mensaje });
      }
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, [filtro]);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);
  // Las existencias cambian con ventas, entradas y salidas hechas por otros usuarios
  useAutoRefresh(cargarProductos);

  // Si esto falla, el catálogo sigue funcionando y la columna de proveedores muestra "—"
  const cargarRelaciones = useCallback(async () => {
    try {
      setRelaciones(toList(await proveedorService.listarRelaciones()));
    } catch {
      setRelaciones([]);
    }
  }, []);

  useEffect(() => {
    cargarRelaciones();
  }, [cargarRelaciones]);

  const proveedoresPorProducto = useMemo(() => {
    const mapa = new Map();
    relaciones.forEach((r) => {
      const lista = mapa.get(r.fk_producto_proveedor_id_producto) ?? [];
      lista.push(r);
      mapa.set(r.fk_producto_proveedor_id_producto, lista);
    });
    return mapa;
  }, [relaciones]);

  const categorias = useMemo(() => {
    const mapa = new Map(CATEGORIAS_BASE.map((c) => [c.id, c.nombre]));
    productos.forEach((p) => {
      if (p.categoria?.id_categoria) mapa.set(p.categoria.id_categoria, p.categoria.nombre_categoria);
    });
    return [...mapa].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.id - b.id);
  }, [productos]);

  const abrirModalNuevo = () => {
    setProductoEditando(null);
    setErrorModal("");
    setForm(FORM_VACIO);
    setModalAbierto(true);
  };

  const abrirModalEditar = (prod) => {
    setProductoEditando(prod);
    setErrorModal("");
    setForm({
      codigo_producto: String(prod.codigo_producto ?? ""),
      nombre_producto: prod.nombre_producto ?? "",
      fk_producto_id_categoria: prod.fk_producto_id_categoria ?? 1,
      costo_produccion: prod.costo_produccion ?? "",
      precio_venta: prod.precio_venta ?? "",
      iva: prod.iva ?? 0,
    });
    setModalAbierto(true);
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    setErrorModal("");

    // El backend compara el código como texto (columna VARCHAR): por eso se envía como string.
    // Las fechas de producción y vencimiento ya no se escriben aquí: vienen del lote registrado
    // en la entrada de mercancía, y el vencimiento se quita cuando el producto se agota.
    const payload = {
      codigo_producto: form.codigo_producto.trim(),
      nombre_producto: form.nombre_producto.trim(),
      fk_producto_id_categoria: Number(form.fk_producto_id_categoria),
      costo_produccion: Number(form.costo_produccion),
      precio_venta: Number(form.precio_venta),
      iva: Number(form.iva) || 0,
    };

    setGuardando(true);
    try {
      if (productoEditando) {
        await productoService.actualizar(productoEditando.id_producto, payload);
        setAviso({ tipo: "success", texto: `Producto "${payload.nombre_producto}" actualizado.` });
      } else {
        await productoService.crear(payload);
        setAviso({
          tipo: "success",
          texto: `Producto "${payload.nombre_producto}" registrado. Para cargar existencias registra una entrada de mercancía.`,
        });
      }
      setModalAbierto(false);
      cargarProductos();
    } catch (err) {
      setErrorModal(err.mensaje || "Error al guardar el producto.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    setEliminando(true);
    try {
      await productoService.eliminar(porEliminar.id_producto);
      setAviso({
        tipo: "success",
        texto: `Producto "${porEliminar.nombre_producto}" ${Number(porEliminar.stock) <= 0 ? "retirado del catálogo" : "eliminado"}. Su historial de ventas se conserva.`,
      });
      setPorEliminar(null);
      cargarProductos();
      avisarCambioDeDatos();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje || "No se pudo eliminar el producto." });
      setPorEliminar(null);
    } finally {
      setEliminando(false);
    }
  };

  const retirarAgotados = async () => {
    setEliminando(true);
    try {
      const res = await productoService.retirarAgotados();
      setAviso({ tipo: "success", texto: res?.message ?? "Productos agotados retirados." });
      cargarProductos();
      avisarCambioDeDatos();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje || "No se pudieron retirar los productos agotados." });
    } finally {
      setEliminando(false);
      setConfirmarRetiroMasivo(false);
    }
  };

  const cantidadAgotados = productos.filter((p) => Number(p.stock) <= 0).length;

  const productosFiltrados = productos.filter((p) => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return true;
    return (
      p.nombre_producto?.toLowerCase().includes(term) ||
      String(p.codigo_producto ?? "").toLowerCase().includes(term) ||
      p.categoria?.nombre_categoria?.toLowerCase().includes(term)
    );
  });

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Gestión de productos"
        description="Catálogo de referencias, precios, IVA y vencimientos (los agotados no muestran fecha)."
      >
        <button onClick={() => cargarProductos()} className="btn btn-outline btn-sm" title="Recargar" aria-label="Recargar">
          <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
        </button>
        {puedeRetirar && filtro === "sin-stock" && cantidadAgotados > 0 && (
          <button onClick={() => setConfirmarRetiroMasivo(true)} className="btn btn-outline">
            <Archive size={16} />
            Retirar agotados ({cantidadAgotados})
          </button>
        )}
        <button onClick={abrirModalNuevo} className="btn btn-primary">
          <Plus size={16} />
          Nuevo producto
        </button>
      </PageHeader>

      <Notice aviso={aviso} onClose={() => setAviso(null)} />

      {/* Búsqueda y filtros */}
      <div className="card flex flex-col items-stretch justify-between gap-3 p-3 md:flex-row md:items-center">
        <div className="flex w-full items-center gap-2 rounded-xl bg-muted px-3 py-2 md:w-80">
          <Search size={15} className="flex-shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por código, nombre o categoría..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar productos"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {FILTROS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFiltro(tab.id)}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                filtro === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Producto</th>
                <th className="px-5 py-3 text-right">Costo</th>
                <th className="px-5 py-3 text-right">Precio venta</th>
                <th className="px-5 py-3 text-center">IVA</th>
                <th className="px-5 py-3 text-center">Stock</th>
                <th className="px-5 py-3 text-center">Estado</th>
                <th className="px-5 py-3">Vencimiento</th>
                <th className="px-5 py-3">Proveedores</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cargando ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-xs text-muted-foreground">
                    Cargando catálogo de productos...
                  </td>
                </tr>
              ) : productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-xs text-muted-foreground">
                    No se encontraron productos con los criterios seleccionados.
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((p) => {
                  const dias = diasParaVencer(p.fecha_vencimiento);
                  return (
                    <tr key={p.id_producto} className="transition-colors hover:bg-muted/50">
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-primary">{p.codigo_producto}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground">{p.nombre_producto}</p>
                        {p.categoria?.nombre_categoria && (
                          <p className="text-[11px] text-muted-foreground">{p.categoria.nombre_categoria}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-muted-foreground">{fmtCOP(p.costo_produccion)}</td>
                      <td className="px-5 py-3.5 text-right text-xs font-bold text-foreground">{fmtCOP(p.precio_venta)}</td>
                      <td className="px-5 py-3.5 text-center text-xs text-muted-foreground">{Number(p.iva) || 0}%</td>
                      <td className="px-5 py-3.5 text-center text-xs font-extrabold">{p.stock}</td>
                      <td className="px-5 py-3.5 text-center">
                        <EstadoBadge estado={estadoStock(p)} />
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {Number(p.stock) <= 0 ? (
                          <span className="text-[11px] text-muted-foreground" title="Al agotarse, el producto deja de tener fecha de vencimiento">
                            Sin existencias
                          </span>
                        ) : p.fecha_vencimiento ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-muted-foreground">{fmtFecha(p.fecha_vencimiento)}</span>
                            {dias !== null && dias < 0 && <Badge variant="danger">Vencido</Badge>}
                            {dias !== null && dias >= 0 && dias <= DIAS_POR_VENCER && (
                              <Badge variant="warning">En {dias} d</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {(() => {
                          const provs = proveedoresPorProducto.get(p.id_producto) ?? [];
                          if (provs.length === 0) {
                            return (
                              <button onClick={() => setProductoProveedores(p)} className="text-[11px] font-semibold text-muted-foreground hover:text-primary">
                                Sin proveedor · vincular
                              </button>
                            );
                          }
                          return (
                            <button onClick={() => setProductoProveedores(p)} className="flex max-w-[180px] flex-wrap gap-1 text-left" title="Ver proveedores">
                              {provs.slice(0, 2).map((r) => (
                                <span key={r.id_proveedor_producto} className="truncate rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                                  {r.proveedor?.razon_social ?? "Inactivo"}
                                </span>
                              ))}
                              {provs.length > 2 && (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">+{provs.length - 2}</span>
                              )}
                            </button>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setProductoProveedores(p)} className="btn-icon hover:text-primary" title="Proveedores" aria-label={`Proveedores de ${p.nombre_producto}`}>
                            <Truck size={15} />
                          </button>
                          <button onClick={() => abrirModalEditar(p)} className="btn-icon hover:text-primary" title="Editar" aria-label={`Editar ${p.nombre_producto}`}>
                            <Pencil size={15} />
                          </button>
                          {Number(p.stock) <= 0 && puedeRetirar ? (
                            <button onClick={() => setPorEliminar(p)} className="btn-icon hover:text-destructive" title="Retirar del catálogo" aria-label={`Retirar ${p.nombre_producto}`}>
                              <Archive size={15} />
                            </button>
                          ) : (
                            <button onClick={() => setPorEliminar(p)} className="btn-icon hover:text-destructive" title="Eliminar" aria-label={`Eliminar ${p.nombre_producto}`}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Crear / editar */}
      <Modal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={productoEditando ? "Editar producto" : "Registrar nuevo producto"}
        subtitle="Completa los datos de la referencia para guardarla en el catálogo."
      >
        <form onSubmit={guardarProducto} className="space-y-3.5">
          <Notice aviso={errorModal ? { tipo: "error", texto: errorModal } : null} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="p-codigo">Código *</label>
              <input id="p-codigo" required maxLength={50} className="input" value={form.codigo_producto} onChange={set("codigo_producto")} />
            </div>
            <div>
              <label className="label" htmlFor="p-cat">Categoría *</label>
              <select id="p-cat" className="input" value={form.fk_producto_id_categoria} onChange={set("fk_producto_id_categoria")}>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="p-nombre">Nombre del producto *</label>
            <input id="p-nombre" required maxLength={150} placeholder="Ej. Queso campesino 500 g" className="input" value={form.nombre_producto} onChange={set("nombre_producto")} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="p-costo">Costo ($) *</label>
              <input id="p-costo" type="number" required min="0" step="any" className="input" value={form.costo_produccion} onChange={set("costo_produccion")} />
            </div>
            <div>
              <label className="label" htmlFor="p-precio">Precio venta ($) *</label>
              <input id="p-precio" type="number" required min="0" step="any" className="input" value={form.precio_venta} onChange={set("precio_venta")} />
            </div>
            <div>
              <label className="label" htmlFor="p-iva">IVA (%)</label>
              <input id="p-iva" type="number" min="0" max="100" step="any" className="input" value={form.iva} onChange={set("iva")} />
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-info-border bg-accent px-3 py-2.5 text-xs text-accent-foreground">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <p>
              {productoEditando
                ? `Existencias actuales: ${productoEditando.stock} unidades. El stock se modifica con entradas y salidas de mercancía, no desde aquí.`
                : "El producto se crea con 0 unidades. Las existencias se cargan con una entrada de mercancía (con su lote y vencimiento)."}
              {" "}La fecha de vencimiento mostrada es la del lote más próximo a vencer y se quita cuando el producto se agota.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => setModalAbierto(false)} className="btn btn-outline btn-sm">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn btn-primary btn-sm">
              {guardando ? "Guardando..." : "Guardar producto"}
            </button>
          </div>
        </form>
      </Modal>

      <ProveedoresDeProductoModal
        producto={productoProveedores}
        onClose={() => setProductoProveedores(null)}
        onCambio={cargarRelaciones}
      />

      <ConfirmDialog
        open={!!porEliminar}
        titulo={Number(porEliminar?.stock) <= 0 ? "Retirar producto agotado" : "Eliminar producto"}
        mensaje={`¿Seguro que deseas ${Number(porEliminar?.stock) <= 0 ? "retirar" : "eliminar"} "${porEliminar?.nombre_producto}"? Dejará de aparecer en el catálogo, pero su historial de ventas y movimientos se conserva.`}
        textoConfirmar={Number(porEliminar?.stock) <= 0 ? "Retirar" : "Eliminar"}
        cargando={eliminando}
        onConfirm={confirmarEliminar}
        onCancel={() => setPorEliminar(null)}
      />

      <ConfirmDialog
        open={confirmarRetiroMasivo}
        titulo="Retirar productos agotados"
        mensaje={`Se retirarán del catálogo ${cantidadAgotados} producto(s) sin existencias. Su historial de ventas y movimientos se conserva.`}
        textoConfirmar="Retirar todos"
        cargando={eliminando}
        onConfirm={retirarAgotados}
        onCancel={() => setConfirmarRetiroMasivo(false)}
      />
    </div>
  );
}
