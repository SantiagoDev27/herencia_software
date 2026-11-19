import { Op } from "sequelize";
import Proveedor from "../models/ProovedorModel.js";

class ProveedorRepository {

    async crear(datosProveedor) {
        return await Proveedor.create(datosProveedor);
    }

    async obtenerTodos() {
        return await Proveedor.findAll();
    }

    async obtenerPorId(id_proveedor) {
        return await Proveedor.findByPk(id_proveedor);
    }

    // Busca por el número base del NIT, con o sin dígito de verificación:
    // "900123456" y "900123456-8" se consideran el mismo proveedor.
    async obtenerPorNit(nit) {
        const base = String(nit).split("-")[0];
        return await Proveedor.findOne({
            where: { [Op.or]: [{ nit: base }, { nit: { [Op.like]: `${base}-%` } }] }
        });
    }

    async actualizar(id_proveedor, datosActualizados) {
        const proveedor = await Proveedor.findByPk(id_proveedor);
        if (!proveedor) return null;
        return await proveedor.update(datosActualizados);
    }

    // Eliminación lógica (soft delete) — gracias a paranoid: true,
    // esto llena deleted_at en vez de borrar el registro físicamente
    async eliminar(id_proveedor) {
        const proveedor = await Proveedor.findByPk(id_proveedor);
        if (!proveedor) return null;
        await proveedor.destroy();
        return proveedor;
    }

    // Por si necesitas reactivar un proveedor eliminado lógicamente
    async restaurar(id_proveedor) {
        const proveedor = await Proveedor.findByPk(id_proveedor, { paranoid: false });
        if (!proveedor) return null;
        await proveedor.restore();
        return proveedor;
    }

    async contarProveedores() {
        return await Proveedor.count();
    }
}

export default new ProveedorRepository();