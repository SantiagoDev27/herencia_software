import { PermisoRol } from "../models/NegocioModels.js";
import { CATALOGO_PERMISOS, CLAVES_PERMISOS, ROL_ADMIN } from "../configuration/permisos.js";
import AppError from "../utils/AppError.js";

// HU-SEG-007: permisos por rol, guardados en la tabla permiso_rol y en memoria
class PermisoService {
    constructor() {
        this.cache = null; // Map<idRol, Set<clave>>
    }

    async cargar() {
        const filas = await PermisoRol.findAll({ raw: true });
        const mapa = new Map();
        for (const f of filas) {
            if (!mapa.has(f.fk_permiso_id_rol)) mapa.set(f.fk_permiso_id_rol, new Set());
            mapa.get(f.fk_permiso_id_rol).add(f.permiso);
        }
        this.cache = mapa;
        return mapa;
    }

    async permisosDeRol(idRol) {
        if (Number(idRol) === ROL_ADMIN) return [...CLAVES_PERMISOS];
        if (!this.cache) await this.cargar();
        return [...(this.cache.get(Number(idRol)) ?? [])].filter((p) => CLAVES_PERMISOS.includes(p));
    }

    async tienePermiso(idRol, clave) {
        if (Number(idRol) === ROL_ADMIN) return true;
        if (!this.cache) await this.cargar();
        return this.cache.get(Number(idRol))?.has(clave) ?? false;
    }

    async matriz() {
        if (!this.cache) await this.cargar();
        const roles = [2, 3];
        return {
            catalogo: CATALOGO_PERMISOS.map(({ clave, grupo, nombre }) => ({ clave, grupo, nombre })),
            roles: roles.map((id) => ({ idrol: id, permisos: [...(this.cache.get(id) ?? [])] })),
        };
    }

    async guardar(idRol, permisos) {
        const rol = Number(idRol);
        if (![2, 3].includes(rol)) throw new AppError("Solo se pueden configurar los roles Vendedor (2) y Finanzas (3).", 400);
        const invalidos = permisos.filter((p) => !CLAVES_PERMISOS.includes(p));
        if (invalidos.length) throw new AppError(`Permisos desconocidos: ${invalidos.join(", ")}`, 400);

        const sequelize = PermisoRol.sequelize;
        await sequelize.transaction(async (transaction) => {
            await PermisoRol.destroy({ where: { fk_permiso_id_rol: rol }, transaction });
            if (permisos.length) {
                await PermisoRol.bulkCreate([...new Set(permisos)].map((p) => ({ fk_permiso_id_rol: rol, permiso: p })), { transaction });
            }
        });
        await this.cargar();
        return this.permisosDeRol(rol);
    }
}

export default new PermisoService();
