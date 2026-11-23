import { DataTypes } from 'sequelize';
import sequelize from '../configuration/database.js';
import Categoria from './CategoriesModels.js';

const Producto = sequelize.define('Producto', {
  id_producto: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    field: 'id_producto'
  },
  codigo_producto: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    field: 'codigo_producto'
  },
  nombre_producto: {
    type: DataTypes.STRING(150),
    allowNull: false,
    field: 'nombre_producto'
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'stock'
  },
  costo_produccion: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'costo_produccion'
  },
  precio_venta: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'precio_venta'
  },
  iva: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'iva'
  },
  fecha_produccion: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'fecha_produccion'
  },
  fecha_vencimiento: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'fecha_vencimiento'
  },
  fk_producto_id_categoria: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'fk_producto_id_categoria',
    references: {
      model: Categoria,
      key: 'id_categoria'
    }
  }
}, {
  tableName: 'producto',
  // No tenemos created_at/updated_at en la tabla actual, los desactivamos
  createdAt: false,
  updatedAt: false,
  // paranoid activa el soft delete: en vez de borrar, llena deleted_at
  paranoid: true,
  deletedAt: 'deleted_at'
});

// Regla de negocio: un producto agotado (stock <= 0) no muestra fecha de vencimiento.
// La fecha del producto es la del lote con existencias más próximo a vencer; cuando se
// agota, deja de tener sentido y se oculta en cualquier consulta (además, el repositorio
// la deja en NULL en la base de datos al sincronizar, ver ProductoRepository.sincronizarVencimiento).
Producto.addHook('afterFind', 'ocultarVencimientoAgotados', (resultado) => {
  if (!resultado) return;
  const lista = Array.isArray(resultado) ? resultado : [resultado];
  for (const producto of lista) {
    if (producto && typeof producto.getDataValue === 'function' && Number(producto.getDataValue('stock')) <= 0) {
      producto.setDataValue('fecha_vencimiento', null);
    }
  }
});

// Relaciones: un producto pertenece a una categoria, una categoria tiene muchos productos
Producto.belongsTo(Categoria, { foreignKey: 'fk_producto_id_categoria', as: 'categoria' });
Categoria.hasMany(Producto, { foreignKey: 'fk_producto_id_categoria', as: 'productos' });

export default Producto;