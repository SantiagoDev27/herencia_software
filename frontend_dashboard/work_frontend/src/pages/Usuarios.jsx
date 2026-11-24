import { useState, useEffect, useCallback, useMemo } from "react";
import { UserPlus, Search, RefreshCw, Pencil, KeyRound, UserX, UserCheck, ShieldCheck, History, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import PermisosRol from "../components/usuarios/PermisosRol";
import usuarioService from "../service/usuarioService";
import { useAuth } from "../context/AuthContext";
import { useAutoRefresh } from "../hooks/useAutoRefresh";
import { PageHeader } from "../components/ui/PageHeader";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Notice } from "../components/ui/Notice";
import { Badge } from "../components/ui/Badge";
import { ROLES_ASIGNABLES, nombreRolPorId } from "../config/roles";
import { fmtFecha, toList } from "../lib/format";
import { validarClave } from "../lib/validaciones";

// HU-SEG-005 / 006 / 010: el Administrador crea, modifica, activa/desactiva usuarios,
// les asigna rol (Vendedor, Finanzas o Administrador) y consulta la auditoría de accesos.

const FORM_VACIO = {
  nombre_usuario: "",
  apellido_usuario: "",
  correo_usuario: "",
  telefono_usuario: "",
  contraseña_usuario: "",
  fk_usuario_id_rol: 2, // Vendedor por defecto
};

const varianteRol = (id) => ({ 1: "info", 2: "success", 3: "warning" }[Number(id)] ?? "neutral");

export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const [tab, setTab] = useState("usuarios");
  const [usuarios, setUsuarios] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  const [modal, setModal] = useState(null); // null | "crear" | usuario (editar)
  const [form, setForm] = useState(FORM_VACIO);
  const [errorModal, setErrorModal] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [verClave, setVerClave] = useState(false);

  const [porCambiarEstado, setPorCambiarEstado] = useState(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  const [porRestablecer, setPorRestablecer] = useState(null);
  const [nuevaClave, setNuevaClave] = useState("");

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const [resU, resA] = await Promise.all([usuarioService.listar(), usuarioService.auditoria(150)]);
      setUsuarios(toList(resU));
      setAuditoria(toList(resA));
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

  const filtrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (filtroRol && Number(u.fk_usuario_id_rol) !== Number(filtroRol)) return false;
      if (filtroEstado === "activos" && u.estado_usuario === false) return false;
      if (filtroEstado === "inactivos" && u.estado_usuario !== false) return false;
      if (!term) return true;
      return `${u.nombre_usuario} ${u.apellido_usuario} ${u.correo_usuario}`.toLowerCase().includes(term);
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado]);

  const conteo = useMemo(
    () => ({
      total: usuarios.length,
      activos: usuarios.filter((u) => u.estado_usuario !== false).length,
      vendedores: usuarios.filter((u) => Number(u.fk_usuario_id_rol) === 2).length,
      finanzas: usuarios.filter((u) => Number(u.fk_usuario_id_rol) === 3).length,
    }),
    [usuarios]
  );

  const abrirCrear = () => {
    setForm(FORM_VACIO);
    setErrorModal("");
    setVerClave(false);
    setModal("crear");
  };

  const abrirEditar = (u) => {
    setForm({
      nombre_usuario: u.nombre_usuario ?? "",
      apellido_usuario: u.apellido_usuario ?? "",
      correo_usuario: u.correo_usuario ?? "",
      telefono_usuario: u.telefono_usuario ?? "",
      contraseña_usuario: "",
      fk_usuario_id_rol: u.fk_usuario_id_rol,
    });
    setErrorModal("");
    setModal(u);
  };

  const esCrear = modal === "crear";
  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    setErrorModal("");

    const datos = {
      nombre_usuario: form.nombre_usuario.trim(),
      apellido_usuario: form.apellido_usuario.trim(),
      correo_usuario: form.correo_usuario.trim().toLowerCase(),
      fk_usuario_id_rol: Number(form.fk_usuario_id_rol),
    };
    if (form.telefono_usuario.trim()) datos.telefono_usuario = form.telefono_usuario.trim();

    if (esCrear) {
      const errorClave = validarClave(form.contraseña_usuario);
      if (errorClave) return setErrorModal(errorClave);
      datos.contraseña_usuario = form.contraseña_usuario;
    }

    setGuardando(true);
    try {
      if (esCrear) {
        await usuarioService.crear(datos);
        setAviso({
          tipo: "success",
          texto: `Usuario ${datos.correo_usuario} creado como ${nombreRolPorId(datos.fk_usuario_id_rol)}. Ya puede iniciar sesión con la contraseña asignada.`,
        });
      } else {
        await usuarioService.actualizar(modal.idusuario, datos);
        setAviso({ tipo: "success", texto: `Usuario ${datos.correo_usuario} actualizado.` });
      }
      setModal(null);
      cargar(true);
    } catch (err) {
      setErrorModal(err.mensaje || "No se pudo guardar el usuario.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarCambioEstado = async () => {
    const u = porCambiarEstado;
    const activar = u.estado_usuario === false;
    setCambiandoEstado(true);
    try {
      await usuarioService.cambiarEstado(u.idusuario, activar);
      setAviso({ tipo: "success", texto: `Usuario ${u.correo_usuario} ${activar ? "activado" : "desactivado"}.` });
      cargar(true);
    } catch (err) {
      setAviso({ tipo: "error", texto: err.mensaje });
    } finally {
      setCambiandoEstado(false);
      setPorCambiarEstado(null);
    }
  };

  const restablecer = async (e) => {
    e.preventDefault();
    const errorClave = validarClave(nuevaClave);
    if (errorClave) return setErrorModal(errorClave);
    setGuardando(true);
    try {
      await usuarioService.restablecerContrasena(porRestablecer.idusuario, nuevaClave);
      setAviso({ tipo: "success", texto: `Contraseña de ${porRestablecer.correo_usuario} restablecida. Entrégasela al usuario y pídele que la cambie en "Mi cuenta".` });
      setPorRestablecer(null);
      cargar(true);
    } catch (err) {
      setErrorModal(err.mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const bloqueado = (u) => u.bloqueado_hasta && new Date(u.bloqueado_hasta) > new Date();

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader title="Usuarios del sistema" description="Crea cuentas de Vendedor o Finanzas, asigna roles y controla el acceso.">
        <button onClick={() => cargar()} className="btn btn-outline btn-sm" title="Recargar" aria-label="Recargar">
          <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
        </button>
        <button onClick={abrirCrear} className="btn btn-primary">
          <UserPlus size={16} />
          Añadir usuario
        </button>
      </PageHeader>

      <Notice aviso={aviso} onClose={() => setAviso(null)} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Usuarios", conteo.total],
          ["Activos", conteo.activos],
          ["Vendedores", conteo.vendedores],
          ["Finanzas", conteo.finanzas],
        ].map(([label, valor]) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-extrabold text-foreground">{valor}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        {[
          ["usuarios", "Usuarios", ShieldCheck],
          ["permisos", "Permisos por rol", SlidersHorizontal],
          ["auditoria", "Auditoría de accesos", History],
        ].map(([id, label, Icono]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
              tab === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            <Icono size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "usuarios" ? (
        <>
          <div className="card flex flex-col gap-3 p-3 md:flex-row md:items-center">
            <div className="flex w-full items-center gap-2 rounded-xl bg-muted px-3 py-2 md:w-80">
              <Search size={15} className="text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar usuarios"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <select className="input md:w-44" value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)} aria-label="Filtrar por rol">
              <option value="">Todos los roles</option>
              {ROLES_ASIGNABLES.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre}</option>
              ))}
            </select>
            <select className="input md:w-40" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} aria-label="Filtrar por estado">
              <option value="">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Desactivados</option>
            </select>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-5 py-3">Usuario</th>
                    <th className="px-5 py-3">Correo</th>
                    <th className="px-5 py-3">Teléfono</th>
                    <th className="px-5 py-3 text-center">Rol</th>
                    <th className="px-5 py-3 text-center">Estado</th>
                    <th className="px-5 py-3">Último acceso</th>
                    <th className="px-5 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cargando ? (
                    <tr><td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">Cargando usuarios...</td></tr>
                  ) : filtrados.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-xs text-muted-foreground">No hay usuarios con esos criterios.</td></tr>
                  ) : (
                    filtrados.map((u) => {
                      const activo = u.estado_usuario !== false;
                      const soyYo = Number(u.idusuario) === Number(yo?.idusuario);
                      return (
                        <tr key={u.idusuario} className={`transition-colors hover:bg-muted/50 ${activo ? "" : "opacity-60"}`}>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-foreground">
                              {u.nombre_usuario} {u.apellido_usuario} {soyYo && <span className="text-[11px] text-muted-foreground">(tú)</span>}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 text-xs">{u.correo_usuario}</td>
                          <td className="px-5 py-3.5 text-xs text-muted-foreground">{u.telefono_usuario || "—"}</td>
                          <td className="px-5 py-3.5 text-center">
                            <Badge variant={varianteRol(u.fk_usuario_id_rol)}>{nombreRolPorId(u.fk_usuario_id_rol)}</Badge>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {!activo ? (
                              <Badge variant="danger">Desactivado</Badge>
                            ) : bloqueado(u) ? (
                              <Badge variant="warning">Bloqueado</Badge>
                            ) : (
                              <Badge variant="success">Activo</Badge>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-muted-foreground">{u.ultimo_acceso ? fmtFecha(u.ultimo_acceso, true) : "Nunca"}</td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => abrirEditar(u)} className="btn-icon hover:text-primary" title="Editar" aria-label={`Editar ${u.correo_usuario}`}>
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => { setPorRestablecer(u); setNuevaClave(""); setErrorModal(""); }}
                                className="btn-icon hover:text-primary"
                                title="Restablecer contraseña"
                                aria-label={`Restablecer contraseña de ${u.correo_usuario}`}
                              >
                                <KeyRound size={15} />
                              </button>
                              {!soyYo && (
                                <button
                                  onClick={() => setPorCambiarEstado(u)}
                                  className={`btn-icon ${activo ? "hover:text-destructive" : "hover:text-primary"}`}
                                  title={activo ? "Desactivar" : "Activar"}
                                  aria-label={`${activo ? "Desactivar" : "Activar"} ${u.correo_usuario}`}
                                >
                                  {activo ? <UserX size={15} /> : <UserCheck size={15} />}
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
        </>
      ) : tab === "permisos" ? (
        <PermisosRol />
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-sm font-extrabold">Auditoría de accesos y acciones</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Últimos 150 eventos: inicios de sesión, bloqueos y cambios de usuarios.</p>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-head sticky top-0">
                <tr>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Usuario</th>
                  <th className="px-5 py-3">Acción</th>
                  <th className="px-5 py-3">Detalle</th>
                  <th className="px-5 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditoria.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-xs text-muted-foreground">Sin eventos registrados.</td></tr>
                ) : (
                  auditoria.map((a) => (
                    <tr key={a.id_auditoria}>
                      <td className="whitespace-nowrap px-5 py-2.5 text-xs text-muted-foreground">{fmtFecha(a.fecha, true)}</td>
                      <td className="px-5 py-2.5 text-xs">{a.correo ?? "—"}</td>
                      <td className="px-5 py-2.5">
                        <Badge variant={/FALLIDO|BLOQUEADA|RECHAZADO|DESACTIVAR/.test(a.accion) ? "danger" : "neutral"}>{a.accion.replace(/_/g, " ")}</Badge>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-muted-foreground">{a.detalle ?? "—"}</td>
                      <td className="px-5 py-2.5 font-mono text-[11px] text-muted-foreground">{a.ip ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Crear / editar */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={esCrear ? "Añadir usuario" : "Editar usuario"}
        subtitle={esCrear ? "La cuenta queda activa y el usuario podrá iniciar sesión con estos datos." : "Modifica los datos o el rol del usuario."}
      >
        <form onSubmit={guardar} className="space-y-3.5">
          <Notice aviso={errorModal ? { tipo: "error", texto: errorModal } : null} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="u-nombre">Nombre *</label>
              <input id="u-nombre" required maxLength={100} className="input" value={form.nombre_usuario} onChange={set("nombre_usuario")} />
            </div>
            <div>
              <label className="label" htmlFor="u-apellido">Apellido *</label>
              <input id="u-apellido" required maxLength={100} className="input" value={form.apellido_usuario} onChange={set("apellido_usuario")} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="u-correo">Correo electrónico *</label>
            <input id="u-correo" type="email" required maxLength={150} className="input" value={form.correo_usuario} onChange={set("correo_usuario")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="u-tel">Teléfono</label>
              <input id="u-tel" type="tel" maxLength={20} className="input" value={form.telefono_usuario} onChange={set("telefono_usuario")} />
            </div>
            <div>
              <label className="label" htmlFor="u-rol">Rol *</label>
              <select id="u-rol" className="input" value={form.fk_usuario_id_rol} onChange={set("fk_usuario_id_rol")}>
                {ROLES_ASIGNABLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="hint">{ROLES_ASIGNABLES.find((r) => r.id === Number(form.fk_usuario_id_rol))?.descripcion}</p>
          {esCrear && (
            <div>
              <label className="label" htmlFor="u-clave">Contraseña inicial *</label>
              <div className="relative">
                <input
                  id="u-clave"
                  type={verClave ? "text" : "password"}
                  required
                  minLength={8}
                  maxLength={255}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres, con letras y números"
                  className="input pr-10"
                  value={form.contraseña_usuario}
                  onChange={set("contraseña_usuario")}
                />
                <button
                  type="button"
                  onClick={() => setVerClave((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={() => setModal(null)} className="btn btn-outline btn-sm">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn btn-primary btn-sm">
              {guardando ? "Guardando..." : esCrear ? "Crear usuario" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Restablecer contraseña (HU-SEG-003) */}
      <Modal
        open={!!porRestablecer}
        onClose={() => setPorRestablecer(null)}
        title="Restablecer contraseña"
        subtitle={`Asigna una contraseña temporal a ${porRestablecer?.correo_usuario ?? ""}. También desbloquea la cuenta.`}
        maxWidth="max-w-sm"
      >
        <form onSubmit={restablecer} className="space-y-3.5">
          <Notice aviso={errorModal ? { tipo: "error", texto: errorModal } : null} />
          <div>
            <label className="label" htmlFor="u-nueva">Nueva contraseña *</label>
            <input
              id="u-nueva"
              type="text"
              required
              minLength={8}
              autoComplete="new-password"
              className="input"
              placeholder="Mínimo 8 caracteres, con letras y números"
              value={nuevaClave}
              onChange={(e) => setNuevaClave(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPorRestablecer(null)} className="btn btn-outline btn-sm">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn btn-primary btn-sm">{guardando ? "Guardando..." : "Restablecer"}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!porCambiarEstado}
        titulo={porCambiarEstado?.estado_usuario === false ? "Activar usuario" : "Desactivar usuario"}
        mensaje={
          porCambiarEstado?.estado_usuario === false
            ? `${porCambiarEstado?.correo_usuario} podrá volver a iniciar sesión.`
            : `${porCambiarEstado?.correo_usuario} no podrá iniciar sesión y su sesión actual se cerrará. Su historial de ventas se conserva.`
        }
        textoConfirmar={porCambiarEstado?.estado_usuario === false ? "Activar" : "Desactivar"}
        cargando={cambiandoEstado}
        onConfirm={confirmarCambioEstado}
        onCancel={() => setPorCambiarEstado(null)}
      />
    </div>
  );
}
