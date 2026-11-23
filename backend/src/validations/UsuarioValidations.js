import { body, param } from 'express-validator';

// Requisito 2.4.9: claves robustas -> mínimo 8 caracteres, con letras y números
const claveRobusta = (campo, opcional = false) => {
  let regla = body(campo);
  if (opcional) regla = regla.optional();
  else regla = regla.notEmpty().withMessage('La contraseña es obligatoria.');
  return regla
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres.')
    .isLength({ max: 255 }).withMessage('La contraseña no puede exceder los 255 caracteres.')
    .matches(/[A-Za-z]/).withMessage('La contraseña debe contener al menos una letra.')
    .matches(/\d/).withMessage('La contraseña debe contener al menos un número.');
};

const idParam = param('id').isInt({ min: 1 }).withMessage('El id del usuario no es válido.');

export const crearUsuarioValidation = [
  body('nombre_usuario')
    .trim()
    .notEmpty().withMessage('El nombre es obligatorio.')
    .isLength({ max: 100 }).withMessage('El nombre no puede exceder los 100 caracteres.'),

  body('apellido_usuario')
    .trim()
    .notEmpty().withMessage('El apellido es obligatorio.')
    .isLength({ max: 100 }).withMessage('El apellido no puede exceder los 100 caracteres.'),

  body('correo_usuario')
    .trim()
    .notEmpty().withMessage('El correo es obligatorio.')
    .isEmail().withMessage('El correo electrónico no es válido.')
    .isLength({ max: 150 }).withMessage('El correo no puede exceder los 150 caracteres.'),

  claveRobusta('contraseña_usuario'),

  body('telefono_usuario')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[0-9+\s-]{7,20}$/).withMessage('El teléfono solo puede tener números, espacios, + o - (7 a 20 caracteres).'),

  body('fk_usuario_id_rol')
    .notEmpty().withMessage('El rol es obligatorio.')
    .isInt({ min: 1, max: 3 }).withMessage('El rol debe ser Administrador (1), Vendedor (2) o Finanzas (3).')
];

// Se mantiene el nombre anterior por compatibilidad
export const registerValidation = crearUsuarioValidation;

export const updateValidations = [
  idParam,
  body('nombre_usuario')
    .optional()
    .trim()
    .notEmpty().withMessage('El nombre no puede estar vacío.')
    .isLength({ max: 100 }).withMessage('El nombre no puede exceder los 100 caracteres.'),

  body('apellido_usuario')
    .optional()
    .trim()
    .notEmpty().withMessage('El apellido no puede estar vacío.')
    .isLength({ max: 100 }).withMessage('El apellido no puede exceder los 100 caracteres.'),

  body('correo_usuario')
    .optional()
    .trim()
    .isEmail().withMessage('El correo electrónico no es válido.')
    .isLength({ max: 150 }).withMessage('El correo no puede exceder los 150 caracteres.'),

  claveRobusta('contraseña_usuario', true),

  body('telefono_usuario')
    .optional({ nullable: true, checkFalsy: true })
    .matches(/^[0-9+\s-]{7,20}$/).withMessage('El teléfono solo puede tener números, espacios, + o - (7 a 20 caracteres).'),

  body('fk_usuario_id_rol')
    .optional()
    .isInt({ min: 1, max: 3 }).withMessage('El rol debe ser Administrador (1), Vendedor (2) o Finanzas (3).')
];

export const estadoValidation = [
  idParam,
  body('activo').isBoolean().withMessage('El campo activo debe ser true o false.')
];

export const restablecerValidation = [
  idParam,
  claveRobusta('nueva_contrasena')
];

export const cambiarContrasenaValidation = [
  body('contrasena_actual').notEmpty().withMessage('Ingresa tu contraseña actual.'),
  claveRobusta('nueva_contrasena')
];

export const loginValidation = [
  body('correo_usuario')
    .trim()
    .notEmpty().withMessage('El correo es obligatorio.')
    .isEmail().withMessage('El correo electrónico no es válido.'),

  body('contraseña_usuario')
    .notEmpty().withMessage('La contraseña es obligatoria.')
];
