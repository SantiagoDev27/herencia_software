import VentaRepository from "../repositories/VentaRepositories.js";
import AppError from "../utils/AppError.js";
import sequelize from "../configuration/database.js";

// Fecha local YYYY-MM-DD (toISOString usa UTC y en Colombia adelanta el día después de las 7 p. m.)
const fechaLocalISO = (fecha = new Date()) => {
    const d = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
    return d.toISOString().split("T")[0];
};

const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Por defecto el reporte cubre el último mes (30 días hasta hoy)
export const rangoPorDefecto = () => {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - 30);
    return { fechaInicio: fechaLocalISO(inicio), fechaFin: fechaLocalISO(hoy) };
};

class ReporteVentasService {

    // ============================================
    // HU-VEN-008 / HU-CON-008: Reporte general de ventas (Finanzas)
    // Requisitos 2.2.3.8, 3.3.1 (informe de ventas diario) y 3.3.2 (IVA diario)
    // ============================================
    async generarReporteVentas({ fechaInicio, fechaFin } = {}) {
        const defecto = rangoPorDefecto();
        const inicio = fechaInicio && ES_FECHA.test(fechaInicio) ? fechaInicio : defecto.fechaInicio;
        const fin = fechaFin && ES_FECHA.test(fechaFin) ? fechaFin : defecto.fechaFin;

        if (inicio > fin) {
            throw new AppError("La fecha inicial no puede ser posterior a la fecha final.", 400);
        }

        const ventas = await VentaRepository.obtenerParaReporte({ fechaInicio: inicio, fechaFin: fin });

        const resumen = {
            cantidadVentas: ventas.length,
            unidadesVendidas: 0,
            subtotal: 0,
            iva: 0,
            descuentos: 0,
            totalVentas: 0,
            costoVentas: 0,
            devoluciones: 0,
            cantidadDevoluciones: 0,
            totalNeto: 0,
            utilidadBruta: 0,
            margenBruto: 0,
            ticketPromedio: 0,
        };

        const porDia = new Map();
        const porProducto = new Map();
        const porVendedor = new Map();

        const listado = ventas.map((venta) => {
            const v = venta.toJSON();
            const detalles = v.detalles_venta ?? [];

            const unidades = detalles.reduce((acc, d) => acc + Number(d.cantidad || 0), 0);
            const costo = detalles.reduce(
                (acc, d) => acc + Number(d.cantidad || 0) * Number(d.producto?.costo_produccion || 0),
                0
            );

            resumen.unidadesVendidas += unidades;
            resumen.subtotal += Number(v.subtotal || 0);
            resumen.iva += Number(v.iva || 0);
            resumen.descuentos += Number(v.descuento || 0);
            resumen.totalVentas += Number(v.total || 0);
            resumen.costoVentas += costo;

            // Por día (informe diario de ventas e IVA)
            const dia = String(v.fecha).slice(0, 10);
            const d = porDia.get(dia) ?? { fecha: dia, cantidadVentas: 0, subtotal: 0, iva: 0, total: 0 };
            d.cantidadVentas += 1;
            d.subtotal += Number(v.subtotal || 0);
            d.iva += Number(v.iva || 0);
            d.total += Number(v.total || 0);
            porDia.set(dia, d);

            // Por producto
            for (const det of detalles) {
                const id = det.fk_det_venta_id_producto;
                const p = porProducto.get(id) ?? {
                    id_producto: id,
                    codigo_producto: det.producto?.codigo_producto ?? null,
                    nombre_producto: det.producto?.nombre_producto ?? `Producto #${id}`,
                    unidades: 0,
                    subtotal: 0,
                    total: 0,
                    costo: 0,
                };
                p.unidades += Number(det.cantidad || 0);
                p.subtotal += Number(det.subtotal || 0);
                p.total += Number(det.total || 0);
                p.costo += Number(det.cantidad || 0) * Number(det.producto?.costo_produccion || 0);
                porProducto.set(id, p);
            }

            // Por vendedor
            const idVendedor = v.fk_venta_id_usuario ?? 0;
            const nombreVendedor = v.usuario
                ? `${v.usuario.nombre_usuario ?? ""} ${v.usuario.apellido_usuario ?? ""}`.trim()
                : "Sin vendedor";
            const ven = porVendedor.get(idVendedor) ?? { idusuario: idVendedor || null, vendedor: nombreVendedor, cantidadVentas: 0, total: 0 };
            ven.cantidadVentas += 1;
            ven.total += Number(v.total || 0);
            porVendedor.set(idVendedor, ven);

            return {
                id_venta: v.id_venta,
                numero_venta: v.numero_venta,
                fecha: dia,
                cliente: v.cliente
                    ? `${v.cliente.nombre_cliente ?? ""} ${v.cliente.apellido_cliente ?? ""}`.trim()
                    : "Consumidor final",
                vendedor: nombreVendedor,
                unidades,
                subtotal: redondear(v.subtotal),
                iva: redondear(v.iva),
                descuento: redondear(v.descuento),
                total: redondear(v.total),
                estado: v.estado_venta,
            };
        });

        // Devoluciones registradas en el periodo (HU-VEN-007): restan de las ventas
        const [[dev]] = await sequelize.query(
            "SELECT COALESCE(SUM(dd.total),0) AS total, COALESCE(SUM(dd.iva),0) AS iva, COALESCE(SUM(CASE WHEN d.reintegrado = 1 THEN dd.costo ELSE 0 END),0) AS costo, COUNT(DISTINCT d.id_devoluciones) AS n " +
            "FROM devoluciones d JOIN det_devolucion dd ON dd.fk_det_devolucion_id_devolucion = d.id_devoluciones WHERE DATE(d.fecha) BETWEEN ? AND ?",
            { replacements: [inicio, fin] }
        ).catch(() => [[{ total: 0, iva: 0, costo: 0, n: 0 }]]);
        resumen.devoluciones = Number(dev.total);
        resumen.cantidadDevoluciones = Number(dev.n);
        resumen.totalNeto = resumen.totalVentas - resumen.devoluciones;
        resumen.iva -= Number(dev.iva);
        resumen.costoVentas -= Number(dev.costo);

        resumen.utilidadBruta = resumen.totalNeto - resumen.iva - resumen.costoVentas;
        resumen.margenBruto = resumen.totalNeto - resumen.iva > 0
            ? (resumen.utilidadBruta / (resumen.totalNeto - resumen.iva)) * 100
            : 0;
        resumen.ticketPromedio = resumen.cantidadVentas ? resumen.totalVentas / resumen.cantidadVentas : 0;
        for (const k of Object.keys(resumen)) resumen[k] = redondear(resumen[k]);

        const ordenarPorTotal = (a, b) => b.total - a.total;

        return {
            periodo: { fechaInicio: inicio, fechaFin: fin },
            generadoEn: new Date().toISOString(),
            resumen,
            porDia: [...porDia.values()]
                .map((d) => ({ ...d, subtotal: redondear(d.subtotal), iva: redondear(d.iva), total: redondear(d.total) }))
                .sort((a, b) => a.fecha.localeCompare(b.fecha)),
            porProducto: [...porProducto.values()]
                .map((p) => ({ ...p, subtotal: redondear(p.subtotal), total: redondear(p.total), costo: redondear(p.costo), utilidad: redondear(p.subtotal - p.costo) }))
                .sort(ordenarPorTotal),
            porVendedor: [...porVendedor.values()]
                .map((v) => ({ ...v, total: redondear(v.total) }))
                .sort(ordenarPorTotal),
            ventas: listado.reverse(), // la más reciente primero
        };
    }
}

export default new ReporteVentasService();
