// Etiqueta de estado. Variantes: success (verde), warning (amarillo), danger (rojo), info (azul claro), neutral.
const VARIANTES = {
  success: "badge-success",
  warning: "badge-warning",
  danger: "badge-danger",
  info: "badge-info",
  neutral: "badge-neutral",
};

export function Badge({ variant = "neutral", children }) {
  return <span className={`badge ${VARIANTES[variant] ?? VARIANTES.neutral}`}>{children}</span>;
}

// Estados de stock / reporte que devuelve el backend -> variante de color
const varianteEstado = (estado) => {
  switch (estado) {
    case "Disponible":
      return "success";
    case "Stock bajo":
    case "Próximo a vencer":
      return "warning";
    case "Agotado":
      return "danger";
    default:
      return "neutral";
  }
};

export function EstadoBadge({ estado }) {
  return <Badge variant={varianteEstado(estado)}>{estado}</Badge>;
}
