import ProductoService from '../services/ProductoService.js';
import AppError from '../utils/AppError.js';
import LoteRepository from '../repositories/LoteRepository.js';

class NotificacionService {
  async notificarStockMinimo() {
    try {
      const productos = await ProductoService.obtenerProductosConStockBajo();

      if (productos.length === 0) {
        return { message: 'No hay productos con stock mínimo.' };
      }

      // Aquí puedes implementar la lógica para enviar notificaciones, por ejemplo, enviar un correo electrónico o un mensaje a un sistema de mensajería.
      // Por ahora, simplemente retornamos los productos con stock mínimo.
      return { message: 'Productos con stock mínimo encontrados.', data: productos };
    } catch (error) {
      throw new AppError('Error al notificar sobre productos con stock mínimo.', 500);
    }
  }
  // Notificar lotes próximos a vencer, agrupados por producto.
  // Por cada producto se informa el total en inventario y, aparte, cuántas unidades
  // de ese total pertenecen a lotes que vencen dentro de "dias" días.
  async notificarProductosProximosAVencer(dias = 30) {
    try {
      const diasVentana = Number.isInteger(dias) && dias > 0 ? dias : 30;
      const lotes = await LoteRepository.obtenerLotesProximosAVencerConProducto(diasVentana);

      if (lotes.length === 0) {
        return {
          message: `No hay lotes próximos a vencer en los próximos ${diasVentana} días.`,
          resumen: { total_productos: 0, total_lotes: 0, total_unidades_inventario: 0, total_unidades_por_vencer: 0 },
          data: []
        };
      }

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const diasRestantes = (fecha) => {
        const [a, m, d] = String(fecha).split("-").map(Number);
        return Math.round((new Date(a, m - 1, d) - hoy) / 86400000);
      };

      const porProducto = new Map();
      for (const lote of lotes) {
        const idProducto = lote.fk_lote_id_producto;
        if (!porProducto.has(idProducto)) {
          porProducto.set(idProducto, {
            id_producto: idProducto,
            codigo_producto: lote.producto?.codigo_producto ?? null,
            nombre_producto: lote.producto?.nombre_producto ?? `Producto #${idProducto}`,
            stock: Number(lote.producto?.stock ?? 0),          // total del producto en inventario
            cantidad_por_vencer: 0,                             // unidades en lotes próximos a vencer
            fecha_vencimiento: lote.fecha_vencimiento,          // vencimiento más cercano
            dias_restantes: diasRestantes(lote.fecha_vencimiento),
            lotes: []
          });
        }
        const item = porProducto.get(idProducto);
        item.cantidad_por_vencer += Number(lote.cantidad_actual);
        item.lotes.push({
          id_lote: lote.id_lote,
          numero_lote: lote.numero_lote,
          cantidad: Number(lote.cantidad_actual),
          fecha_vencimiento: lote.fecha_vencimiento,
          dias_restantes: diasRestantes(lote.fecha_vencimiento)
        });
      }

      const data = [...porProducto.values()].map((p) => ({
        ...p,
        // si el stock del producto quedó desfasado de sus lotes, nunca mostramos "resto" negativo
        cantidad_resto: Math.max(p.stock - p.cantidad_por_vencer, 0)
      }));

      const resumen = {
        total_productos: data.length,
        total_lotes: lotes.length,
        total_unidades_inventario: data.reduce((acc, p) => acc + p.stock, 0),
        total_unidades_por_vencer: data.reduce((acc, p) => acc + p.cantidad_por_vencer, 0)
      };

      return {
        message: `${resumen.total_productos} producto(s) con lotes próximos a vencer en los próximos ${diasVentana} días.`,
        resumen,
        data
      };
    } catch (error) {
      throw new AppError('Error al notificar sobre lotes próximos a vencer.', 500);
    }
  }

  //consultar productos agotdados
  async notificarProductosAgotados() {
    try {
      const productos = await ProductoService.obtenerProductosSinStock();

      if (productos.length === 0) {
        return { message: 'No hay productos agotados.' };
      }

      // Aquí puedes implementar la lógica para enviar notificaciones, por ejemplo, enviar un correo electrónico o un mensaje a un sistema de mensajería.
      // Por ahora, simplemente retornamos los productos agotados.
      return { message: 'Productos agotados encontrados.', data: productos };
    } catch (error) {
      throw new AppError('Error al notificar sobre productos agotados.', 500);
    }
  }
}

export default new NotificacionService();

