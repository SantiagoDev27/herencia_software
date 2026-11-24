import { useEffect, useRef } from "react";

// Intervalo por defecto de la actualización automática de las pantallas
export const INTERVALO_AUTO_MS = 15000;

/**
 * Vuelve a ejecutar `cargar` automáticamente:
 *  - cada `intervalo` ms mientras la pestaña del navegador está visible,
 *  - al volver a la pestaña o a la ventana,
 *  - cuando otra pantalla avisa que los datos cambiaron (evento "herencia:datos-cambiaron").
 *
 * `cargar` recibe `true` (silencioso) para que la pantalla no muestre "Cargando..." ni
 * borre lo que ya tiene si una petición falla momentáneamente.
 */
export function useAutoRefresh(cargar, { intervalo = INTERVALO_AUTO_MS, activo = true } = {}) {
  const ref = useRef(cargar);
  useEffect(() => {
    ref.current = cargar;
  }, [cargar]);

  useEffect(() => {
    if (!activo) return undefined;
    const actualizar = () => {
      if (document.visibilityState === "visible") ref.current?.(true);
    };
    const timer = setInterval(actualizar, intervalo);
    window.addEventListener("focus", actualizar);
    document.addEventListener("visibilitychange", actualizar);
    window.addEventListener("herencia:datos-cambiaron", actualizar);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", actualizar);
      document.removeEventListener("visibilitychange", actualizar);
      window.removeEventListener("herencia:datos-cambiaron", actualizar);
    };
  }, [intervalo, activo]);
}

// Avisar a las demás pantallas abiertas que algo cambió (venta, entrada, salida...)
export const avisarCambioDeDatos = () => window.dispatchEvent(new Event("herencia:datos-cambiaron"));
