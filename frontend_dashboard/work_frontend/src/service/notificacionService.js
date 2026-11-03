import axiosClient from "./axiosClient";

// Cada endpoint responde { message, data? }; si no hay productos, "data" no viene.
const datos = (resultado) => (resultado.status === "fulfilled" ? resultado.value?.data || [] : []);

const notificacionService = {
  obtenerStockMinimo: () => axiosClient.get("/notificaciones/stock-minimo"),
  obtenerProximosAVencer: () => axiosClient.get("/notificaciones/productos-proximos-vencer"),
  obtenerAgotados: () => axiosClient.get("/notificaciones/productos-agotados"),

  obtenerTodas: async () => {
    const [stockMinimo, proximosVencer, agotados] = await Promise.allSettled([
      axiosClient.get("/notificaciones/stock-minimo"),
      axiosClient.get("/notificaciones/productos-proximos-vencer"),
      axiosClient.get("/notificaciones/productos-agotados"),
    ]);

    return {
      // "stock mínimo" del backend incluye stock 0; los agotados ya van en su propia lista
      stockMinimo: datos(stockMinimo).filter((p) => Number(p.stock) > 0),
      proximosVencer: datos(proximosVencer),
      agotados: datos(agotados),
    };
  },
};

export default notificacionService;
