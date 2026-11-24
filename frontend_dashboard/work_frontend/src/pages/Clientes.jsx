import { useState, useEffect, useCallback } from "react";
import { Plus, Search, RefreshCw, Pencil, Trash2, Download } from "lucide-react";
import clienteService from "../service/clienteService";
import { useAuth } from "../context/AuthContext";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { PageHeader } from "../components/ui/PageHeader";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Notice } from "../components/ui/Notice";
import { fmtCOP, toList, exportarCSV, hoyISO } from "../lib/format";

// HU-VEN-006: registrar, actualizar y consultar clientes
const VACIO = {
  identificacion: "", nombre_cliente: "", apellido_cliente: "", telefono_cliente: "",
  correo_cliente: "", direccion_cliente: "", ciudad_cliente: "",
};

export default function Clientes() {
  const { puede } = useAuth();
  const puedeGestionar = puede("gestionarClientes");
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [aviso, setAviso] = useState(null);
  const [modal, setModal] = useState(null); // null | "nuevo" | cliente
  const [form, setForm] = useState(VACIO);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [porEliminar, setPorEliminar] = useState(null);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      setClientes(toList(await clienteService.listar()));
    } catch (err) {
      if (!silencioso) setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useAutoRefresh(cargar);

  const abrir = (c) => {
    setError("");
    setForm(c === "nuevo" ? VACIO : Object.fromEntries(Object.keys(VACIO).map((k) => [k, c[k] ?? ""])));
    setModal(c);
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError("");
    const datos = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    datos.identificacion = Number(datos.identificacion);
    setGuardando(true);
    try {
      if (modal === "nuevo") await clienteService.crear(datos);
      else await clienteService.actualizar(modal.id_cliente, datos);
      setAviso({ tipo: "success", texto: `Cliente ${datos.nombre_cliente} ${modal === "nuevo" ? "registrado" : "actualizado"}.` });
      setModal(null);
      cargar(true);
    } catch (err) {
      setError(err.mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    try {
      await clienteService.eliminar(porEliminar.id_cliente);
      setAviso({ tipo: "success", texto: "Cliente eliminado." });
      cargar(true);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      setPorEliminar(null);
    }
  };

  const term = busqueda.trim().toLowerCase();
  const filtrados = clientes.filter((c) =>
    !term || `${c.nombre_cliente} ${c.apellido_cliente ?? ""} ${c.identificacion} ${c.correo_cliente ?? ""} ${c.ciudad_cliente ?? ""}`.toLowerCase().includes(term)
  );

  const exportar = () =>
    exportarCSV(
      [["Identificación", "Nombre", "Apellido", "Teléfono", "Correo", "Dirección", "Ciudad", "Compras", "Total comprado"],
        ...filtrados.map((c) => [c.identificacion, c.nombre_cliente, c.apellido_cliente, c.telefono_cliente, c.correo_cliente, c.direccion_cliente, c.ciudad_cliente, c.compras, c.total_comprado])],
      `Clientes-${hoyISO()}.csv`
    );

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader title="Clientes" description="Datos de quienes compran, con su historial de compras.">
        <button onClick={() => cargar()} className="btn btn-outline btn-sm" aria-label="Recargar"><RefreshCw size={15} className={cargando ? "animate-spin" : ""} /></button>
        <button onClick={exportar} className="btn btn-outline"><Download size={16} /> Excel</button>
        {puedeGestionar && <button onClick={() => abrir("nuevo")} className="btn btn-primary"><Plus size={16} /> Nuevo cliente</button>}
      </PageHeader>
      <Notice aviso={aviso} onClose={() => setAviso(null)} />

      <div className="card flex max-w-md items-center gap-2 p-3">
        <Search size={15} className="text-muted-foreground" />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, identificación, correo o ciudad..." aria-label="Buscar clientes" className="w-full bg-transparent text-sm outline-none" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3">Identificación</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Contacto</th>
                <th className="px-5 py-3">Ciudad</th>
                <th className="px-5 py-3 text-center">Compras</th>
                <th className="px-5 py-3 text-right">Total comprado</th>
                {puedeGestionar && <th className="px-5 py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cargando ? (
                <tr><td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">Cargando clientes...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">No hay clientes con esos criterios.</td></tr>
              ) : (
                filtrados.map((c) => (
                  <tr key={c.id_cliente} className="hover:bg-muted/50">
                    <td className="px-5 py-3 font-mono text-xs">{c.identificacion}</td>
                    <td className="px-5 py-3 font-semibold">{c.nombre_cliente} {c.apellido_cliente}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{c.telefono_cliente || "—"}<br />{c.correo_cliente}</td>
                    <td className="px-5 py-3 text-xs">{c.ciudad_cliente || "—"}</td>
                    <td className="px-5 py-3 text-center text-xs font-bold">{c.compras}</td>
                    <td className="px-5 py-3 text-right text-xs font-bold">{fmtCOP(c.total_comprado)}</td>
                    {puedeGestionar && (
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => abrir(c)} className="btn-icon hover:text-primary" aria-label={`Editar ${c.nombre_cliente}`}><Pencil size={15} /></button>
                        <button onClick={() => setPorEliminar(c)} className="btn-icon hover:text-destructive" aria-label={`Eliminar ${c.nombre_cliente}`}><Trash2 size={15} /></button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "nuevo" ? "Registrar cliente" : "Editar cliente"} subtitle="La identificación no puede repetirse.">
        <form onSubmit={guardar} className="space-y-3">
          <Notice aviso={error ? { tipo: "error", texto: error } : null} />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="c-id">Identificación (CC/NIT) *</label><input id="c-id" required inputMode="numeric" pattern="[0-9]{4,13}" className="input" value={form.identificacion} onChange={set("identificacion")} /></div>
            <div><label className="label" htmlFor="c-tel">Teléfono</label><input id="c-tel" className="input" value={form.telefono_cliente} onChange={set("telefono_cliente")} /></div>
            <div><label className="label" htmlFor="c-nom">Nombre *</label><input id="c-nom" required maxLength={45} className="input" value={form.nombre_cliente} onChange={set("nombre_cliente")} /></div>
            <div><label className="label" htmlFor="c-ape">Apellido</label><input id="c-ape" maxLength={45} className="input" value={form.apellido_cliente} onChange={set("apellido_cliente")} /></div>
          </div>
          <div><label className="label" htmlFor="c-mail">Correo</label><input id="c-mail" type="email" maxLength={45} className="input" value={form.correo_cliente} onChange={set("correo_cliente")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="c-dir">Dirección</label><input id="c-dir" className="input" value={form.direccion_cliente} onChange={set("direccion_cliente")} /></div>
            <div><label className="label" htmlFor="c-ciu">Ciudad</label><input id="c-ciu" className="input" value={form.ciudad_cliente} onChange={set("ciudad_cliente")} /></div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => setModal(null)} className="btn btn-outline btn-sm">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn btn-primary btn-sm">{guardando ? "Guardando..." : "Guardar cliente"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!porEliminar}
        titulo="Eliminar cliente"
        mensaje={`¿Eliminar a ${porEliminar?.nombre_cliente}? Solo es posible si no tiene ventas registradas.`}
        onConfirm={eliminar}
        onCancel={() => setPorEliminar(null)}
      />
    </div>
  );
}
