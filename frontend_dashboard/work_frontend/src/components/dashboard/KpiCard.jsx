// Tarjeta de indicador. `color` = clases del icono, p. ej. "bg-primary-soft text-primary".
export function KpiCard({ label, value, sub, icon: Icon, color = "bg-primary-soft text-primary" }) {
  return (
    <div className="card p-5 transition-shadow hover:shadow-md">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon size={18} />
      </div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold leading-none text-foreground">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
