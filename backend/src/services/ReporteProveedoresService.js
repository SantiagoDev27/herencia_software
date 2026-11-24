import { Op } from "sequelize";
import Proveedor from "../models/ProovedorModel.js";
import ProductoProveedor from "../models/Producto-ProovedorModel.js";
import { OrdenCompra, EvaluacionProveedor } from "../models/NegocioModels.js";
import ContabilidadRepository from "../repositories/ContabilidadRepository.js";
import AppError from "../utils/AppError.js";
import { rangoPorDefecto } from "./ReporteVentasService.js";
import { redondear, fechaLocalISO } from "../utils/fechas.js";

// HU-PROV-008: compras, cumplimiento y desempeño por proveedor en un periodo
class ReporteProveedoresService {
    async generar({ fechaInicio, fechaFin } = {}) {
        const defecto = rangoPorDefecto();
        const inicio = fechaInicio || defecto.fechaInicio;
        const fin = fechaFin || defecto.fechaFin;
        if (inicio > fin) throw new AppError("La fecha inicial no puede ser posterior a la fecha final.", 400);

        const proveedores = await Proveedor.findAll({ paranoid: false, order: [["razon_social", "ASC"]] });
        const ordenes = await OrdenCompra.findAll({ where: { [Op.and]: ContabilidadRepository.condicionFechas(inicio, fin, "OrdenCompra.fecha") }, raw: true });
        const evaluaciones = await EvaluacionProveedor.findAll({ raw: true, order: [["fecha", "DESC"]] });
        const productos = await ProductoProveedor.findAll({ raw: true });

        const filas = proveedores.map((p) => {
            const os = ordenes.filter((o) => Number(o.fk_orden_compra_id_proveedor) === Number(p.id_proveedor));
            const recibidas = os.filter((o) => o.estado === "Recibida");
            const pendientes = os.filter((o) => o.estado === "Pendiente");
            const canceladas = os.filter((o) => o.estado === "Cancelada");
            const a_tiempo = recibidas.filter((o) => !o.fecha_entrega_estimada
                || fechaLocalISO(new Date(o.fecha_recepcion)) <= String(o.fecha_entrega_estimada).slice(0, 10));
            const evs = evaluaciones.filter((e) => Number(e.fk_evaluacion_id_proveedor) === Number(p.id_proveedor));
            const promedio = evs.length ? evs.reduce((a, e) => a + Number(e.calificacion), 0) / evs.length : null;
            const validas = os.length - canceladas.length;
            return {
                id_proveedor: p.id_proveedor,
                razon_social: p.razon_social,
                nit: p.nit,
                ciudad: p.ciudad,
                activo: !p.deleted_at,
                productos: productos.filter((x) => Number(x.fk_producto_proveedor_id_proveedor) === Number(p.id_proveedor)).length,
                ordenes: os.length,
                recibidas: recibidas.length,
                pendientes: pendientes.length,
                canceladas: canceladas.length,
                total_comprado: redondear(recibidas.reduce((a, o) => a + Number(o.total), 0)),
                cumplimiento: validas ? redondear((recibidas.length / validas) * 100) : null,
                entregas_a_tiempo: recibidas.length ? redondear((a_tiempo.length / recibidas.length) * 100) : null,
                calificacion: promedio === null ? null : redondear(promedio),
                evaluaciones: evs.length,
            };
        });

        return {
            periodo: { fechaInicio: inicio, fechaFin: fin },
            resumen: {
                proveedores: filas.filter((f) => f.activo).length,
                ordenes: ordenes.length,
                total_comprado: redondear(filas.reduce((a, f) => a + f.total_comprado, 0)),
                pendientes: filas.reduce((a, f) => a + f.pendientes, 0),
            },
            proveedores: filas.sort((a, b) => b.total_comprado - a.total_comprado),
        };
    }
}

export default new ReporteProveedoresService();
