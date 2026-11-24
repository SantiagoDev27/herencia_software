import ContabilidadService from "../services/ContabilidadService.js";
import PdfGenerator from "../utils/pdfGenerator.js";

const $ = (v) => PdfGenerator._formatearMoneda(v);
const manejar = (fn, mensaje, status = 200) => async (req, res, next) => {
    try {
        return res.status(status).json({ success: true, message: mensaje, data: await fn(req) });
    } catch (error) {
        next(error);
    }
};
const pdf = (fn) => async (req, res, next) => {
    try {
        await fn(req, res);
    } catch (error) {
        next(error);
    }
};
const filasValor = (lista) => lista.map((x) => [x.codigo ? `${x.codigo} ${x.cuenta}` : x.cuenta ?? x.concepto, $(x.valor)]);
const COL2 = [{ label: "Concepto", width: 0.7 }, { label: "Valor", width: 0.3, align: "right" }];

export default {
    metodosPago: manejar(() => ContabilidadService.metodosPago()),
    listarCuentas: manejar((req) => ContabilidadService.listarCuentas(req.query)),
    crearCuenta: manejar((req) => ContabilidadService.crearCuenta(req.body, req.usuario), "Cuenta contable creada.", 201),
    actualizarCuenta: manejar((req) => ContabilidadService.actualizarCuenta(req.params.id, req.body, req.usuario), "Cuenta contable actualizada."),
    estadoCuenta: manejar((req) => ContabilidadService.cambiarEstadoCuenta(req.params.id, req.body.estado, req.usuario), "Estado actualizado."),

    registrarIngreso: manejar((req) => ContabilidadService.registrarMovimiento("ingreso", req.body, req.usuario), "Ingreso registrado.", 201),
    registrarEgreso: manejar((req) => ContabilidadService.registrarMovimiento("egreso", req.body, req.usuario), "Egreso registrado.", 201),
    anularIngreso: manejar((req) => ContabilidadService.anularMovimiento("ingreso", req.params.id, req.body.motivo, req.usuario), "Ingreso anulado."),
    anularEgreso: manejar((req) => ContabilidadService.anularMovimiento("egreso", req.params.id, req.body.motivo, req.usuario), "Egreso anulado."),
    movimientos: manejar((req) => ContabilidadService.movimientos(req.query)),
    balance: manejar((req) => ContabilidadService.balanceGeneral(req.query)),
    resultados: manejar((req) => ContabilidadService.estadoResultados(req.query)),
    flujo: manejar((req) => ContabilidadService.flujoCaja(req.query)),

    // Comprobante de ingreso o egreso (requisitos 2.2.4.1 y 2.2.4.2)
    comprobante: (tipo) => pdf(async (req, res) => {
        const m = (await ContabilidadService.obtenerMovimiento(tipo, req.params.id)).toJSON();
        const tercero = tipo === "ingreso"
            ? (m.cliente ? `${m.cliente.nombre_cliente} ${m.cliente.apellido_cliente ?? ""}` : "—")
            : (m.proveedor?.razon_social ?? "—");
        PdfGenerator.generarComprobante(res, {
            titulo: tipo === "ingreso" ? "COMPROBANTE DE INGRESO" : "COMPROBANTE DE EGRESO",
            numero: m.referencia,
            archivo: `comprobante-${m.referencia}`,
            datos: [
                ["Fecha", new Date(m.fecha).toLocaleDateString("es-CO")],
                ["Concepto", m.concepto],
                ["Cuenta", `${m.cuenta?.codigo} ${m.cuenta?.nombre_cuenta}`],
                [tipo === "ingreso" ? "Cliente" : "Proveedor", tercero],
                ["Método de pago", m.metodo_pago?.metodo_pago ?? "—"],
                ["Estado", m.estado],
                ["Registró", `${m.usuario?.nombre_usuario ?? ""} ${m.usuario?.apellido_usuario ?? ""}`],
                ["Observaciones", m.observaciones ?? "—"],
            ],
            total: m.valor,
        });
    }),

    balancePDF: pdf(async (req, res) => {
        const b = await ContabilidadService.balanceGeneral(req.query);
        PdfGenerator.generarReporteTabular(res, {
            titulo: "BALANCE GENERAL", subtitulo: `Fecha de corte: ${b.fechaCorte}`, archivo: `balance-general-${b.fechaCorte}`,
            cajas: [
                { label: "Total activos", value: $(b.totales.activos) },
                { label: "Total pasivos", value: $(b.totales.pasivos) },
                { label: "Patrimonio", value: $(b.totales.patrimonio) },
            ],
            tablas: [
                { titulo: "Activos", columnas: COL2, filas: [...filasValor(b.activos), ["TOTAL ACTIVOS", $(b.totales.activos)]] },
                { titulo: "Pasivos", columnas: COL2, filas: [...filasValor(b.pasivos), ["TOTAL PASIVOS", $(b.totales.pasivos)]] },
                { titulo: "Patrimonio", columnas: COL2, filas: [...filasValor(b.patrimonio), ["TOTAL PASIVO + PATRIMONIO", $(b.totales.pasivoMasPatrimonio)]] },
            ],
            nota: b.nota,
        });
    }),

    resultadosPDF: pdf(async (req, res) => {
        const r = await ContabilidadService.estadoResultados(req.query);
        const { fechaInicio, fechaFin } = r.periodo;
        PdfGenerator.generarReporteTabular(res, {
            titulo: "ESTADO DE RESULTADOS", subtitulo: `Del ${fechaInicio} al ${fechaFin}`, archivo: `estado-resultados-${fechaInicio}-a-${fechaFin}`,
            cajas: [
                { label: "Ingresos netos", value: $(r.ingresos.ingresosNetos) },
                { label: "Utilidad bruta", value: $(r.utilidadBruta) },
                { label: `${r.resultado} neta (${r.margenNeto}%)`, value: $(r.utilidadNeta) },
            ],
            tablas: [{
                titulo: "Estado de resultados", columnas: COL2, filas: [
                    ["Ventas brutas", $(r.ingresos.ventasBrutas)],
                    ["(-) Descuentos", $(r.ingresos.descuentos)],
                    ["(-) Devoluciones en ventas", $(r.ingresos.devoluciones)],
                    ["INGRESOS OPERACIONALES NETOS", $(r.ingresos.ingresosNetos)],
                    ["(-) Costo de la mercancía vendida", $(r.costos.costoMercanciaVendida)],
                    ...r.costos.otrosCostos.map((c) => [`(-) ${c.cuenta}`, $(c.valor)]),
                    ["UTILIDAD BRUTA", $(r.utilidadBruta)],
                    ...r.gastos.detalle.map((g) => [`(-) ${g.cuenta}`, $(g.valor)]),
                    ["UTILIDAD OPERACIONAL", $(r.utilidadOperacional)],
                    ...r.otrosIngresos.detalle.map((o) => [`(+) ${o.cuenta}`, $(o.valor)]),
                    [`${r.resultado.toUpperCase()} NETA DEL PERIODO`, $(r.utilidadNeta)],
                ],
            }],
        });
    }),

    flujoPDF: pdf(async (req, res) => {
        const f = await ContabilidadService.flujoCaja(req.query);
        const { fechaInicio, fechaFin } = f.periodo;
        PdfGenerator.generarReporteTabular(res, {
            titulo: "FLUJO DE CAJA", subtitulo: `Del ${fechaInicio} al ${fechaFin}`, archivo: `flujo-caja-${fechaInicio}-a-${fechaFin}`,
            cajas: [
                { label: "Saldo inicial", value: $(f.saldoInicial) },
                { label: "Entradas", value: $(f.entradas) },
                { label: "Salidas", value: $(f.salidas) },
                { label: "Flujo neto", value: $(f.flujoNeto) },
                { label: "Saldo final", value: $(f.saldoFinal) },
            ],
            tablas: [
                {
                    titulo: "Movimiento diario",
                    columnas: [{ label: "Fecha", width: 0.2 }, { label: "Entradas", width: 0.2, align: "right" }, { label: "Salidas", width: 0.2, align: "right" }, { label: "Neto", width: 0.2, align: "right" }, { label: "Saldo", width: 0.2, align: "right" }],
                    filas: f.porDia.map((d) => [d.fecha, $(d.entradas), $(d.salidas), $(d.neto), $(d.saldo)]),
                },
                { titulo: "Por concepto", columnas: COL2, filas: f.porConcepto.map((c) => [c.concepto, $(c.valor)]) },
            ],
            nota: "Incluye solo dinero efectivamente recibido o pagado; las ventas y compras a crédito no afectan la caja.",
        });
    }),
};
