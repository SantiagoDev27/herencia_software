import {
  LayoutDashboard, Package, ArrowLeftRight, ShoppingCart, Truck, BarChart3, Users, UserRound, Contact, ClipboardList, Landmark,
} from "lucide-react";

// Solo módulos que tienen servicio real en el backend.
// path es relativo a /dashboard. "permiso" decide qué roles lo ven (ver config/roles.js).
export const navSections = [
  {
    label: "Principal",
    items: [{ id: "dashboard", label: "Resumen", icon: LayoutDashboard, path: "", permiso: "dashboard" }],
  },
  {
    label: "Inventario",
    items: [
      { id: "productos", label: "Productos", icon: Package, path: "productos", permiso: "productos" },
      { id: "movimientos", label: "Entradas y salidas", icon: ArrowLeftRight, path: "movimientos", permiso: "movimientos" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { id: "ventas", label: "Ventas", icon: ShoppingCart, path: "ventas", permiso: "ventas" },
      { id: "clientes", label: "Clientes", icon: Contact, path: "clientes", permiso: "clientes" },
      { id: "proveedores", label: "Proveedores", icon: Truck, path: "proveedores", permiso: "proveedores" },
      { id: "compras", label: "Órdenes de compra", icon: ClipboardList, path: "compras", permiso: "compras" },
    ],
  },
  {
    label: "Finanzas",
    items: [{ id: "contabilidad", label: "Contabilidad", icon: Landmark, path: "contabilidad", permiso: "contabilidad" }],
  },
  {
    label: "Sistema",
    items: [
      { id: "reportes", label: "Reportes", icon: BarChart3, path: "reportes", permiso: "reportes" },
      { id: "usuarios", label: "Usuarios", icon: Users, path: "usuarios", permiso: "usuarios" },
      { id: "cuenta", label: "Mi cuenta", icon: UserRound, path: "cuenta", permiso: "cuenta" },
    ],
  },
];
