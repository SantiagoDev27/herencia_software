// Helpers compartidos por todas las pantallas.

// Umbrales: coinciden con los valores por defecto del backend
// (productos/stock-bajo, notificaciones y reporte de inventario usan 15 y 30).
export const UMBRAL_STOCK_BAJO = 15;
export const DIAS_POR_VENCER = 30;

const pad = (n) => String(n).padStart(2, "0");

export const fmtCOP = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

// Extrae un arreglo de la respuesta del backend ({ success, data: [...] }
// o { success, data: { clave: [...] } }).
export const toList = (res, clave) => {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (clave && Array.isArray(d?.[clave])) return d[clave];
  return [];
};

// "YYYY-MM-DD" -> Date local. new Date("2026-10-29") se interpreta como UTC y en
// Colombia mostraría el día anterior, por eso las fechas DATEONLY se parsean a mano.
export const parseFecha = (valor) => {
  if (!valor) return null;
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [y, m, d] = valor.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

export const fmtFecha = (valor, conHora = false) => {
  const fecha = parseFecha(valor);
  if (!fecha) return "—";
  return conHora
    ? fecha.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
    : fecha.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
};

export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const mesKey = (valor) => {
  const f = parseFecha(valor);
  return f ? `${f.getFullYear()}-${pad(f.getMonth() + 1)}` : null;
};

export const mesCorto = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
};

// Códigos autogenerados para entradas/salidas (el backend los exige y deben ser únicos).
export const codigoAuto = (prefijo) => {
  const d = new Date();
  return `${prefijo}-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours()
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};

export const estadoStock = (producto) => {
  const stock = Number(producto?.stock) || 0;
  if (stock <= 0) return "Agotado";
  if (stock <= UMBRAL_STOCK_BAJO) return "Stock bajo";
  return "Disponible";
};

export const diasParaVencer = (fecha) => {
  const f = parseFecha(fecha);
  if (!f) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((f - hoy) / 86400000);
};

export const idProducto = (p) => p?.id_producto;
export const idProveedor = (p) => p?.id_proveedor;

// Descarga un Blob (PDF) en el navegador.
export const descargarBlob = (blob, nombreArchivo) => {
  const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.URL.revokeObjectURL(url);
};

// Valores grandes para ejes de gráficos: 1.200.000 -> "$1,2 M"
export const fmtCompacto = (n) =>
  new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n) || 0);
