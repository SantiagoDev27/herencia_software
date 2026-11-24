import { Op, fn, col } from "sequelize";
import sequelize from "../configuration/database.js";
import AppError from "../utils/AppError.js";
import ContabilidadRepository from "../repositories/ContabilidadRepository.js";
import AuditoriaRepository from "../repositories/AuditoriaRepository.js";
import { CuentaContable, Ingreso, Egreso, MetodoPago } from "../models/NegocioModels.js";
import Venta from "../models/VentaModel.js";
import Cliente from "../models/clienteModel.js";
import Proveedor from "../models/ProovedorModel.js";
import { fechaContable, fechaLocalISO, redondear } from "../utils/fechas.js";
import { rangoPorDefecto } from "./ReporteVentasService.js";

// Contrapartida de cada movimiento según el método de pago: efectivo → Caja,
// crédito → cuentas por cobrar / proveedores, lo demás → Bancos.
const esEfectivo = (m) => /efectivo/i.test(m ?? "");
const esCredito = (m) => /^credito$/i.test((m ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim());

const escalar = async (sql, replacements = []) => {
    const [[fila]] = await sequelize.query(sql, { replacements });
    return Number(fila?.v) || 0;
};

const auditar = (u, accion, detalle) => AuditoriaRepository.registrar({ idusuario: u?.idusuario, correo: u?.correo_usuario, accion, detalle });

const rango = (fechaInicio, fechaFin) => {
    const d = rangoPorDefecto();
    const ini = fechaInicio || d.fechaInicio;
    const fin = fechaFin || d.fechaFin;
    if (ini > fin) throw new AppError("La fecha inicial no puede ser posterior a la fecha final.", 400);
    return [ini, fin];
};

class ContabilidadService {
    // ============================================
    // HU-CON-003: Cuentas contables
    // ============================================
    async listarCuentas({ estado } = {}) {
        return await CuentaContable.findAll({ where: estado ? { estado } : {}, order: [["codigo", "ASC"]] });
    }

    async crearCuenta(datos, usuario) {
        if (await CuentaContable.findOne({ where: { codigo: datos.codigo } })) {
            throw new AppError(`Ya existe una cuenta con el código ${datos.codigo}.`, 409);
        }
        const cuenta = await CuentaContable.create({ ...datos, estado: "Activa" });
        await auditar(usuario, "CREAR_CUENTA", `${cuenta.codigo} ${cuenta.nombre_cuenta}`);
        return cuenta;
    }

    async actualizarCuenta(id, datos, usuario) {
        const cuenta = await CuentaContable.findByPk(id);
        if (!cuenta) throw new AppError("Cuenta no encontrada.", 404);
        if (datos.codigo && datos.codigo !== cuenta.codigo) {
            if (await CuentaContable.findOne({ where: { codigo: datos.codigo } })) throw new AppError(`Ya existe una cuenta con el código ${datos.codigo}.`, 409);
            const usada = (await Ingreso.count({ where: { fk_cuenta: id } })) + (await Egreso.count({ where: { fk_cuenta: id } }));
            if (usada) throw new AppError("No se puede cambiar el código de una cuenta con movimientos.", 409);
        }
        const { codigo, nombre_cuenta, tipo, naturaleza } = datos;
        await cuenta.update(Object.fromEntries(Object.entries({ codigo, nombre_cuenta, tipo, naturaleza }).filter(([, v]) => v !== undefined)));
        await auditar(usuario, "EDITAR_CUENTA", `${cuenta.codigo} ${cuenta.nombre_cuenta}`);
        return cuenta;
    }

    async cambiarEstadoCuenta(id, estado, usuario) {
        const cuenta = await CuentaContable.findByPk(id);
        if (!cuenta) throw new AppError("Cuenta no encontrada.", 404);
        await cuenta.update({ estado });
        await auditar(usuario, estado === "Activa" ? "ACTIVAR_CUENTA" : "DESACTIVAR_CUENTA", `${cuenta.codigo} ${cuenta.nombre_cuenta}`);
        return cuenta;
    }

    async metodosPago() {
        return await MetodoPago.findAll({ order: [["id_metodopago", "ASC"]] });
    }

    // ============================================
    // HU-CON-001 / 002: Registrar ingreso y egreso manuales
    // ============================================
    async registrarMovimiento(tipo, datos, usuario) {
        const cuenta = await CuentaContable.findByPk(datos.fk_cuenta);
        if (!cuenta) throw new AppError("La cuenta contable no existe.", 404);
        if (cuenta.estado !== "Activa") throw new AppError(`La cuenta ${cuenta.codigo} está inactiva.`, 400);
        if (!(await MetodoPago.findByPk(datos.fk_metodo_pago))) throw new AppError("El método de pago no existe.", 404);
        const Modelo = tipo === "ingreso" ? Ingreso : Egreso;
        const base = {
            fecha: fechaContable(datos.fecha),
            concepto: datos.concepto.trim(),
            fk_cuenta: cuenta.id_cuenta,
            fk_metodo_pago: datos.fk_metodo_pago,
            valor: datos.valor,
            observaciones: datos.observaciones || null,
            fk_usuario: usuario.idusuario,
            origen: "MANUAL",
        };
        if (tipo === "ingreso") {
            if (datos.fk_cliente && !(await Cliente.findByPk(datos.fk_cliente))) throw new AppError("El cliente no existe.", 404);
            base.fk_cliente = datos.fk_cliente || null;
        } else {
            if (datos.fk_proveedor && !(await Proveedor.findByPk(datos.fk_proveedor, { paranoid: false }))) throw new AppError("El proveedor no existe.", 404);
            base.fk_proveedor = datos.fk_proveedor || null;
        }
        const mov = await Modelo.create(base);
        const prefijo = tipo === "ingreso" ? "ING" : "EGR";
        await mov.update({ referencia: `${prefijo}-${String(mov.get(tipo === "ingreso" ? "id_ingreso" : "id_egreso")).padStart(4, "0")}` });
        await auditar(usuario, tipo === "ingreso" ? "REGISTRAR_INGRESO" : "REGISTRAR_EGRESO", `${mov.referencia}: ${base.concepto} por ${base.valor}`);
        return await this.obtenerMovimiento(tipo, mov.get(tipo === "ingreso" ? "id_ingreso" : "id_egreso"));
    }

    async obtenerMovimiento(tipo, id) {
        const lista = tipo === "ingreso"
            ? await ContabilidadRepository.listarIngresos({ id_ingreso: id })
            : await ContabilidadRepository.listarEgresos({ id_egreso: id });
        if (!lista.length) throw new AppError("Movimiento no encontrado.", 404);
        return lista[0];
    }

    // Solo los manuales: los de ventas, devoluciones y compras se corrigen en su módulo
    async anularMovimiento(tipo, id, motivo, usuario) {
        const Modelo = tipo === "ingreso" ? Ingreso : Egreso;
        const mov = await Modelo.findByPk(id);
        if (!mov) throw new AppError("Movimiento no encontrado.", 404);
        if (mov.origen !== "MANUAL") throw new AppError(`Este movimiento lo generó el módulo de ${mov.origen.toLowerCase()}s; corrígelo desde allí.`, 409);
        if (mov.estado === "Anulado") throw new AppError("El movimiento ya está anulado.", 409);
        await mov.update({ estado: "Anulado", observaciones: `${mov.observaciones ? mov.observaciones + " | " : ""}Anulado: ${motivo}`.slice(0, 150) });
        await auditar(usuario, tipo === "ingreso" ? "ANULAR_INGRESO" : "ANULAR_EGRESO", `${mov.referencia}: ${motivo}`);
        return mov;
    }

    // ============================================
    // HU-CON-004: Consultar movimientos financieros
    // ============================================
    async movimientos({ fechaInicio, fechaFin, tipo, fk_cuenta, fk_usuario, incluirAnulados } = {}) {
        const [ini, fin] = rango(fechaInicio, fechaFin);
        const where = (tabla) => {
            const w = { [Op.and]: ContabilidadRepository.condicionFechas(ini, fin, `${tabla}.fecha`) };
            if (fk_cuenta) w.fk_cuenta = fk_cuenta;
            if (fk_usuario) w.fk_usuario = fk_usuario;
            if (!(incluirAnulados === "true" || incluirAnulados === true)) w.estado = "Activo";
            return w;
        };
        const ingresos = tipo === "egreso" ? [] : await ContabilidadRepository.listarIngresos(where("Ingreso"));
        const egresos = tipo === "ingreso" ? [] : await ContabilidadRepository.listarEgresos(where("Egreso"));

        const fila = (m, t) => {
            const j = m.toJSON();
            return {
                tipo: t,
                id: t === "Ingreso" ? j.id_ingreso : j.id_egreso,
                referencia: j.referencia,
                fecha: fechaLocalISO(new Date(j.fecha)),
                concepto: j.concepto,
                cuenta: j.cuenta ? `${j.cuenta.codigo} ${j.cuenta.nombre_cuenta}` : "—",
                fk_cuenta: j.fk_cuenta,
                tipo_cuenta: j.cuenta?.tipo ?? null,
                metodo_pago: j.metodo_pago?.metodo_pago ?? "—",
                tercero: t === "Ingreso"
                    ? (j.cliente ? `${j.cliente.nombre_cliente} ${j.cliente.apellido_cliente ?? ""}`.trim() : null)
                    : (j.proveedor?.razon_social ?? null),
                usuario: j.usuario ? `${j.usuario.nombre_usuario} ${j.usuario.apellido_usuario}` : "—",
                valor: Number(j.valor),
                origen: j.origen,
                estado: j.estado,
                observaciones: j.observaciones,
            };
        };
        const lista = [...ingresos.map((m) => fila(m, "Ingreso")), ...egresos.map((m) => fila(m, "Egreso"))]
            .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);

        const activos = lista.filter((m) => m.estado === "Activo");
        const totalIngresos = redondear(activos.filter((m) => m.tipo === "Ingreso").reduce((a, m) => a + m.valor, 0));
        const totalEgresos = redondear(activos.filter((m) => m.tipo === "Egreso").reduce((a, m) => a + m.valor, 0));

        // Totales por cuenta (débitos = egresos, créditos = ingresos de la cuenta afectada)
        const porCuenta = new Map();
        for (const m of activos) {
            const c = porCuenta.get(m.cuenta) ?? { cuenta: m.cuenta, ingresos: 0, egresos: 0, movimientos: 0 };
            c[m.tipo === "Ingreso" ? "ingresos" : "egresos"] += m.valor;
            c.movimientos += 1;
            porCuenta.set(m.cuenta, c);
        }

        return {
            periodo: { fechaInicio: ini, fechaFin: fin },
            totales: { ingresos: totalIngresos, egresos: totalEgresos, neto: redondear(totalIngresos - totalEgresos), movimientos: lista.length },
            porCuenta: [...porCuenta.values()].map((c) => ({ ...c, ingresos: redondear(c.ingresos), egresos: redondear(c.egresos) })).sort((a, b) => a.cuenta.localeCompare(b.cuenta)),
            movimientos: lista,
        };
    }

    // Sumas de movimientos activos hasta / entre fechas, agrupadas por método y por cuenta
    async _sumas(Modelo, alias, condiciones) {
        return await Modelo.findAll({
            attributes: ["fk_metodo_pago", "fk_cuenta", [fn("SUM", col(`${alias}.valor`)), "total"]],
            where: { estado: "Activo", [Op.and]: condiciones },
            include: [{ model: MetodoPago, as: "metodo_pago", attributes: ["metodo_pago"] }, { model: CuentaContable, as: "cuenta", attributes: ["codigo", "tipo", "nombre_cuenta"] }],
            group: ["fk_metodo_pago", "fk_cuenta", "metodo_pago.id_metodopago", "cuenta.id_cuentas"],
            raw: true,
            nest: true,
        });
    }

    // ============================================
    // HU-CON-005: Balance general (simplificado) a una fecha de corte
    // ============================================
    async balanceGeneral({ fechaCorte } = {}) {
        const corte = fechaCorte || fechaLocalISO();
        const ingresos = await this._sumas(Ingreso, "Ingreso", ContabilidadRepository.condicionFechas(null, corte, "Ingreso.fecha"));
        const egresos = await this._sumas(Egreso, "Egreso", ContabilidadRepository.condicionFechas(null, corte, "Egreso.fecha"));

        let caja = 0, bancos = 0, porCobrar = 0, proveedores = 0, capital = 0, pagosIva = 0;
        for (const i of ingresos) {
            const v = Number(i.total);
            const m = i.metodo_pago?.metodo_pago;
            if (esCredito(m)) porCobrar += v; else if (esEfectivo(m)) caja += v; else bancos += v;
            if (i.cuenta?.tipo === "Patrimonio") capital += v;
            if (i.cuenta?.codigo === "1305") porCobrar -= v; // cobro de cartera
        }
        for (const e of egresos) {
            const v = Number(e.total);
            const m = e.metodo_pago?.metodo_pago;
            if (esCredito(m)) proveedores += v; else if (esEfectivo(m)) caja -= v; else bancos -= v;
            if (e.cuenta?.codigo === "2205") proveedores -= v; // pago a proveedores
            if (e.cuenta?.codigo === "2408") pagosIva += v;   // pago de IVA a la DIAN
        }

        const inventario = await escalar("SELECT SUM(stock * costo_produccion) AS v FROM producto WHERE deleted_at IS NULL AND stock > 0");
        const ivaVentas = await escalar("SELECT SUM(iva) AS v FROM venta WHERE estado_venta <> 'Anulada' AND fecha <= ?", [corte]);
        const ivaDevuelto = await escalar("SELECT SUM(dd.iva) AS v FROM det_devolucion dd JOIN devoluciones d ON d.id_devoluciones = dd.fk_det_devolucion_id_devolucion WHERE DATE(d.fecha) <= ?", [corte]);
        const ivaCompras = await escalar("SELECT SUM(iva) AS v FROM ingreso_mercancia WHERE fecha <= ?", [corte]);
        const ivaNeto = ivaVentas - ivaDevuelto - ivaCompras - pagosIva;

        const activos = [
            { codigo: "1105", cuenta: "Caja", valor: caja },
            { codigo: "1110", cuenta: "Bancos", valor: bancos },
            { codigo: "1305", cuenta: "Clientes (cuentas por cobrar)", valor: porCobrar },
            { codigo: "1435", cuenta: "Inventario de mercancías (al costo)", valor: inventario },
        ];
        if (ivaNeto < 0) activos.push({ codigo: "1355", cuenta: "Saldo a favor de IVA", valor: -ivaNeto });
        const pasivos = [
            { codigo: "2205", cuenta: "Proveedores", valor: proveedores },
            { codigo: "2408", cuenta: "IVA por pagar", valor: Math.max(ivaNeto, 0) },
        ];
        const totalActivos = activos.reduce((a, x) => a + x.valor, 0);
        const totalPasivos = pasivos.reduce((a, x) => a + x.valor, 0);
        const resultados = totalActivos - totalPasivos - capital;
        const patrimonio = [
            { codigo: "3105", cuenta: "Capital social (aportes registrados)", valor: capital },
            { codigo: "3605", cuenta: "Resultados acumulados", valor: resultados },
        ];
        const r = (l) => l.map((x) => ({ ...x, valor: redondear(x.valor) }));
        return {
            fechaCorte: corte,
            activos: r(activos),
            pasivos: r(pasivos),
            patrimonio: r(patrimonio),
            totales: {
                activos: redondear(totalActivos),
                pasivos: redondear(totalPasivos),
                patrimonio: redondear(capital + resultados),
                pasivoMasPatrimonio: redondear(totalPasivos + capital + resultados),
            },
            nota: "Balance simplificado: efectivo y bancos según los ingresos y egresos registrados, inventario valorado al costo con las existencias actuales e IVA según ventas y compras.",
        };
    }

    // ============================================
    // HU-CON-006: Estado de resultados del periodo
    // ============================================
    async estadoResultados({ fechaInicio, fechaFin } = {}) {
        const [ini, fin] = rango(fechaInicio, fechaFin);
        const ventasWhere = { estado_venta: { [Op.ne]: "Anulada" }, fecha: { [Op.between]: [ini, fin] } };
        const ventasBrutas = Number(await Venta.sum("subtotal", { where: ventasWhere })) || 0;
        const descuentos = Number(await Venta.sum("descuento", { where: ventasWhere })) || 0;
        const costoVendido = await escalar(
            "SELECT SUM(dv.cantidad * p.costo_produccion) AS v FROM det_venta dv JOIN venta v ON v.id_venta = dv.fk_det_venta_id_venta " +
            "JOIN producto p ON p.id_producto = dv.fk_det_venta_id_producto WHERE v.estado_venta <> 'Anulada' AND v.fecha BETWEEN ? AND ?", [ini, fin]);
        const DEV = "FROM det_devolucion dd JOIN devoluciones d ON d.id_devoluciones = dd.fk_det_devolucion_id_devolucion WHERE DATE(d.fecha) BETWEEN ? AND ?";
        const devoluciones = await escalar(`SELECT SUM(dd.subtotal) AS v ${DEV}`, [ini, fin]);
        const costoDevuelto = await escalar(`SELECT SUM(dd.costo) AS v ${DEV} AND d.reintegrado = 1`, [ini, fin]);

        const fechasIng = ContabilidadRepository.condicionFechas(ini, fin, "Ingreso.fecha");
        const fechasEgr = ContabilidadRepository.condicionFechas(ini, fin, "Egreso.fecha");
        const otrosIngresos = (await this._sumas(Ingreso, "Ingreso", [...fechasIng, { origen: "MANUAL" }])).filter((i) => i.cuenta?.tipo === "Ingreso");
        const egresos = await this._sumas(Egreso, "Egreso", fechasEgr);
        const agrupar = (filas) => {
            const m = new Map();
            for (const f of filas) {
                const k = `${f.cuenta.codigo} ${f.cuenta.nombre_cuenta}`;
                m.set(k, (m.get(k) ?? 0) + Number(f.total));
            }
            return [...m].map(([cuenta, valor]) => ({ cuenta, valor: redondear(valor) }));
        };
        const gastos = agrupar(egresos.filter((e) => e.cuenta?.tipo === "Gasto"));
        const otrosCostos = agrupar(egresos.filter((e) => e.cuenta?.tipo === "Costo"));
        const otros = agrupar(otrosIngresos);

        const ingresosNetos = ventasBrutas - descuentos - devoluciones;
        const costoVentas = costoVendido - costoDevuelto + otrosCostos.reduce((a, x) => a + x.valor, 0);
        const utilidadBruta = ingresosNetos - costoVentas;
        const totalGastos = gastos.reduce((a, x) => a + x.valor, 0);
        const utilidadOperacional = utilidadBruta - totalGastos;
        const totalOtros = otros.reduce((a, x) => a + x.valor, 0);
        const utilidadNeta = utilidadOperacional + totalOtros;

        return {
            periodo: { fechaInicio: ini, fechaFin: fin },
            ingresos: {
                ventasBrutas: redondear(ventasBrutas), descuentos: redondear(descuentos),
                devoluciones: redondear(devoluciones), ingresosNetos: redondear(ingresosNetos),
            },
            costos: { costoMercanciaVendida: redondear(costoVendido - costoDevuelto), otrosCostos, total: redondear(costoVentas) },
            utilidadBruta: redondear(utilidadBruta),
            gastos: { detalle: gastos, total: redondear(totalGastos) },
            utilidadOperacional: redondear(utilidadOperacional),
            otrosIngresos: { detalle: otros, total: redondear(totalOtros) },
            utilidadNeta: redondear(utilidadNeta),
            margenNeto: ingresosNetos > 0 ? redondear((utilidadNeta / ingresosNetos) * 100) : 0,
            resultado: utilidadNeta >= 0 ? "Utilidad" : "Pérdida",
        };
    }

    // ============================================
    // HU-CON-007: Flujo de caja (solo dinero que entra o sale: excluye ventas y compras a crédito)
    // ============================================
    async flujoCaja({ fechaInicio, fechaFin } = {}) {
        const [ini, fin] = rango(fechaInicio, fechaFin);
        const antes = new Date(`${ini}T12:00:00`);
        antes.setDate(antes.getDate() - 1);
        const diaAnterior = fechaLocalISO(antes);

        const suma = (filas) => filas.filter((f) => !esCredito(f.metodo_pago?.metodo_pago)).reduce((a, f) => a + Number(f.total), 0);
        const saldoInicial =
            suma(await this._sumas(Ingreso, "Ingreso", ContabilidadRepository.condicionFechas(null, diaAnterior, "Ingreso.fecha")))
            - suma(await this._sumas(Egreso, "Egreso", ContabilidadRepository.condicionFechas(null, diaAnterior, "Egreso.fecha")));

        const { movimientos } = await this.movimientos({ fechaInicio: ini, fechaFin: fin });
        const enEfectivo = movimientos.filter((m) => !esCredito(m.metodo_pago));
        const dias = new Map();
        const porConcepto = new Map();
        for (const m of enEfectivo) {
            const d = dias.get(m.fecha) ?? { fecha: m.fecha, entradas: 0, salidas: 0 };
            d[m.tipo === "Ingreso" ? "entradas" : "salidas"] += m.valor;
            dias.set(m.fecha, d);
            const k = `${m.tipo === "Ingreso" ? "Entrada" : "Salida"} · ${m.origen === "MANUAL" ? m.cuenta : m.origen.charAt(0) + m.origen.slice(1).toLowerCase() + "s"}`;
            porConcepto.set(k, (porConcepto.get(k) ?? 0) + m.valor);
        }
        let saldo = saldoInicial;
        const porDia = [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((d) => {
            saldo += d.entradas - d.salidas;
            return { fecha: d.fecha, entradas: redondear(d.entradas), salidas: redondear(d.salidas), neto: redondear(d.entradas - d.salidas), saldo: redondear(saldo) };
        });
        const entradas = porDia.reduce((a, d) => a + d.entradas, 0);
        const salidas = porDia.reduce((a, d) => a + d.salidas, 0);
        return {
            periodo: { fechaInicio: ini, fechaFin: fin },
            saldoInicial: redondear(saldoInicial),
            entradas: redondear(entradas),
            salidas: redondear(salidas),
            flujoNeto: redondear(entradas - salidas),
            saldoFinal: redondear(saldoInicial + entradas - salidas),
            porDia,
            porConcepto: [...porConcepto].map(([concepto, valor]) => ({ concepto, valor: redondear(valor) })).sort((a, b) => b.valor - a.valor),
        };
    }
}

export default new ContabilidadService();
