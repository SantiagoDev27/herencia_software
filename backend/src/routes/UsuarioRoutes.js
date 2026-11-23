import { Router } from 'express';
import { verificarToken, esAdmin } from '../middleware/authMiddleware.js';
import { validarCampos } from '../middleware/validarCampos.middleware.js';
import {
  crearUsuarioValidation,
  updateValidations,
  estadoValidation,
  restablecerValidation
} from '../validations/UsuarioValidations.js';
import usuarioController from '../controllers/UsuarioController.js';

const router = Router();

// HU-SEG-005 / 006 / 010: toda la gestión de usuarios es exclusiva del Administrador
router.use(verificarToken, esAdmin);

router.get('/roles', usuarioController.listarRoles);
router.get('/auditoria', usuarioController.listarAuditoria);

router.get('/', usuarioController.listarUsuarios);
router.post('/', crearUsuarioValidation, validarCampos, usuarioController.crearUsuario);
router.get('/:id', usuarioController.obtenerUsuario);
router.put('/:id', updateValidations, validarCampos, usuarioController.updateUsuario);
router.patch('/:id/estado', estadoValidation, validarCampos, usuarioController.cambiarEstado);
router.patch('/:id/contrasena', restablecerValidation, validarCampos, usuarioController.restablecerContrasena);

export default router;
