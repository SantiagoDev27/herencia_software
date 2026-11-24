import { fn, col } from "sequelize";
import Proveedor from "../models/ProovedorModel.js";
import { EvaluacionProveedor } from "../models/NegocioModels.js";
import AuditoriaRepository from "../repositories/AuditoriaRepository.js";
import AppError from "../utils/AppError.js";
import { redondear } from "../utils/fechas.js";

// HU-PROV-007: Evaluar proveedores (cumplimiento, calidad y tiempo de respuesta de 1 a 5)
export default {
    async crear(req, res, next) {
        try {
            const proveedor = await Proveedor.findByPk(req.params.id_proveedor);
            if (!proveedor) throw new AppError("Proveedor no encontrado.", 404);
            const { cumplimiento, calidad, tiempo_respuesta, observaciones } = req.body;
            const calificacion = redondear((Number(cumplimiento) + Number(calidad) + Number(tiempo_respuesta)) / 3);
            const evaluacion = await EvaluacionProveedor.create({
                fk_evaluacion_id_proveedor: proveedor.id_proveedor,
                fecha: new Date(),
                cumplimiento, calidad, tiempo_respuesta, calificacion,
                observaciones: observaciones || null,
                fk_evaluacion_id_usuario: req.usuario.idusuario,
            });
            await AuditoriaRepository.registrar({ idusuario: req.usuario.idusuario, correo: req.usuario.correo_usuario, accion: "EVALUAR_PROVEEDOR", detalle: `${proveedor.razon_social}: ${calificacion}/5` });
            return res.status(201).json({ success: true, message: "Evaluación registrada.", data: evaluacion });
        } catch (error) {
            next(error);
        }
    },

    async listar(req, res, next) {
        try {
            const data = await EvaluacionProveedor.findAll({
                where: { fk_evaluacion_id_proveedor: req.params.id_proveedor },
                include: [{ association: "usuario", attributes: ["nombre_usuario", "apellido_usuario"] }],
                order: [["fecha", "DESC"]],
            });
            return res.json({ success: true, data });
        } catch (error) {
            next(error);
        }
    },

    // Promedio y número de evaluaciones por proveedor
    async resumen(req, res, next) {
        try {
            const filas = await EvaluacionProveedor.findAll({
                attributes: ["fk_evaluacion_id_proveedor", [fn("AVG", col("calificacion")), "promedio"], [fn("COUNT", "*"), "evaluaciones"]],
                group: ["fk_evaluacion_id_proveedor"],
                raw: true,
            });
            return res.json({ success: true, data: filas.map((f) => ({ id_proveedor: f.fk_evaluacion_id_proveedor, promedio: redondear(f.promedio), evaluaciones: Number(f.evaluaciones) })) });
        } catch (error) {
            next(error);
        }
    },
};
