import jwt from 'jsonwebtoken';
import AppError from '../utils/AppError.js';
import { ROLES, rolNormalizado } from '../configuration/roles.js';
import Usuario from '../models/UsuariosModels.js';

// Middleware para verificar el token de jsonwebtoken
export const verificarToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Verificar si viene el header de autorización 
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Acceso denegado. No se proporcionó un token válido.', 401));
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    const jwtSecret = process.env.JWT_SECRET || 'secret_key_por_defecto_12345';
    decoded = jwt.verify(token, jwtSecret);
  } catch (error) {
    return next(new AppError('Token inválido o expirado.', 401));
  }

  // HU-SEG-005: si el administrador desactivó la cuenta (o cambió el rol), el token deja de
  // servir de inmediato, sin esperar a que expire.
  try {
    const usuario = await Usuario.findByPk(decoded.idusuario, {
      attributes: ['idusuario', 'estado_usuario', 'fk_usuario_id_rol']
    });
    if (!usuario || usuario.estado_usuario === false) {
      return next(new AppError('Tu cuenta no está activa. Inicia sesión nuevamente.', 401));
    }
    if (Number(usuario.fk_usuario_id_rol) !== Number(decoded.fk_usuario_id_rol)) {
      decoded = { ...decoded, fk_usuario_id_rol: usuario.fk_usuario_id_rol, rol: null };
    }
  } catch (error) {
    return next(error);
  }

  req.usuario = decoded;
  next();
};

// Solo el Administrador (antes comparaba con "Admin", que no existe en la tabla de roles)
export const esAdmin = (req, res, next) => {
  if (!req.usuario) {
    return next(new AppError('No autenticado.', 401));
  }

  if (rolNormalizado(req.usuario) !== ROLES.ADMINISTRADOR) {
    return next(new AppError('No tienes permisos para realizar esta acción.', 403));
  }

  next();
};  

export const permitirRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return next(new AppError('No autenticado.', 401));
    }

    // Verificar si el rol del usuario está dentro de los permitidos
    if (!rolesPermitidos.includes(rolNormalizado(req.usuario))) {
      return next(new AppError('No tienes permisos para realizar esta acción.', 403));
    }

    next();
  };
};
