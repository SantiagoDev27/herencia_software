import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "../components/dashboard/Sidebar";
import { Topbar } from "../components/dashboard/Topbar";
import { navSections } from "../config/navSections";

// Busca en la config de navegación el label del módulo activo según la URL actual
function useCurrentTitle() {
  const { pathname } = useLocation();
  const segment = pathname.replace(/^\/dashboard\/?/, "").split("/")[0];
  for (const section of navSections) {
    const found = section.items.find((item) => item.path === segment);
    if (found) return found.label;
  }
  return "Herencia de Papá";
}

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = useCurrentTitle();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        onCollapse={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className={`transition-all duration-300 ${collapsed ? "md:pl-16" : "md:pl-60"}`}>
        <Topbar title={title} onMenuClick={() => setMobileOpen(true)} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
