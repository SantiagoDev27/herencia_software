import { Op } from "sequelize";
import sequelize from '../configuration/database.js';
import Producto from '../models/ProductModels.js';
import Categoria from '../models/CategoriesModels.js';
import Lote from '../models/loteModel.js';

class ProductoRepository {

  async crear(datosProducto) {
    return await Producto.create(datosProducto);
  }

  async obtenerPorCodigo(codigo_producto) {
    return await Producto.findOne({ where: { codigo_producto } });
  }

  async obtenerPorId(id_producto, options = {}) {
    return await Producto.findByPk(id_producto, {
      include: { model: Categoria, as: 'categoria' },
      ...options
    });
  }

  // Versión liviana de obtenerPorId, sin include de Categoria.
  // Pensada para validaciones internas (ej. chequeo de stock en transacciones de venta)
  // donde no se necesita la info de categoría y se busca evitar el JOIN innecesario.
  async obtenerPorIdSimple(id_producto, options = {}) {
    return await Producto.findByPk(id_producto, options);
  }

  async obtenerTodos() {
    return await Producto.findAll({
      include: { model: Categoria, as: 'categoria' }
    });
  }

  async actualizar(id_producto, datosActualizados) {
    const producto = await Producto.findByPk(id_producto);
    if (!producto) return null;
    return await producto.update(datosActualizados);
  }

  async eliminar(id_producto) {
    const producto = await Producto.findByPk(id_producto);
    if (!producto) return null;
    await producto.destroy();
    return producto;
  }

  // Se mantiene por si ya se usa en otras funcionalidades (ej. ajuste manual de stock)
  async actualizarStock(id_producto, nuevoStock, transaction = null) {
    return await Producto.update({ stock: nuevoStock }, { where: { id_producto }, transaction });
  }

  // Usado por Ingreso de mercancía (suma stock de forma atómica)
  async incrementarStock(id_producto, cantidad, transaction = null) {
    return await Producto.increment("stock", { by: cantidad, where: { id_producto }, transaction });
  }

  // Usado por Salida de mercancía (resta stock de forma atómica)
  async decrementarStock(id_producto, cantidad, transaction = null) {
    return await Producto.decrement("stock", { by: cantidad, where: { id_producto }, transaction });
  }

  // ============================================
  // HISTORIA DE USUARIO: CONSULTAR EXISTENCIAS INV-006
  // ============================================

  
  // Obtener productos sin stock (stock <= 0)
  async obtenerProductosSinStock() {
    return await Producto.findAll({
      where: { stock: { [Op.lte]: 0 } },
      include: { model: Categoria, as: 'categoria' }
    });
  }

  // Obtener productos con stock (stock > 0)
  async obtenerProductosConStock() {
    return await Producto.findAll({
      where: { stock: { [Op.gt]: 0 } },
      include: { model: Categoria, as: 'categoria' }
    });
  }

  // Obtener productos con stock bajo (stock <= umbral, por defecto 15)
  async obtenerProductosConStockBajo(umbral = 15) {
    return await Producto.findAll({
      where: { stock: { [Op.lte]: umbral } },
      include: { model: Categoria, as: 'categoria' }
    });
  }

  async obtenerProductosProximosAVencer(dias = 30) {

    const hoy = new Date();
    const fechaActual = hoy.toISOString().split("T")[0];

    const limite = new Date();
    limite.setDate(limite.getDate() + dias);
    const fechaLimite = limite.toISOString().split("T")[0];

    return await Producto.findAll({
        where: {
            // Los agotados no cuentan como "próximos a vencer": ya no tienen unidades
            stock: { [Op.gt]: 0 },
            fecha_vencimiento: {
                [Op.between]: [fechaActual, fechaLimite]
            }
        },
        include: {
            model: Categoria,
            as: "categoria"
        }
    });

    //consultas para el inventario de generar reporte
}
  async contarProductos() {
    return await Producto.count();
  }

  // ============================================
  // Vencimientos: la fecha del producto = vencimiento más próximo de sus lotes con existencias.
  // Si el producto se agota (stock <= 0) o ya no le quedan lotes, la fecha queda en NULL.
  // ============================================
  async sincronizarVencimiento(ids, transaction = null) {
    const lista = [...new Set([].concat(ids).map(Number).filter(Boolean))];
    for (const id_producto of lista) {
      const producto = await Producto.findByPk(id_producto, { transaction, attributes: ['id_producto', 'stock'] });
      if (!producto) continue;

      let fecha = null;
      if (Number(producto.stock) > 0) {
        const lotesDelProducto = await Lote.count({ where: { fk_lote_id_producto: id_producto }, transaction });
        if (lotesDelProducto === 0) continue; // producto sin manejo por lotes: se conserva su fecha manual
        fecha = await Lote.min('fecha_vencimiento', {
          where: { fk_lote_id_producto: id_producto, cantidad_actual: { [Op.gt]: 0 } },
          transaction
        }) ?? null;
      }
      await Producto.update({ fecha_vencimiento: fecha }, { where: { id_producto }, transaction });
    }
  }

  // Sincroniza todo el catálogo (se ejecuta al arrancar el servidor). Devuelve cuántos productos cambió.
  async sincronizarVencimientos() {
    // 1. Agotados: sin fecha
    const [agotados] = await Producto.update(
      { fecha_vencimiento: null },
      { where: { stock: { [Op.lte]: 0 }, fecha_vencimiento: { [Op.ne]: null } } }
    );
    // 2. Con existencias y lotes: fecha del lote disponible más próximo a vencer
    let conLotes = 0;
    try {
      const filas = await Lote.findAll({
        attributes: ['fk_lote_id_producto', [sequelize.fn('MIN', sequelize.col('fecha_vencimiento')), 'proximo']],
        where: { cantidad_actual: { [Op.gt]: 0 } },
        group: ['fk_lote_id_producto'],
        raw: true
      });
      for (const fila of filas) {
        const [n] = await Producto.update(
          { fecha_vencimiento: fila.proximo },
          { where: { id_producto: fila.fk_lote_id_producto, stock: { [Op.gt]: 0 } } }
        );
        conLotes += n;
      }
    } catch (error) {
      // La tabla de lotes puede no existir en bases antiguas: solo se aplica el paso 1
    }
    return agotados + conLotes;
  }

  // "Retirar" productos agotados del catálogo (soft delete): dejan de aparecer pero
  // conservan su historial de ventas y movimientos (requisito 2.2.1.3 Integridad).
  async retirarAgotados() {
    const agotados = await Producto.findAll({ where: { stock: { [Op.lte]: 0 } }, attributes: ['id_producto', 'nombre_producto'] });
    if (agotados.length === 0) return [];
    await Producto.destroy({ where: { id_producto: agotados.map((p) => p.id_producto) } });
    return agotados;
  }

}

export default new ProductoRepository();