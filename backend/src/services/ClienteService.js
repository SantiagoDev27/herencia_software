import { Op } from "sequelize";
import Cliente from "../models/clienteModel.js";
import Venta from "../models/VentaModel.js";
import AppError from "../utils/AppError.js";

const CAMPOS = ["identificacion", "nombre_cliente", "apellido_cliente", "telefono_cliente", "correo_cliente", "direccion_cliente", "ciudad_cliente"];
const limpiar = (datos) => Object.fromEntries(CAMPOS.filter((c) => datos[c] !== undefined).map((c) => [c, datos[c] === "" ? null : datos[c]]));

// HU-VEN-006: Gestionar clientes
class ClienteService {
    async listar({ busqueda } = {}) {
        const where = {};
        if (busqueda) {
            const t = `%${busqueda}%`;
            where[Op.or] = [
                { nombre_cliente: { [Op.like]: t } },
                { apellido_cliente: { [Op.like]: t } },
                { correo_cliente: { [Op.like]: t } },
                Cliente.sequelize.where(Cliente.sequelize.cast(Cliente.sequelize.col("identificacion"), "CHAR"), { [Op.like]: t }),
            ];
        }
        const clientes = await Cliente.findAll({ where, order: [["nombre_cliente", "ASC"]] });
        // Número de compras y total comprado (excluye anuladas)
        const resumen = await Venta.findAll({
            attributes: ["fk_venta_id_cliente", [Venta.sequelize.fn("COUNT", "*"), "compras"], [Venta.sequelize.fn("SUM", Venta.sequelize.col("total")), "total"]],
            where: { fk_venta_id_cliente: { [Op.ne]: null }, estado_venta: { [Op.ne]: "Anulada" } },
            group: ["fk_venta_id_cliente"],
            raw: true,
        });
        const mapa = new Map(resumen.map((r) => [Number(r.fk_venta_id_cliente), r]));
        return clientes.map((c) => ({
            ...c.toJSON(),
            compras: Number(mapa.get(c.id_cliente)?.compras ?? 0),
            total_comprado: Number(mapa.get(c.id_cliente)?.total ?? 0),
        }));
    }

    async obtener(id) {
        const cliente = await Cliente.findByPk(id);
        if (!cliente) throw new AppError(`El cliente con id ${id} no existe.`, 404);
        return cliente;
    }

    async _identificacionLibre(identificacion, exceptoId = null) {
        const existe = await Cliente.findOne({ where: { identificacion } });
        if (existe && Number(existe.id_cliente) !== Number(exceptoId)) {
            throw new AppError(`Ya existe un cliente con la identificación ${identificacion}.`, 409);
        }
    }

    async crear(datos) {
        await this._identificacionLibre(datos.identificacion);
        return await Cliente.create(limpiar(datos));
    }

    async actualizar(id, datos) {
        const cliente = await this.obtener(id);
        if (datos.identificacion !== undefined) await this._identificacionLibre(datos.identificacion, id);
        return await cliente.update(limpiar(datos));
    }

    // Solo se elimina si no tiene ventas (integridad del historial)
    async eliminar(id) {
        const cliente = await this.obtener(id);
        const ventas = await Venta.count({ where: { fk_venta_id_cliente: id } });
        if (ventas > 0) throw new AppError(`No se puede eliminar: el cliente tiene ${ventas} venta(s) registradas.`, 409);
        await cliente.destroy();
        return cliente;
    }
}

export default new ClienteService();
