import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Protege una pantalla según el rol: si el usuario no tiene permiso, vuelve al resumen
export function RoleRoute({ permiso }) {
  const { puede } = useAuth();
  return puede(permiso) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
