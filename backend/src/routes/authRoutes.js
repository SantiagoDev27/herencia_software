import { Router } from 'express';
import { loginValidation, cambiarContrasenaValidation } from '../validations/UsuarioValidations.js';
import { validarCampos } from '../middleware/validarCampos.middleware.js';
import { verificarToken } from '../middleware/authMiddleware.js';
import usuarioController from '../controllers/UsuarioController.js';

const router = Router();

// El registro público se eliminó: las cuentas las crea el Administrador en /api/usuarios

// HU-SEG-001 / 008 / 009: iniciar sesión
router.post('/login', loginValidation, validarCampos, usuarioController.login);

// HU-SEG-002: cerrar sesión (registra la auditoría)
router.post('/logout', verificarToken, usuarioController.logout);

// Datos del usuario autenticado
router.get('/perfil', verificarToken, usuarioController.perfil);

// HU-SEG-004: cambiar la propia contraseña
router.patch(
  '/cambiar-contrasena',
  verificarToken,
  cambiarContrasenaValidation,
  validarCampos,
  usuarioController.cambiarContrasena
);

export default router;
