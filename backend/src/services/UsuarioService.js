import usuarioRepository from '../repositories/UsuarioRepositories.js';
import rolesRepository from '../repositories/RolesRepositories.js';
import auditoriaRepository from '../repositories/AuditoriaRepository.js';
import AppError from '../utils/AppError.js';
import { generarToken } from '../utils/jwt.js';
import { ROLES_ASIGNABLES } from '../configuration/roles.js';
import bcrypt from 'bcryptjs';
import PermisoService from './PermisoService.js';

// HU-SEG-009: después de MAX_INTENTOS fallidos seguidos la cuenta se bloquea MINUTOS_BLOQUEO minutos
export const MAX_INTENTOS = Number(process.env.MAX_INTENTOS_LOGIN) || 5;
export const MINUTOS_BLOQUEO = Number(process.env.MINUTOS_BLOQUEO_LOGIN) || 15;
const SALT_ROUNDS = 10;

const sinClave = (usuario) => {
  const json = usuario.toJSON();
  delete json.contraseña_usuario;
  return json;
};

class UsuarioService {
  // ============================================
  // HU-SEG-005 / HU-SEG-006: el administrador crea usuarios (Vendedor o Finanzas, o otro administrador).
  // Ya no existe registro público: la cuenta la crea el administrador y no inicia sesión por sí sola.
  // ============================================
  async crearUsuario(datos, admin = null) {
    const {
      nombre_usuario,
      apellido_usuario,
      correo_usuario,
      contraseña_usuario,
      telefono_usuario,
      fk_usuario_id_rol
    } = datos;

    const idRol = Number(fk_usuario_id_rol);
    if (!ROLES_ASIGNABLES.includes(idRol)) {
      throw new AppError('El rol seleccionado no es válido.', 400);
    }
    const rolExistente = await rolesRepository.obtenerPorId(idRol);
    if (!rolExistente) {
      throw new AppError(`El rol con id ${idRol} no existe.`, 404);
    }

    const correo = String(correo_usuario).trim().toLowerCase();
    const usuarioExistente = await usuarioRepository.obtenerPorCorreo(correo);
    if (usuarioExistente) {
      throw new AppError(`El correo '${correo}' ya está registrado.`, 409);
    }

    const nuevoUsuario = await usuarioRepository.crear({
      nombre_usuario: nombre_usuario.trim(),
      apellido_usuario: apellido_usuario.trim(),
      correo_usuario: correo,
      contraseña_usuario: await bcrypt.hash(contraseña_usuario, SALT_ROUNDS),
      telefono_usuario: telefono_usuario || null,
      fk_usuario_id_rol: idRol,
      estado_usuario: true,
      intentos_fallidos: 0
    });

    await auditoriaRepository.registrar({
      idusuario: admin?.idusuario,
      correo: admin?.correo_usuario,
      accion: 'CREAR_USUARIO',
      detalle: `Creó a ${correo} con rol ${rolExistente.nombre_rol}`
    });

    return await usuarioRepository.obtenerPorId(nuevoUsuario.idusuario);
  }

  async listarUsuarios(filtros) {
    return await usuarioRepository.listar(filtros);
  }

  async listarRoles() {
    return await usuarioRepository.listarRoles();
  }

  async obtenerUsuario(idusuario) {
    const usuario = await usuarioRepository.obtenerPorId(idusuario);
    if (!usuario) throw new AppError(`El usuario con id ${idusuario} no existe.`, 404);
    return usuario;
  }

  // ============================================
  // HU-SEG-001 / HU-SEG-008 / HU-SEG-009: iniciar sesión validando credenciales,
  // estado de la cuenta y bloqueo por intentos fallidos.
  // ============================================
  async loginUsuario(correo_usuario, contraseña_usuario, ip = null) {
    const correo = String(correo_usuario).trim().toLowerCase();
    const usuario = await usuarioRepository.obtenerPorCorreo(correo);

    if (!usuario) {
      await auditoriaRepository.registrar({ correo, accion: 'LOGIN_FALLIDO', detalle: 'Correo no registrado', ip });
      throw new AppError('Credenciales incorrectas.', 401);
    }

    if (usuario.estado_usuario === false) {
      await auditoriaRepository.registrar({ idusuario: usuario.idusuario, correo, accion: 'LOGIN_RECHAZADO', detalle: 'Cuenta desactivada', ip });
      throw new AppError('Tu cuenta está desactivada. Comunícate con el administrador.', 403);
    }

    const ahora = new Date();
    if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > ahora) {
      const minutos = Math.ceil((new Date(usuario.bloqueado_hasta) - ahora) / 60000);
      throw new AppError(`Cuenta bloqueada temporalmente por intentos fallidos. Intenta de nuevo en ${minutos} minuto(s).`, 423);
    }

    const passwordValido = await bcrypt.compare(contraseña_usuario, usuario.contraseña_usuario ?? '');
    if (!passwordValido) {
      const intentos = (Number(usuario.intentos_fallidos) || 0) + 1;
      const cambios = { intentos_fallidos: intentos };
      // Mismo mensaje que con un correo inexistente: no se revela qué cuentas existen
      let mensaje = 'Credenciales incorrectas.';

      if (intentos >= MAX_INTENTOS) {
        cambios.intentos_fallidos = 0;
        cambios.bloqueado_hasta = new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60000);
        mensaje = `Demasiados intentos fallidos. La cuenta quedó bloqueada ${MINUTOS_BLOQUEO} minutos.`;
        await auditoriaRepository.registrar({ idusuario: usuario.idusuario, correo, accion: 'CUENTA_BLOQUEADA', detalle: `${MAX_INTENTOS} intentos fallidos`, ip });
      } else {
        await auditoriaRepository.registrar({ idusuario: usuario.idusuario, correo, accion: 'LOGIN_FALLIDO', detalle: `Intento ${intentos} de ${MAX_INTENTOS}`, ip });
      }

      await usuarioRepository.actualizar(usuario.idusuario, cambios);
      throw new AppError(mensaje, 401);
    }

    await usuarioRepository.actualizar(usuario.idusuario, {
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      ultimo_acceso: ahora
    });
    await auditoriaRepository.registrar({ idusuario: usuario.idusuario, correo, accion: 'LOGIN', detalle: 'Inicio de sesión exitoso', ip });

    const token = generarToken(usuario);
    const usuarioFormateado = sinClave(usuario);
    usuarioFormateado.ultimo_acceso = ahora;
    usuarioFormateado.permisos = await PermisoService.permisosDeRol(usuario.fk_usuario_id_rol);

    return { token, usuario: usuarioFormateado };
  }

  // HU-SEG-002: cerrar sesión (el token se descarta en el cliente; aquí queda la auditoría)
  async logout(usuarioToken, ip = null) {
    await auditoriaRepository.registrar({
      idusuario: usuarioToken?.idusuario,
      correo: usuarioToken?.correo_usuario,
      accion: 'LOGOUT',
      detalle: 'Cierre de sesión',
      ip
    });
  }

  // ============================================
  // HU-SEG-005: modificar usuario (datos y rol)
  // ============================================
  async actualizarUsuario(idUsuario, datos, admin = null) {
    const usuario = await usuarioRepository.obtenerPorId(idUsuario);
    if (!usuario) {
      throw new AppError(`El usuario con id ${idUsuario} no existe.`, 404);
    }

    if (datos.fk_usuario_id_rol !== undefined) {
      const idRol = Number(datos.fk_usuario_id_rol);
      if (!ROLES_ASIGNABLES.includes(idRol) || !(await rolesRepository.obtenerPorId(idRol))) {
        throw new AppError('El rol seleccionado no es válido.', 400);
      }
      // No se puede dejar el sistema sin administradores activos
      if (usuario.fk_usuario_id_rol === 1 && idRol !== 1 && (await usuarioRepository.contarAdministradoresActivos()) <= 1) {
        throw new AppError('Debe existir al menos un administrador activo.', 409);
      }
      datos.fk_usuario_id_rol = idRol;
    }

    if (datos.correo_usuario) {
      datos.correo_usuario = String(datos.correo_usuario).trim().toLowerCase();
      const usuarioExistente = await usuarioRepository.obtenerPorCorreo(datos.correo_usuario);
      if (usuarioExistente && usuarioExistente.idusuario !== parseInt(idUsuario, 10)) {
        throw new AppError(`El correo '${datos.correo_usuario}' ya está registrado.`, 409);
      }
    }

    if (datos.contraseña_usuario) {
      datos.contraseña_usuario = await bcrypt.hash(datos.contraseña_usuario, SALT_ROUNDS);
    }

    const camposPermitidos = [
      'nombre_usuario',
      'apellido_usuario',
      'correo_usuario',
      'contraseña_usuario',
      'telefono_usuario',
      'fk_usuario_id_rol'
    ];

    const datosAActualizar = {};
    camposPermitidos.forEach((campo) => {
      if (datos[campo] !== undefined) datosAActualizar[campo] = datos[campo];
    });

    await usuarioRepository.actualizar(idUsuario, datosAActualizar);
    await auditoriaRepository.registrar({
      idusuario: admin?.idusuario,
      correo: admin?.correo_usuario,
      accion: 'ACTUALIZAR_USUARIO',
      detalle: `Actualizó al usuario #${idUsuario} (${Object.keys(datosAActualizar).filter((c) => c !== 'contraseña_usuario').join(', ') || 'contraseña'})`
    });

    return await usuarioRepository.obtenerPorId(idUsuario);
  }

  // HU-SEG-005: activar / desactivar (no se borran usuarios para conservar el historial de ventas)
  async cambiarEstado(idUsuario, activo, admin = null) {
    const usuario = await usuarioRepository.obtenerPorId(idUsuario);
    if (!usuario) throw new AppError(`El usuario con id ${idUsuario} no existe.`, 404);

    if (!activo && Number(admin?.idusuario) === Number(idUsuario)) {
      throw new AppError('No puedes desactivar tu propia cuenta.', 409);
    }
    if (!activo && usuario.fk_usuario_id_rol === 1 && (await usuarioRepository.contarAdministradoresActivos()) <= 1) {
      throw new AppError('Debe existir al menos un administrador activo.', 409);
    }

    await usuarioRepository.actualizar(idUsuario, {
      estado_usuario: !!activo,
      ...(activo ? { intentos_fallidos: 0, bloqueado_hasta: null } : {})
    });
    await auditoriaRepository.registrar({
      idusuario: admin?.idusuario,
      correo: admin?.correo_usuario,
      accion: activo ? 'ACTIVAR_USUARIO' : 'DESACTIVAR_USUARIO',
      detalle: `Usuario ${usuario.correo_usuario}`
    });
    return await usuarioRepository.obtenerPorId(idUsuario);
  }

  // HU-SEG-003: recuperación de contraseña asistida por el administrador (asigna una clave temporal)
  async restablecerContrasena(idUsuario, nuevaContrasena, admin = null) {
    const usuario = await usuarioRepository.obtenerPorId(idUsuario);
    if (!usuario) throw new AppError(`El usuario con id ${idUsuario} no existe.`, 404);

    await usuarioRepository.actualizar(idUsuario, {
      contraseña_usuario: await bcrypt.hash(nuevaContrasena, SALT_ROUNDS),
      intentos_fallidos: 0,
      bloqueado_hasta: null
    });
    await auditoriaRepository.registrar({
      idusuario: admin?.idusuario,
      correo: admin?.correo_usuario,
      accion: 'RESTABLECER_CONTRASEÑA',
      detalle: `Contraseña restablecida para ${usuario.correo_usuario}`
    });
  }

  // HU-SEG-004: el propio usuario cambia su contraseña conociendo la actual
  async cambiarContrasena(idUsuario, actual, nueva) {
    const usuario = await usuarioRepository.obtenerPorId(idUsuario, { conClave: true });
    if (!usuario) throw new AppError('Usuario no encontrado.', 404);

    const valida = await bcrypt.compare(actual, usuario.contraseña_usuario ?? '');
    if (!valida) throw new AppError('La contraseña actual no es correcta.', 400);
    if (actual === nueva) throw new AppError('La nueva contraseña debe ser diferente a la actual.', 400);

    await usuarioRepository.actualizar(idUsuario, {
      contraseña_usuario: await bcrypt.hash(nueva, SALT_ROUNDS)
    });
    await auditoriaRepository.registrar({
      idusuario: usuario.idusuario,
      correo: usuario.correo_usuario,
      accion: 'CAMBIAR_CONTRASEÑA',
      detalle: 'El usuario cambió su contraseña'
    });
  }

  async listarAuditoria(limite) {
    return await auditoriaRepository.listar({ limite });
  }
}

export default new UsuarioService();
