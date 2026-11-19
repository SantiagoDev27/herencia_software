import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { RoleRoute } from "./routes/RoleRoute";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { Dashboard } from "./pages/Dashboard";
import Productos from "./pages/Productos";
import Proveedores from "./pages/Proveedores";
import Movimientos from "./pages/Movimientos";
import Ventas from "./pages/Ventas";
import Reportes from "./pages/Reportes";
import { NotFound } from "./pages/ComingSoon";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          {/* Cada módulo valida el rol (Administrador / Empleado / Finanzas) */}
          <Route element={<RoleRoute permiso="productos" />}>
            <Route path="productos" element={<Productos />} />
          </Route>
          <Route element={<RoleRoute permiso="movimientos" />}>
            <Route path="movimientos" element={<Movimientos />} />
          </Route>
          <Route element={<RoleRoute permiso="ventas" />}>
            <Route path="ventas" element={<Ventas />} />
          </Route>
          <Route element={<RoleRoute permiso="proveedores" />}>
            <Route path="proveedores" element={<Proveedores />} />
          </Route>
          <Route element={<RoleRoute permiso="reportes" />}>
            <Route path="reportes" element={<Reportes />} />
          </Route>

          {/* Rutas anteriores que ahora se resuelven en las pantallas actuales */}
          <Route path="inventario" element={<Navigate to="/dashboard/productos" replace />} />
          <Route path="compras" element={<Navigate to="/dashboard/movimientos" replace />} />
          <Route path="ingresos" element={<Navigate to="/dashboard/movimientos" replace />} />
          <Route path="egresos" element={<Navigate to="/dashboard/movimientos?tab=salidas" replace />} />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
