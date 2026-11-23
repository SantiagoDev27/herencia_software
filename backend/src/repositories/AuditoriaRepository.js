import Auditoria from "../models/AuditoriaModel.js";

class AuditoriaRepository {
    // Nunca debe romper la operación principal: si falla, solo se informa en consola
    async registrar({ idusuario = null, correo = null, accion, detalle = null, ip = null }) {
        try {
            await Auditoria.create({
                fk_auditoria_id_usuario: idusuario,
                correo,
                accion,
                detalle: detalle ? String(detalle).slice(0, 255) : null,
                ip,
            });
        } catch (error) {
            console.error("⚠️ No se pudo registrar la auditoría:", error.message);
        }
    }

    async listar({ limite = 100 } = {}) {
        return await Auditoria.findAll({
            order: [["fecha", "DESC"], ["id_auditoria", "DESC"]],
            limit: Math.min(Number(limite) || 100, 500),
        });
    }
}

export default new AuditoriaRepository();
