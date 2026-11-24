import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

// Pantalla para rutas del panel que no existen
export function NotFound() {
  return (
    <div className="p-6">
      <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Compass size={22} />
        </div>
        <h2 className="text-base font-extrabold text-foreground">Página no encontrada</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Este módulo no existe o todavía no tiene un servicio disponible en el backend.
        </p>
        <Link to="/dashboard" className="btn btn-primary btn-sm mt-1">
          Volver al resumen
        </Link>
      </div>
    </div>
  );
}
