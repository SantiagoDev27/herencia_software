import usuarioService from '../services/UsuarioService.js';

const ipDe = (req) => (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim() || null;

class UsuarioController {
  // POST /api/usuarios  (solo Administrador)
  async crearUsuario(req, res, next) {
    try {
      const usuario = await usuarioService.crearUsuario(req.body, req.usuario);
      return res.status(201).json({ success: true, message: 'Usuario creado exitosamente.', data: usuario });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/usuarios?busqueda=&rol=&estado=activos|inactivos
  async listarUsuarios(req, res, next) {
    try {
      const { busqueda, rol, estado } = req.query;
      const usuarios = await usuarioService.listarUsuarios({ busqueda, rol, estado });
      return res.status(200).json({ success: true, data: usuarios });
    } catch (error) {
      next(error);
    }
  }

  async obtenerUsuario(req, res, next) {
    try {
      const usuario = await usuarioService.obtenerUsuario(req.params.id);
      return res.status(200).json({ success: true, data: usuario });
    } catch (error) {
      next(error);
    }
  }

  async listarRoles(req, res, next) {
    try {
      return res.status(200).json({ success: true, data: await usuarioService.listarRoles() });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/login
  async login(req, res, next) {
    try {
      const { correo_usuario, contraseña_usuario } = req.body;
      const { token, usuario } = await usuarioService.loginUsuario(correo_usuario, contraseña_usuario, ipDe(req));
      return res.status(200).json({ success: true, message: 'Sesión iniciada exitosamente.', token, data: usuario });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/logout
  async logout(req, res, next) {
    try {
      await usuarioService.logout(req.usuario, ipDe(req));
      return res.status(200).json({ success: true, message: 'Sesión cerrada.' });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/perfil
  async perfil(req, res, next) {
    try {
      const usuario = await usuarioService.obtenerUsuario(req.usuario.idusuario);
      return res.status(200).json({ success: true, data: usuario });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/usuarios/:id
  async updateUsuario(req, res, next) {
    try {
      const usuario = await usuarioService.actualizarUsuario(req.params.id, { ...req.body }, req.usuario);
      return res.status(200).json({ success: true, message: 'Usuario actualizado exitosamente.', data: usuario });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/usuarios/:id/estado  { activo: true|false }
  async cambiarEstado(req, res, next) {
    try {
      const activo = req.body.activo === true || req.body.activo === 'true';
      const usuario = await usuarioService.cambiarEstado(req.params.id, activo, req.usuario);
      return res.status(200).json({
        success: true,
        message: activo ? 'Usuario activado.' : 'Usuario desactivado.',
        data: usuario
      });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/usuarios/:id/contrasena  { nueva_contrasena }
  async restablecerContrasena(req, res, next) {
    try {
      await usuarioService.restablecerContrasena(req.params.id, req.body.nueva_contrasena, req.usuario);
      return res.status(200).json({ success: true, message: 'Contraseña restablecida.' });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/auth/cambiar-contrasena  { contrasena_actual, nueva_contrasena }
  async cambiarContrasena(req, res, next) {
    try {
      await usuarioService.cambiarContrasena(req.usuario.idusuario, req.body.contrasena_actual, req.body.nueva_contrasena);
      return res.status(200).json({ success: true, message: 'Contraseña actualizada correctamente.' });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/usuarios/auditoria?limite=100
  async listarAuditoria(req, res, next) {
    try {
      return res.status(200).json({ success: true, data: await usuarioService.listarAuditoria(req.query.limite) });
    } catch (error) {
      next(error);
    }
  }
}

export default new UsuarioController();
