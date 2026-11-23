import { Op } from 'sequelize';
import Usuario from '../models/UsuariosModels.js';
import Rol from '../models/RolesModels.js';

// Nunca se devuelve la contraseña fuera del login
const SIN_CLAVE = { exclude: ['contraseña_usuario'] };

class UsuarioRepository {
  // Crear un nuevo usuario
  async crear(datosUsuario) {
    return await Usuario.create(datosUsuario);
  }

  // Buscar un usuario por su correo electrónico (útil para login y validación de duplicados)
  async obtenerPorCorreo(correo_usuario) {
    return await Usuario.findOne({
      where: { correo_usuario },
      include: { model: Rol, as: 'rol' }
    });
  }

  // Buscar un usuario por su ID
  async obtenerPorId(idusuario, { conClave = false } = {}) {
    return await Usuario.findByPk(idusuario, {
      include: { model: Rol, as: 'rol' },
      ...(conClave ? {} : { attributes: SIN_CLAVE })
    });
  }

  // HU-SEG-005: listado para el administrador, con filtros opcionales
  async listar({ busqueda, rol, estado } = {}) {
    const where = {};
    if (rol) where.fk_usuario_id_rol = Number(rol);
    if (estado === 'activos') where.estado_usuario = true;
    if (estado === 'inactivos') where.estado_usuario = false;
    if (busqueda) {
      const texto = `%${busqueda}%`;
      where[Op.or] = [
        { nombre_usuario: { [Op.like]: texto } },
        { apellido_usuario: { [Op.like]: texto } },
        { correo_usuario: { [Op.like]: texto } }
      ];
    }
    return await Usuario.findAll({
      where,
      attributes: SIN_CLAVE,
      include: { model: Rol, as: 'rol' },
      order: [['idusuario', 'ASC']]
    });
  }

  async contarAdministradoresActivos() {
    return await Usuario.count({ where: { fk_usuario_id_rol: 1, estado_usuario: true } });
  }

  // Actualizar un usuario existente
  async actualizar(idusuario, datosActualizados) {
    const usuario = await Usuario.findByPk(idusuario);
    if (!usuario) return null;
    return await usuario.update(datosActualizados);
  }

  async listarRoles() {
    return await Rol.findAll({ order: [['idrol', 'ASC']] });
  }
}

export default new UsuarioRepository();
