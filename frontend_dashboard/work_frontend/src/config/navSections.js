import {
  LayoutDashboard, Package, ArrowLeftRight, ShoppingCart, Truck, BarChart3,
} from "lucide-react";

// Solo módulos que tienen servicio real en el backend.
// path es relativo a /dashboard.
export const navSections = [
  {
    label: "Principal",
    items: [{ id: "dashboard", label: "Resumen", icon: LayoutDashboard, path: "" }],
  },
  {
    label: "Inventario",
    items: [
      { id: "productos", label: "Productos", icon: Package, path: "productos" },
      { id: "movimientos", label: "Entradas y salidas", icon: ArrowLeftRight, path: "movimientos" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { id: "ventas", label: "Ventas", icon: ShoppingCart, path: "ventas" },
      { id: "proveedores", label: "Proveedores", icon: Truck, path: "proveedores" },
    ],
  },
  {
    label: "Sistema",
    items: [{ id: "reportes", label: "Reportes", icon: BarChart3, path: "reportes" }],
  },
];
