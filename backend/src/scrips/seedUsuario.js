import bcrypt from 'bcryptjs';
import sequelize from '../configuration/database.js';
import Rol from '../models/RolesModels.js';
import Usuario from '../models/UsuariosModels.js';
import Categoria from '../models/CategoriesModels.js';
import { prepararEsquemaSeguridad } from '../configuration/esquemaSeguridad.js';
import { prepararEsquemaNegocio } from '../configuration/esquemaNegocio.js';

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a la base de datos exitosa.');

    // Columnas de seguridad (estado, intentos, bloqueo) y tabla de auditoría, por si el servidor aún no se ha ejecutado
    await prepararEsquemaSeguridad(sequelize);
    await prepararEsquemaNegocio(sequelize);

    // 1. Asegurar los tres roles del sistema (si ya existían con otro nombre, se renombran)
    //    1 Administrador: todo · 2 Vendedor: ventas e inventario · 3 Finanzas: contabilidad
    const rolesData = [
      { idrol: 1, nombre_rol: 'Administrador', descripcion: 'Acceso total al sistema' },
      { idrol: 2, nombre_rol: 'Vendedor', descripcion: 'Ventas, inventario y proveedores' },
      { idrol: 3, nombre_rol: 'Finanzas', descripcion: 'Contabilidad: ventas, movimientos y reportes' },
    ];

    for (const r of rolesData) {
      const existente = await Rol.findByPk(r.idrol);
      if (!existente) {
        await Rol.create(r);
        console.log(`✨ Rol creado: ${r.nombre_rol}`);
      } else if (existente.nombre_rol !== r.nombre_rol || existente.descripcion !== r.descripcion) {
        const anterior = existente.nombre_rol;
        await existente.update({ nombre_rol: r.nombre_rol, descripcion: r.descripcion });
        console.log(`🔁 Rol ${r.idrol} actualizado: ${anterior} → ${r.nombre_rol}`);
      }
    }

    // 2. Asegurar categorías iniciales si no existen
    const catCount = await Categoria.count();
    if (catCount === 0) {
      const categoriasDefault = [
        { nombre_categoria: 'Lácteos y Derivados', descripcion: 'Quesos, leches, mantequillas' },
        { nombre_categoria: 'Cárnicos', descripcion: 'Carnes de res, cerdo, embutidos' },
        { nombre_categoria: 'Abarrotes', descripcion: 'Granos, harinas, aceites' },
        { nombre_categoria: 'Bebidas', descripcion: 'Jugos, gaseosas, aguas' },
      ];
      for (const cat of categoriasDefault) {
        await Categoria.create(cat);
      }
      console.log('✨ Categorías por defecto creadas.');
    }

    // 3. Un usuario inicial por cada rol (solo se crean si el correo no existe)
    const usuariosIniciales = [
      { nombre: 'Administrador', apellido: 'Sistema', correo: 'admin@herenciadepapa.com', clave: 'admin1234', telefono: '3001234567', rol: 1 },
      { nombre: 'Vendedor', apellido: 'Tienda', correo: 'vendedor@herenciadepapa.com', clave: 'vendedor1234', telefono: '3001234568', rol: 2 },
      { nombre: 'Finanzas', apellido: 'Contabilidad', correo: 'finanzas@herenciadepapa.com', clave: 'finanzas1234', telefono: '3001234569', rol: 3 },
    ];

    for (const u of usuariosIniciales) {
      const existe = await Usuario.findOne({ where: { correo_usuario: u.correo } });
      if (existe) {
        console.log(`ℹ️ El usuario ${u.correo} ya existe.`);
        continue;
      }
      await Usuario.create({
        nombre_usuario: u.nombre,
        apellido_usuario: u.apellido,
        correo_usuario: u.correo,
        contraseña_usuario: await bcrypt.hash(u.clave, 10),
        telefono_usuario: u.telefono,
        fk_usuario_id_rol: u.rol
      });
      console.log(`🎉 Usuario creado: ${u.correo} / ${u.clave}`);
    }

  } catch (error) {
    console.error('❌ Error durante el seed:', error);
  } finally {
    await sequelize.close();
  }
};

seed();
