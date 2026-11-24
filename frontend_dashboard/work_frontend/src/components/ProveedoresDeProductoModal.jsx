import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Check, X, Truck } from "lucide-react";
import proveedorService from "../service/proveedorService";
import { Modal } from "./ui/Modal";
import { Notice } from "./ui/Notice";
import { fmtCOP, toList } from "../lib/format";

// Proveedores de UN producto: el mismo vínculo (tabla proveedor-producto) que se ve en
// el catálogo de cada proveedor, pero administrado desde la ficha del producto.
export function ProveedoresDeProductoModal({ producto, onClose, onCambio }) {
  const [relaciones, setRelaciones] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ id_proveedor: "", precio_compra: "" });
  const [editandoPrecio, setEditandoPrecio] = useState(null); // { id, valor }
  const [guardando, setGuardando] = useState(false);

  const idProducto = producto?.id_producto;

  const recargar = useCallback(async () => {
    if (!idProducto) return;
    setRelaciones(toList(await proveedorService.obtenerProveedoresDeProducto(idProducto)));
  }, [idProducto]);

  useEffect(() => {
    if (!idProducto) return;
    setError("");
    setEditandoPrecio(null);
    setRelaciones([]);
    setForm({ id_proveedor: "", precio_compra: producto?.costo_produccion ?? "" });
    setCargando(true);
    // Se piden por separado: si una falla, la otra igual se muestra
    Promise.allSettled([recargar(), proveedorService.obtenerTodos()]).then(([resRel, resProv]) => {
      if (resProv.status === "fulfilled") setProveedores(toList(resProv.value));
      const fallo = [resRel, resProv].find((r) => r.status === "rejected");
      if (fallo) setError(fallo.reason?.mensaje ?? "No se pudo cargar la información de proveedores.");
      setCargando(false);
    });
  }, [idProducto, producto?.costo_produccion, recargar]);

  // Solo se ofrecen proveedores que todavía no surten este producto
  const vinculados = new Set(relaciones.map((r) => r.fk_producto_proveedor_id_proveedor));
  const disponibles = proveedores.filter((p) => !vinculados.has(p.id_proveedor));

  const ejecutar = async (accion, mensajeError) => {
    setError("");
    setGuardando(true);
    try {
      await accion();
      await recargar();
      onCambio?.();
      return true;
    } catch (err) {
      setError(err.mensaje || mensajeError);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const vincular = async (e) => {
    e.preventDefault();
    const idProveedor = Number(form.id_proveedor || disponibles[0]?.id_proveedor);
    const precio = Number(form.precio_compra);
    if (!idProveedor) return;
    if (!(precio > 0)) {
      setError("El precio de compra debe ser mayor a 0.");
      return;
    }
    const ok = await ejecutar(
      () => proveedorService.asociarProveedorAProducto(idProducto, { fk_producto_proveedor_id_proveedor: idProveedor, precio_compra: precio }),
      "No se pudo vincular el proveedor."
    );
    if (ok) setForm({ id_proveedor: "", precio_compra: producto?.costo_produccion ?? "" });
  };

  const guardarPrecio = async (relacion) => {
    const precio = Number(editandoPrecio.valor);
    if (!(precio > 0)) {
      setError("El precio de compra debe ser mayor a 0.");
      return;
    }
    const ok = await ejecutar(
      () => proveedorService.actualizarPrecioCompra(relacion.id_proveedor_producto, { precio_compra: precio }),
      "No se pudo actualizar el precio."
    );
    if (ok) setEditandoPrecio(null);
  };

  const desvincular = (relacion) =>
    ejecutar(() => proveedorService.eliminarAsociacion(relacion.id_proveedor_producto), "No se pudo desvincular el proveedor.");

  return (
    <Modal
      open={!!producto}
      onClose={onClose}
      title={`Proveedores: ${producto?.nombre_producto ?? ""}`}
      subtitle="Quién surte este producto y a qué precio de compra."
    >
      <div className="space-y-4">
        <Notice aviso={error ? { tipo: "error", texto: error } : null} />

        <form onSubmit={vincular} className="space-y-2 rounded-xl border border-border bg-muted/60 p-3">
          <p className="text-xs font-bold text-foreground">Vincular proveedor</p>
          {cargando ? (
            <p className="text-xs text-muted-foreground">Cargando proveedores...</p>
          ) : disponibles.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {proveedores.length === 0
                ? "Aún no hay proveedores registrados. Regístralos primero en Proveedores."
                : "Todos los proveedores registrados ya surten este producto."}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={form.id_proveedor || disponibles[0].id_proveedor}
                  onChange={(e) => setForm({ ...form, id_proveedor: e.target.value })}
                  className="input"
                  aria-label="Proveedor"
                >
                  {disponibles.map((p) => (
                    <option key={p.id_proveedor} value={p.id_proveedor}>
                      {p.razon_social} · NIT {p.nit}
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
                  value={form.precio_compra}
                  onChange={(e) => setForm({ ...form, precio_compra: e.target.value })}
                  className="input"
                />
              </div>
              <button type="submit" disabled={guardando} className="btn btn-primary btn-sm w-full">
                <Plus size={14} /> Vincular al producto
              </button>
            </>
          )}
        </form>

        <div className="max-h-64 divide-y divide-border overflow-y-auto">
          {!cargando && relaciones.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Este producto todavía no tiene proveedores vinculados.</p>
          ) : (
            relaciones.map((r) => (
              <div key={r.id_proveedor_producto} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                    <Truck size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-foreground">
                      {r.proveedor?.razon_social ?? `Proveedor #${r.fk_producto_proveedor_id_proveedor} (inactivo)`}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">NIT: {r.proveedor?.nit ?? "—"}</p>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {editandoPrecio?.id === r.id_proveedor_producto ? (
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
                      <button onClick={() => guardarPrecio(r)} disabled={guardando} className="btn-icon text-primary" aria-label="Guardar precio">
                        <Check size={15} />
                      </button>
                      <button onClick={() => setEditandoPrecio(null)} className="btn-icon" aria-label="Cancelar">
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-right">
                        <p className="font-extrabold text-primary">{fmtCOP(r.precio_compra)}</p>
                        <p className="text-[10px] text-muted-foreground">Precio de compra</p>
                      </div>
                      <button
                        onClick={() => setEditandoPrecio({ id: r.id_proveedor_producto, valor: r.precio_compra })}
                        className="btn-icon hover:text-primary"
                        aria-label="Editar precio"
                      >
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => desvincular(r)} disabled={guardando} className="btn-icon hover:text-destructive" aria-label="Desvincular proveedor">
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
  );
}
