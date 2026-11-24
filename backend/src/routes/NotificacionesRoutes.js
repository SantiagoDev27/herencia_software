import {Router} from 'express';
import { verificarToken } from '../middleware/authMiddleware.js';
import NotificacionController from '../controllers/NotificacionController.js';

const router = Router();

// Toda ruta exige sesión iniciada; por defecto la consulta queda abierta a los tres roles
router.use(verificarToken);

// ============================================
// HU-INV-007: Consultar productos próximos a vencer
// ============================================
router.get(
  '/stock-minimo',
  NotificacionController.notificarStockMinimo
);

router.get(
  '/productos-proximos-vencer',
  NotificacionController.notificarProductosProximosAVencer
);

router.get(
  '/productos-agotados',
  NotificacionController.notificarProductosAgotados
);

export default router;