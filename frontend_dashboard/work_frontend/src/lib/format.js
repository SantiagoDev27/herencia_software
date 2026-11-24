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
  // Si se libera de inmediato, algunos navegadores cancelan la descarga
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

// Valores grandes para ejes de gráficos: 1.200.000 -> "$1,2 M"
export const fmtCompacto = (n) =>
  new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(Number(n) || 0);

// Fecha local "YYYY-MM-DD" de hace `dias` días
export const haceDiasISO = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Periodos para las pantallas con historial (ventas, movimientos, reportes).
// Para que las listas no crezcan sin límite, por defecto solo se muestra el último mes.
export const PERIODOS = [
  { id: "mes", label: "Último mes", dias: 30 },
  { id: "trimestre", label: "Últimos 3 meses", dias: 90 },
  { id: "anio", label: "Último año", dias: 365 },
  { id: "todo", label: "Todo", dias: null },
];
export const PERIODO_DEFECTO = "mes";

// { fechaInicio, fechaFin } del periodo (fechaInicio null = sin límite)
export const rangoDePeriodo = (idPeriodo) => {
  const periodo = PERIODOS.find((p) => p.id === idPeriodo) ?? PERIODOS[0];
  return { fechaInicio: periodo.dias ? haceDiasISO(periodo.dias) : null, fechaFin: hoyISO() };
};

// ¿La fecha está dentro del periodo? (para filtrar listas que el backend devuelve completas)
export const dentroDePeriodo = (fecha, idPeriodo) => {
  const { fechaInicio } = rangoDePeriodo(idPeriodo);
  if (!fechaInicio) return true;
  const f = String(fecha ?? "").slice(0, 10);
  return f >= fechaInicio;
};

// Exporta filas a CSV (Excel lo abre directamente). filas: arreglo de arreglos; la primera es el encabezado.
export const exportarCSV = (filas, nombreArchivo) => {
  const celda = (v) => {
    const texto = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  // ";" como separador y BOM UTF-8: así Excel en español respeta columnas y tildes
  const contenido = "\uFEFF" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
  const url = window.URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};
