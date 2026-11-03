import { NavLink, useNavigate } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, LogOut, X } from "lucide-react";
import { navSections } from "../../config/navSections";
import { useAuth } from "../../context/AuthContext";

export function Sidebar({ collapsed, onCollapse, mobileOpen, onCloseMobile }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Iniciales para el avatar, a partir del nombre real del usuario logueado
  const iniciales = usuario
    ? `${usuario.nombre_usuario?.[0] ?? ""}${usuario.apellido_usuario?.[0] ?? ""}`.toUpperCase()
    : "??";

  // En pantallas pequeñas la barra es un cajón que se abre con el botón de menú;
  // en md+ es fija y puede colapsarse a solo iconos.
  const ocultarEtiqueta = collapsed ? "md:hidden" : "";

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-[#1D3B2B]/45 md:hidden" onClick={onCloseMobile} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 md:translate-x-0 ${
          collapsed ? "md:w-16" : "md:w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Marca */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-extrabold text-sidebar-primary-foreground shadow-sm">
            HP
          </div>
          <div className={`min-w-0 ${ocultarEtiqueta}`}>
            <p className="truncate font-display text-[15px] font-bold leading-tight text-white">Herencia de Papá</p>
            <p className="text-[11px] leading-tight text-sidebar-foreground/70">Sistema ERP</p>
          </div>
          <button
            onClick={onCollapse}
            className="ml-auto hidden flex-shrink-0 rounded-lg p-1 text-sidebar-foreground/70 transition-colors hover:bg-white/10 hover:text-white md:block"
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
          >
            {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
          </button>
          <button
            onClick={onCloseMobile}
            className="ml-auto rounded-lg p-1 text-sidebar-foreground/70 hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Cerrar menú"
          >
            <X size={16} />
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p
                className={`mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/55 ${ocultarEtiqueta}`}
              >
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      end={item.path === ""}
                      onClick={onCloseMobile}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        `flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all duration-150 ${
                          isActive
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                        } ${collapsed ? "md:justify-center" : ""}`
                      }
                    >
                      <Icon size={17} className="flex-shrink-0" />
                      <span className={`truncate ${ocultarEtiqueta}`}>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sesión */}
        <div className="border-t border-sidebar-border p-3">
          <div className={`mb-2 flex items-center gap-2.5 px-1 ${ocultarEtiqueta}`}>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
              {iniciales}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">
                {usuario ? `${usuario.nombre_usuario} ${usuario.apellido_usuario}` : "Usuario"}
              </p>
              <p className="truncate text-[10px] text-sidebar-foreground/70">{usuario?.rol?.nombre_rol ?? "—"}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-white ${
              collapsed ? "md:justify-center" : ""
            }`}
          >
            <LogOut size={16} />
            <span className={ocultarEtiqueta}>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
