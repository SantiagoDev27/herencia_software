import { Router } from 'express';
import { verificarToken, permitirRoles } from '../middleware/authMiddleware.js';
import { OPERACION } from '../configuration/roles.js';
import { createProductValidation, updateProductValidation, deleteProductValidation, obtenerProductosProximosAVencer } from '../validations/ProductoValidations.js';
import { validarCampos } from '../middleware/validarCampos.middleware.js';
import productoController from '../controllers/ProductoController.js';

const router = Router();

// Toda ruta exige sesión iniciada; por defecto la consulta queda abierta a los tres roles
router.use(verificarToken);

// ============================================
// HU-INV-006: Consultar existencias
// (rutas específicas van ANTES de /:id para que Express no las confunda)
// ============================================

router.get(
  '/con-stock',
  productoController.listarProductosConStock
);

router.get(
  '/sin-stock',
  productoController.listarProductosSinStock
);

router.get(
  '/stock-bajo',
  productoController.listarProductosStockBajo
);

router.get(
  '/codigo/:codigo',
  productoController.obtenerProductoPorCodigo
);

router.get(
  '/',
  productoController.listarProductos
);

// HU-INV-01: Registrar producto
router.post(
  '/',
  createProductValidation,
  validarCampos,
  permitirRoles(...OPERACION),
  productoController.registrarProducto
);

// HU-INV-02: Actualizar producto
router.put(
  '/:id',
  updateProductValidation,
  validarCampos,
  permitirRoles(...OPERACION),
  productoController.actualizarProducto
);

// HU-INV-03: Eliminar producto
router.delete(
  '/:id',
  deleteProductValidation,
  validarCampos,
  permitirRoles(...OPERACION),
  productoController.eliminarProducto
);

// ============================================
// HU-INV-007: Consultar productos próximos a vencer
// ============================================
router.get(
  '/proximos-vencer',
  obtenerProductosProximosAVencer,
  validarCampos,
  productoController.obtenerProductosProximosAVencer
);

export default router;