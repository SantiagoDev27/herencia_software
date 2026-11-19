import { useState, useEffect, useCallback } from "react";
import {
  Truck, Plus, Search, RefreshCw, Trash2, Pencil, Phone, MapPin, Package, Link2, Check, X,
} from "lucide-react";
import proveedorService from "../service/proveedorService";
import productoService from "../service/productoService";
import { PageHeader } from "../components/ui/PageHeader";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Notice } from "../components/ui/Notice";
import { fmtCOP, toList } from "../lib/format";

const FORM_VACIO = { nit: "", razon_social: "", telefono_proveedor: "", direccion: "", ciudad: "Cali" };

// ---- Validación de datos del proveedor (mismas reglas que el backend) ----
const LETRAS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";

// Dígito de verificación del NIT según el algoritmo de la DIAN
const calcularDV = (numero) => {
  const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const suma = String(numero).split("").reverse().reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
  const residuo = suma % 11;
  return residuo > 1 ? 11 - residuo : residuo;
};

const limpiarNit = (nit) => nit.replace(/[.\s]/g, "");

const VALIDADORES = {
  nit: (v) => {
    const nit = limpiarNit(v);
    if (!nit) return "El NIT es obligatorio.";
    if (!/^\d{6,10}(-\d)?$/.test(nit)) return "Entre 6 y 10 dígitos; el dígito de verificación va con guion (ej. 900123456-8).";
    const [numero, dv] = nit.split("-");
    if (dv !== undefined && Number(dv) !== calcularDV(numero)) {
      return `El dígito de verificación no corresponde: para ${numero} debería ser ${calcularDV(numero)}.`;
    }
    return "";
  },
  razon_social: (v) => {
    const t = v.trim();
    if (!t) return "La razón social es obligatoria.";
    if (t.length < 3 || t.length > 100) return "Debe tener entre 3 y 100 caracteres.";
    if (!new RegExp(`[${LETRAS}]`).test(t)) return "Debe contener letras.";
    if (!new RegExp(`^[${LETRAS}0-9\\s.,&'()\\-]+$`).test(t)) return "Tiene caracteres no permitidos.";
    return "";
  },
  telefono_proveedor: (v) => {
    const t = v.trim();
    if (!t) return "El teléfono es obligatorio.";
    if (!/^\+?[0-9\s\-()]+$/.test(t)) return "Solo números, espacios, +, - y paréntesis.";
    const digitos = t.replace(/\D/g, "").replace(/^57(?=\d{10}$)/, "");
    const valido = /^3\d{9}$/.test(digitos) || /^60\d{8}$/.test(digitos) || /^\d{7}$/.test(digitos);
    return valido ? "" : "Celular de 10 dígitos (empieza por 3) o fijo de 7 dígitos o de 10 (empieza por 60).";
  },
  direccion: (v) => {
    const t = v.trim();
    if (!t) return "La dirección es obligatoria.";
    if (t.length < 5 || t.length > 45) return "Debe tener entre 5 y 45 caracteres.";
    if (!new RegExp(`^[${LETRAS}0-9\\s#\\-.,°º/]+$`).test(t)) return "Tiene caracteres no permitidos.";
    return "";
  },
  ciudad: (v) => {
    const t = v.trim();
    if (!t) return "";
    if (t.length < 3 || t.length > 45) return "Debe tener entre 3 y 45 caracteres.";
    if (!new RegExp(`^[${LETRAS}\\s.\\-]+$`).test(t)) return "Solo letras y espacios.";
    return "";
  },
};

const validarProveedor = (form) =>
  Object.fromEntries(
    Object.entries(VALIDADORES)
      .map(([campo, validar]) => [campo, validar(form[campo] ?? "")])
      .filter(([, msg]) => msg)
  );

const ErrorCampo = ({ mensaje }) => (mensaje ? <p className="mt-1 text-[11px] font-semibold text-destructive">{mensaje}</p> : null);

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [aviso, setAviso] = useState(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [proveedorEditando, setProveedorEditando] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState("");
  const [erroresCampos, setErroresCampos] = useState({});

  const [porEliminar, setPorEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  // Catálogo (productos que ofrece el proveedor y a qué precio)
  const [proveedorCatalogo, setProveedorCatalogo] = useState(null);
  const [asociaciones, setAsociaciones] = useState([]);
  const [todosProductos, setTodosProductos] = useState([]);
  const [formAsociacion, setFormAsociacion] = useState({ id_producto: "", precio_compra: "" });
  const [errorCatalogo, setErrorCatalogo] = useState("");
  const [editandoPrecio, setEditandoPrecio] = useState(null); // { id, valor }
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [conteoProductos, setConteoProductos] = useState(new Map()); // id_proveedor -> productos vinculados

  // Cuántos productos surte cada proveedor (para mostrarlo en su tarjeta)
  const cargarConteo = useCallback(async () => {
    try {
      const mapa = new Map();
      toList(await proveedorService.listarRelaciones()).forEach((r) => {
        mapa.set(r.fk_producto_proveedor_id_proveedor, (mapa.get(r.fk_producto_proveedor_id_proveedor) ?? 0) + 1);
      });
      setConteoProductos(mapa);
    } catch {
      setConteoProductos(new Map());
    }
  }, []);

  const cargarProveedores = useCallback(async () => {
    setCargando(true);
    try {
      setProveedores(toList(await proveedorService.obtenerTodos()));
    } catch (err) {
      setProveedores([]);
      setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarProveedores();
    cargarConteo();
  }, [cargarProveedores, cargarConteo]);

  const abrirModalNuevo = () => {
    setProveedorEditando(null);
    setErrorModal("");
    setErroresCampos({});
    setForm(FORM_VACIO);
    setModalAbierto(true);
  };

  const abrirModalEditar = (prov) => {
    setProveedorEditando(prov);
    setErrorModal("");
    setErroresCampos({});
    setForm({
      nit: String(prov.nit ?? ""),
      razon_social: prov.razon_social ?? "",
      telefono_proveedor: prov.telefono_proveedor ?? "",
      direccion: prov.direccion ?? "",
      ciudad: prov.ciudad ?? "",
    });
    setModalAbierto(true);
  };

  const guardarProveedor = async (e) => {
    e.preventDefault();
    setErrorModal("");

    const errores = validarProveedor(form);
    setErroresCampos(errores);
    if (Object.keys(errores).length) {
      setErrorModal("Revisa los campos marcados antes de guardar.");
      return;
    }

    setGuardando(true);
    try {
      // El NIT se envía sin puntos ni espacios (el backend valida formato y dígito de verificación)
      const payload = {
        nit: limpiarNit(form.nit),
        razon_social: form.razon_social.trim(),
        telefono_proveedor: form.telefono_proveedor.trim(),
        direccion: form.direccion.trim(),
        ciudad: form.ciudad.trim() || null,
      };

      if (proveedorEditando) {
        await proveedorService.actualizar(proveedorEditando.id_proveedor, payload);
        setAviso({ tipo: "success", texto: `Proveedor "${payload.razon_social}" actualizado.` });
      } else {
        await proveedorService.crear(payload);
        setAviso({ tipo: "success", texto: `Proveedor "${payload.razon_social}" registrado.` });
      }
      setModalAbierto(false);
      cargarProveedores();
    } catch (err) {
      // Si el backend rechaza campos puntuales, se marcan debajo de cada uno
      if (err.detalles && typeof err.detalles === "object") setErroresCampos(err.detalles);
      setErrorModal(err.mensaje || "Error al guardar el proveedor.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    setEliminando(true);
    try {
      await proveedorService.eliminar(porEliminar.id_proveedor);
      setAviso({ tipo: "success", texto: `Proveedor "${porEliminar.razon_social}" desactivado.` });
      cargarProveedores();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje || "No se pudo desactivar el proveedor." });
    } finally {
      setEliminando(false);
      setPorEliminar(null);
    }
  };

  // ---- Catálogo del proveedor -------------------------------------------------
  const recargarAsociaciones = async (idProveedor) => {
    setAsociaciones(toList(await proveedorService.obtenerProductosDeProveedor(idProveedor)));
    cargarConteo();
  };

  const abrirCatalogo = async (prov) => {
    setProveedorCatalogo(prov);
    setErrorCatalogo("");
    setEditandoPrecio(null);
    setAsociaciones([]);
    setFormAsociacion({ id_producto: "", precio_compra: "" });
    setTodosProductos([]);
    setCargandoCatalogo(true);
    // Por separado: si falla una consulta, la otra igual se muestra
    const [resRel, resProd] = await Promise.allSettled([
      recargarAsociaciones(prov.id_proveedor),
      productoService.obtenerTodos(),
    ]);
    if (resProd.status === "fulfilled") setTodosProductos(toList(resProd.value));
    const fallo = [resRel, resProd].find((r) => r.status === "rejected");
    if (fallo) setErrorCatalogo(fallo.reason?.mensaje ?? "No se pudo cargar el catálogo del proveedor.");
    setCargandoCatalogo(false);
  };

  // Solo se pueden vincular productos que el proveedor todavía no ofrece
  const idsVinculados = new Set(asociaciones.map((a) => a.fk_producto_proveedor_id_producto));
  const disponibles = todosProductos.filter((p) => !idsVinculados.has(p.id_producto));

  const agregarAsociacion = async (e) => {
    e.preventDefault();
    setErrorCatalogo("");
    const idProducto = Number(formAsociacion.id_producto || disponibles[0]?.id_producto);
    if (!idProducto) return;
    try {
      await proveedorService.asociarProducto(proveedorCatalogo.id_proveedor, {
        fk_producto_proveedor_id_producto: idProducto,
        precio_compra: Number(formAsociacion.precio_compra),
      });
      await recargarAsociaciones(proveedorCatalogo.id_proveedor);
      setFormAsociacion({ id_producto: "", precio_compra: "" });
    } catch (err) {
      setErrorCatalogo(err.mensaje || "Error al vincular el producto.");
    }
  };

  const guardarPrecio = async (asociacion) => {
    setErrorCatalogo("");
    try {
      await proveedorService.actualizarPrecioCompra(asociacion.id_proveedor_producto, {
        precio_compra: Number(editandoPrecio.valor),
      });
      setEditandoPrecio(null);
      await recargarAsociaciones(proveedorCatalogo.id_proveedor);
    } catch (err) {
      setErrorCatalogo(err.mensaje || "No se pudo actualizar el precio.");
    }
  };

  const desvincular = async (asociacion) => {
    setErrorCatalogo("");
    try {
      await proveedorService.eliminarAsociacion(asociacion.id_proveedor_producto);
      await recargarAsociaciones(proveedorCatalogo.id_proveedor);
    } catch (err) {
      setErrorCatalogo(err.mensaje || "No se pudo desvincular el producto.");
    }
  };

  const proveedoresFiltrados = proveedores.filter((p) => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return true;
    return (
      p.razon_social?.toLowerCase().includes(term) ||
      String(p.nit ?? "").toLowerCase().includes(term) ||
      p.ciudad?.toLowerCase().includes(term)
    );
  });

  const set = (campo) => (e) => {
    const valor = e.target.value;
    setForm({ ...form, [campo]: valor });
    // si el campo ya estaba marcado, se re-valida mientras el usuario corrige
    if (erroresCampos[campo]) setErroresCampos((prev) => ({ ...prev, [campo]: VALIDADORES[campo](valor) }));
  };
  const validarAlSalir = (campo) => () =>
    setErroresCampos((prev) => ({ ...prev, [campo]: VALIDADORES[campo](form[campo] ?? "") }));
  const claseInput = (campo) => `input ${erroresCampos[campo] ? "border-destructive focus:ring-destructive/30" : ""}`;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Directorio de proveedores"
        description="Información de contacto y catálogo de compra de cada proveedor."
      >
        <button onClick={cargarProveedores} className="btn btn-outline btn-sm" title="Recargar" aria-label="Recargar">
          <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
        </button>
        <button onClick={abrirModalNuevo} className="btn btn-primary">
          <Plus size={16} />
          Nuevo proveedor
        </button>
      </PageHeader>

      <Notice aviso={aviso} onClose={() => setAviso(null)} />

      <div className="card flex max-w-md items-center gap-2 p-3">
        <Search size={15} className="flex-shrink-0 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por NIT, nombre o ciudad..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar proveedores"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cargando ? (
          <div className="col-span-full py-12 text-center text-xs text-muted-foreground">Cargando proveedores...</div>
        ) : proveedoresFiltrados.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-muted-foreground">
            No se encontraron proveedores registrados.
          </div>
        ) : (
          proveedoresFiltrados.map((p) => (
            <div key={p.id_proveedor} className="card flex flex-col justify-between p-5 transition-shadow hover:shadow-md">
              <div>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                    <Truck size={20} />
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => abrirCatalogo(p)} className="btn-icon hover:text-primary" title="Catálogo de productos" aria-label="Catálogo de productos">
                      <Link2 size={15} />
                    </button>
                    <button onClick={() => abrirModalEditar(p)} className="btn-icon hover:text-primary" title="Editar" aria-label="Editar proveedor">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => setPorEliminar(p)} className="btn-icon hover:text-destructive" title="Desactivar" aria-label="Desactivar proveedor">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-extrabold leading-snug text-foreground">{p.razon_social}</h3>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">NIT: {p.nit}</p>

                <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-primary" />
                    <span>{p.telefono_proveedor || "Sin teléfono"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={13} className="text-primary" />
                    <span>{[p.direccion, p.ciudad].filter(Boolean).join(", ") || "Sin dirección"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-border pt-3">
                <button onClick={() => abrirCatalogo(p)} className="flex w-full items-center justify-between gap-1.5 text-xs font-bold text-primary hover:text-primary-hover">
                  <span className="flex items-center gap-1.5">
                    <Package size={13} />
                    Catálogo de productos
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                    {conteoProductos.get(p.id_proveedor) ?? 0} producto(s)
                  </span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Crear / editar proveedor */}
      <Modal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={proveedorEditando ? "Editar proveedor" : "Registrar nuevo proveedor"}
        subtitle="Ingresa los datos comerciales del proveedor."
        maxWidth="max-w-md"
      >
        <form onSubmit={guardarProveedor} noValidate className="space-y-3.5">
          <Notice aviso={errorModal ? { tipo: "error", texto: errorModal } : null} />

          <div>
            <label className="label" htmlFor="pv-nit">NIT *</label>
            <input
              id="pv-nit"
              required
              maxLength={20}
              inputMode="numeric"
              placeholder="900123456-8"
              className={claseInput("nit")}
              aria-invalid={!!erroresCampos.nit}
              value={form.nit}
              onChange={set("nit")}
              onBlur={validarAlSalir("nit")}
            />
            {erroresCampos.nit ? (
              <ErrorCampo mensaje={erroresCampos.nit} />
            ) : (
              <p className="hint">Entre 6 y 10 dígitos; si incluyes el dígito de verificación, se comprueba.</p>
            )}
          </div>

          <div>
            <label className="label" htmlFor="pv-razon">Razón social *</label>
            <input id="pv-razon" required maxLength={100} placeholder="Distribuidora del Valle S.A.S." className={claseInput("razon_social")} aria-invalid={!!erroresCampos.razon_social} value={form.razon_social} onChange={set("razon_social")} onBlur={validarAlSalir("razon_social")} />
            <ErrorCampo mensaje={erroresCampos.razon_social} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="pv-tel">Teléfono *</label>
              <input id="pv-tel" type="tel" required maxLength={45} placeholder="3101234567" className={claseInput("telefono_proveedor")} aria-invalid={!!erroresCampos.telefono_proveedor} value={form.telefono_proveedor} onChange={set("telefono_proveedor")} onBlur={validarAlSalir("telefono_proveedor")} />
              <ErrorCampo mensaje={erroresCampos.telefono_proveedor} />
            </div>
            <div>
              <label className="label" htmlFor="pv-ciudad">Ciudad</label>
              <input id="pv-ciudad" maxLength={45} placeholder="Cali" className={claseInput("ciudad")} aria-invalid={!!erroresCampos.ciudad} value={form.ciudad} onChange={set("ciudad")} onBlur={validarAlSalir("ciudad")} />
              <ErrorCampo mensaje={erroresCampos.ciudad} />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="pv-dir">Dirección *</label>
            <input id="pv-dir" required maxLength={45} placeholder="Calle 10 # 5-20" className={claseInput("direccion")} aria-invalid={!!erroresCampos.direccion} value={form.direccion} onChange={set("direccion")} onBlur={validarAlSalir("direccion")} />
            <ErrorCampo mensaje={erroresCampos.direccion} />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => setModalAbierto(false)} className="btn btn-outline btn-sm">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn btn-primary btn-sm">
              {guardando ? "Guardando..." : "Guardar proveedor"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Catálogo del proveedor */}
      <Modal
        open={!!proveedorCatalogo}
        onClose={() => setProveedorCatalogo(null)}
        title={`Catálogo: ${proveedorCatalogo?.razon_social ?? ""}`}
        subtitle="Productos que ofrece y precio de compra pactado."
      >
        <div className="space-y-4">
          <Notice aviso={errorCatalogo ? { tipo: "error", texto: errorCatalogo } : null} />

          <form onSubmit={agregarAsociacion} className="space-y-2 rounded-xl border border-border bg-muted/60 p-3">
            <p className="text-xs font-bold text-foreground">Vincular producto</p>
            {cargandoCatalogo ? (
              <p className="text-xs text-muted-foreground">Cargando productos...</p>
            ) : disponibles.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {todosProductos.length === 0
                  ? "Aún no hay productos en el catálogo. Regístralos primero en Productos."
                  : "Este proveedor ya ofrece todos los productos del catálogo."}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={formAsociacion.id_producto || disponibles[0].id_producto}
                    onChange={(e) => setFormAsociacion({ ...formAsociacion, id_producto: e.target.value })}
                    className="input"
                    aria-label="Producto"
                  >
                    {disponibles.map((prod) => (
                      <option key={prod.id_producto} value={prod.id_producto}>
                        {prod.codigo_producto} · {prod.nombre_producto}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    placeholder="Precio de compra ($)"
                    aria-label="Precio de compra"
                    value={formAsociacion.precio_compra}
                    onChange={(e) => setFormAsociacion({ ...formAsociacion, precio_compra: e.target.value })}
                    className="input"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-sm w-full">
                  <Plus size={14} /> Vincular al proveedor
                </button>
              </>
            )}
          </form>

          <div className="max-h-64 divide-y divide-border overflow-y-auto">
            {asociaciones.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No hay productos vinculados a este proveedor aún.</p>
            ) : (
              asociaciones.map((item) => (
                <div key={item.id_proveedor_producto} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-foreground">
                      {item.producto?.nombre_producto ?? `Producto #${item.fk_producto_proveedor_id_producto}`}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">Código: {item.producto?.codigo_producto ?? "—"}</p>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {editandoPrecio?.id === item.id_proveedor_producto ? (
                      <>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          autoFocus
                          value={editandoPrecio.valor}
                          onChange={(e) => setEditandoPrecio({ ...editandoPrecio, valor: e.target.value })}
                          className="input w-28 py-1 text-xs"
                          aria-label="Nuevo precio de compra"
                        />
                        <button onClick={() => guardarPrecio(item)} className="btn-icon text-primary" aria-label="Guardar precio">
                          <Check size={15} />
                        </button>
                        <button onClick={() => setEditandoPrecio(null)} className="btn-icon" aria-label="Cancelar">
                          <X size={15} />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-right">
                          <p className="font-extrabold text-primary">{fmtCOP(item.precio_compra)}</p>
                          <p className="text-[10px] text-muted-foreground">Precio de compra</p>
                        </div>
                        <button
                          onClick={() => setEditandoPrecio({ id: item.id_proveedor_producto, valor: item.precio_compra })}
                          className="btn-icon hover:text-primary"
                          aria-label="Editar precio"
                        >
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => desvincular(item)} className="btn-icon hover:text-destructive" aria-label="Desvincular producto">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!porEliminar}
        titulo="Desactivar proveedor"
        mensaje={`¿Seguro que deseas desactivar a "${porEliminar?.razon_social}"? Se conserva su historial pero dejará de aparecer en el listado.`}
        textoConfirmar="Desactivar"
        cargando={eliminando}
        onConfirm={confirmarEliminar}
        onCancel={() => setPorEliminar(null)}
      />
    </div>
  );
}
