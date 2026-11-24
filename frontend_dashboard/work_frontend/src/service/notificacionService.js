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

    const resumenVencer =
      proximosVencer.status === "fulfilled" && proximosVencer.value?.resumen
        ? proximosVencer.value.resumen
        : { total_productos: 0, total_lotes: 0, total_unidades_inventario: 0, total_unidades_por_vencer: 0 };

    return {
      // "stock mínimo" del backend incluye stock 0; los agotados ya van en su propia lista
      stockMinimo: datos(stockMinimo).filter((p) => Number(p.stock) > 0),
      // Agrupado por producto: { stock (total), cantidad_por_vencer, cantidad_resto, lotes[] }
      proximosVencer: datos(proximosVencer),
      resumenVencer,
      agotados: datos(agotados),
    };
  },
};

export default notificacionService;
