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
import { permisosValidation } from '../validations/NegocioValidations.js';
import PermisoService from '../services/PermisoService.js';
import AuditoriaRepository from '../repositories/AuditoriaRepository.js';

const router = Router();

// HU-SEG-005 / 006 / 010: toda la gestión de usuarios es exclusiva del Administrador
router.use(verificarToken, esAdmin);

router.get('/roles', usuarioController.listarRoles);
router.get('/auditoria', usuarioController.listarAuditoria);

// HU-SEG-007: permisos configurables por rol
router.get('/permisos', async (req, res, next) => {
  try {
    res.json({ success: true, data: await PermisoService.matriz() });
  } catch (error) {
    next(error);
  }
});
router.put('/permisos/:idrol', permisosValidation, validarCampos, async (req, res, next) => {
  try {
    const permisos = await PermisoService.guardar(req.params.idrol, req.body.permisos);
    await AuditoriaRepository.registrar({ idusuario: req.usuario.idusuario, correo: req.usuario.correo_usuario, accion: 'CAMBIAR_PERMISOS', detalle: `Rol ${req.params.idrol}: ${permisos.length} permisos` });
    res.json({ success: true, message: 'Permisos actualizados.', data: permisos });
  } catch (error) {
    next(error);
  }
});

router.get('/', usuarioController.listarUsuarios);
router.post('/', crearUsuarioValidation, validarCampos, usuarioController.crearUsuario);
router.get('/:id', usuarioController.obtenerUsuario);
router.put('/:id', updateValidations, validarCampos, usuarioController.updateUsuario);
router.patch('/:id/estado', estadoValidation, validarCampos, usuarioController.cambiarEstado);
router.patch('/:id/contrasena', restablecerValidation, validarCampos, usuarioController.restablecerContrasena);

export default router;
