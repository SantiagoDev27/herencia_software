import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ajusta esta ruta según dónde guardes el logo en tu proyecto
const LOGO_PATH = path.join(__dirname, "../utils/logo-herencia-papa.png");
const NOMBRE_EMPRESA = "HERENCIA DE PAPÁ";
const SLOGAN_EMPRESA = "Sabores del Valle";

class PdfGenerator {

    // ==========================================================
    // REPORTE DE INVENTARIO
    // ==========================================================
    generarReporteInventario(res, reporte) {
        const doc = new PDFDocument({
            margins: { top: 40, bottom: 50, left: 40, right: 40 },
            size: "A4",
            bufferPages: true,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=reporte-inventario.pdf");
        doc.pipe(res);

        this._dibujarEncabezado(doc, "REPORTE GENERAL DE INVENTARIO");
        this._dibujarResumen(doc, reporte.resumen);
        this._dibujarIndicadoresFinancieros(doc, reporte.resumen);
        this._dibujarDetalleInventario(doc, reporte.inventario);
        this._dibujarPiePagina(doc);

        doc.end();
    }

    // ==========================================================
    // FACTURA DE VENTA
    // ==========================================================
    generarFacturaVenta(res, venta, detalles) {
        const doc = new PDFDocument({
            margins: { top: 40, bottom: 50, left: 40, right: 40 },
            size: "A4",
            bufferPages: true,
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=factura-${venta.numero_venta}.pdf`
        );
        doc.pipe(res);

        this._dibujarEncabezado(doc, "FACTURA DE VENTA", `N° ${venta.numero_venta}`);
        this._dibujarDatosVenta(doc, venta);
        this._dibujarDetalleFactura(doc, detalles);
        this._dibujarTotalesFactura(doc, venta);
        if (venta.estado_venta === "Anulada") {
            doc.save().rotate(-30, { origin: [300, 420] }).fontSize(70).fillColor("#c0392b").opacity(0.18)
                .text("ANULADA", 90, 380, { width: 420, align: "center" }).restore();
            doc.opacity(1).fillColor("#c0392b").fontSize(10).font("Helvetica-Bold")
                .text(`Venta anulada: ${venta.motivo_anulacion ?? ""}`, doc.page.margins.left, doc.y);
        }
        this._dibujarPiePagina(doc);

        doc.end();
    }

    // ==========================================================
    // REPORTE GENERAL DE VENTAS (Finanzas)
    // ==========================================================
    generarReporteVentas(res, reporte) {
        const doc = new PDFDocument({
            margins: { top: 40, bottom: 50, left: 40, right: 40 },
            size: "A4",
            bufferPages: true,
        });

        const { fechaInicio, fechaFin } = reporte.periodo;
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=reporte-ventas-${fechaInicio}-a-${fechaFin}.pdf`
        );
        doc.pipe(res);

        this._dibujarEncabezado(doc, "REPORTE GENERAL DE VENTAS", `Del ${fechaInicio} al ${fechaFin}`);

        const r = reporte.resumen;
        this._dibujarCajasResumen(doc, [
            { label: "Ventas", value: String(r.cantidadVentas) },
            { label: "Unidades vendidas", value: String(r.unidadesVendidas) },
            { label: "Ticket promedio", value: this._formatearMoneda(r.ticketPromedio) },
            { label: "Subtotal", value: this._formatearMoneda(r.subtotal) },
            { label: "IVA recaudado", value: this._formatearMoneda(r.iva) },
            { label: "Descuentos", value: this._formatearMoneda(r.descuentos) },
            { label: "Total vendido", value: this._formatearMoneda(r.totalVentas) },
            { label: "Costo de ventas", value: this._formatearMoneda(r.costoVentas) },
            { label: `Utilidad bruta (${Number(r.margenBruto).toFixed(1)}%)`, value: this._formatearMoneda(r.utilidadBruta) },
        ]);

        this._dibujarTabla(doc, "Ventas e IVA por día", [
            { label: "Fecha", width: 0.25 },
            { label: "N° ventas", width: 0.15, align: "right" },
            { label: "Subtotal", width: 0.20, align: "right" },
            { label: "IVA", width: 0.20, align: "right" },
            { label: "Total", width: 0.20, align: "right" },
        ], reporte.porDia.map((d) => [
            d.fecha, String(d.cantidadVentas), this._formatearMoneda(d.subtotal, false),
            this._formatearMoneda(d.iva, false), this._formatearMoneda(d.total, false),
        ]), "No hubo ventas en el periodo.");

        this._dibujarTabla(doc, "Productos más vendidos", [
            { label: "Producto", width: 0.36 },
            { label: "Unidades", width: 0.12, align: "right" },
            { label: "Ventas (sin IVA)", width: 0.18, align: "right" },
            { label: "Costo", width: 0.17, align: "right" },
            { label: "Utilidad", width: 0.17, align: "right" },
        ], reporte.porProducto.map((p) => [
            p.nombre_producto, String(p.unidades), this._formatearMoneda(p.subtotal, false),
            this._formatearMoneda(p.costo, false), this._formatearMoneda(p.utilidad, false),
        ]), "Sin productos vendidos.");

        this._dibujarTabla(doc, "Ventas por vendedor", [
            { label: "Vendedor", width: 0.50 },
            { label: "N° ventas", width: 0.20, align: "right" },
            { label: "Total", width: 0.30, align: "right" },
        ], reporte.porVendedor.map((v) => [
            v.vendedor, String(v.cantidadVentas), this._formatearMoneda(v.total, false),
        ]), "Sin ventas registradas.");

        this._dibujarTabla(doc, "Detalle de ventas", [
            { label: "N° venta", width: 0.14 },
            { label: "Fecha", width: 0.14 },
            { label: "Vendedor", width: 0.22 },
            { label: "Subtotal", width: 0.16, align: "right" },
            { label: "IVA", width: 0.14, align: "right" },
            { label: "Total", width: 0.20, align: "right" },
        ], reporte.ventas.map((v) => [
            v.numero_venta, v.fecha, v.vendedor, this._formatearMoneda(v.subtotal, false),
            this._formatearMoneda(v.iva, false), this._formatearMoneda(v.total, false),
        ]), "Sin ventas registradas.");

        this._dibujarPiePagina(doc);
        doc.end();
    }

    // ==========================================================
    // REPORTE GENÉRICO: cajas de indicadores + tablas (proveedores, balance,
    // estado de resultados, flujo de caja)
    // ==========================================================
    generarReporteTabular(res, { titulo, subtitulo, archivo, cajas = [], tablas = [], nota = null }) {
        const doc = new PDFDocument({ margins: { top: 40, bottom: 50, left: 40, right: 40 }, size: "A4", bufferPages: true });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=${archivo}.pdf`);
        doc.pipe(res);
        this._dibujarEncabezado(doc, titulo, subtitulo);
        if (cajas.length) this._dibujarCajasResumen(doc, cajas);
        for (const t of tablas) {
            this._dibujarTabla(doc, t.titulo, t.columnas, t.filas.map((f) => f.map((v) => String(v ?? ""))), t.vacio ?? "Sin datos en el periodo.");
        }
        if (nota) {
            doc.fillColor("#555555").font("Helvetica-Oblique").fontSize(8.5)
                .text(nota, doc.page.margins.left, doc.y, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
        }
        this._dibujarPiePagina(doc);
        doc.end();
    }

    // ==========================================================
    // COMPROBANTE GENÉRICO: ingreso, egreso, devolución, orden de compra
    // ==========================================================
    generarComprobante(res, { titulo, numero, archivo, datos = [], columnas = null, filas = [], total = null }) {
        const doc = new PDFDocument({ margins: { top: 40, bottom: 50, left: 40, right: 40 }, size: "A4", bufferPages: true });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=${archivo}.pdf`);
        doc.pipe(res);
        this._dibujarEncabezado(doc, titulo, `N° ${numero}`);

        const startX = doc.page.margins.left;
        const ancho = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        for (const [etiqueta, valor] of datos) {
            const y = doc.y;
            doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#333333").text(`${etiqueta}:`, startX, y, { width: 150 });
            doc.font("Helvetica").fillColor("#000000").text(String(valor ?? "—"), startX + 155, y, { width: ancho - 155 });
            doc.y = Math.max(doc.y, y + 14) + 3;
        }
        doc.y += 10;

        if (columnas) {
            const w = [0.4, 0.1, 0.17, 0.15, 0.18];
            this._dibujarTabla(doc, "Detalle", columnas.map((label, i) => ({ label, width: w[i] ?? 0.15, align: i === 0 ? "left" : "right" })),
                filas.map((f) => f.map((v, i) => (i >= 2 ? this._formatearMoneda(v, false) : String(v)))));
        }
        if (total !== null) {
            doc.font("Helvetica-Bold").fontSize(13).fillColor("#7a1f3d")
                .text(`TOTAL: ${this._formatearMoneda(total)}`, startX, doc.y + 4, { width: ancho, align: "right" });
        }
        doc.y += 50;
        doc.font("Helvetica").fontSize(9).fillColor("#333333");
        const yFirma = doc.y;
        doc.moveTo(startX, yFirma).lineTo(startX + 200, yFirma).stroke("#999999");
        doc.moveTo(startX + ancho - 200, yFirma).lineTo(startX + ancho, yFirma).stroke("#999999");
        doc.text("Elaboró", startX, yFirma + 4, { width: 200, align: "center" });
        doc.text("Recibió / Aprobó", startX + ancho - 200, yFirma + 4, { width: 200, align: "center" });

        this._dibujarPiePagina(doc);
        doc.end();
    }

    // Cuadrícula de indicadores (3 por fila)
    _dibujarCajasResumen(doc, items) {
        const startX = doc.page.margins.left;
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const porFila = 3;
        const gap = 8;
        const ancho = (pageWidth - gap * (porFila - 1)) / porFila;
        const alto = 42;
        let y = doc.y;

        items.forEach((item, i) => {
            const col = i % porFila;
            if (i > 0 && col === 0) y += alto + gap;
            const x = startX + col * (ancho + gap);
            doc.roundedRect(x, y, ancho, alto, 4).fillAndStroke("#f7f1f3", "#e3c9d2");
            doc.fillColor("#666666").font("Helvetica").fontSize(8).text(item.label, x + 8, y + 7, { width: ancho - 16 });
            doc.fillColor("#7a1f3d").font("Helvetica-Bold").fontSize(12).text(item.value, x + 8, y + 20, { width: ancho - 16 });
        });

        doc.fillColor("#000000");
        doc.y = y + alto + 20;
    }

    // Tabla genérica con salto de página y encabezado repetido
    _dibujarTabla(doc, titulo, columnas, filas, textoVacio = "Sin datos.") {
        const startX = doc.page.margins.left;
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const limite = () => doc.page.height - doc.page.margins.bottom - 30;
        const colWidths = columnas.map((c) => Math.floor(c.width * pageWidth));
        const rowHeight = 18;
        const headerHeight = 20;

        if (doc.y + 70 > limite()) {
            doc.addPage();
            doc.y = doc.page.margins.top;
        }

        doc.fillColor("#000000").font("Helvetica-Bold").fontSize(11).text(titulo, startX, doc.y);
        doc.y += 6;

        const encabezado = () => {
            let x = startX;
            const y = doc.y;
            doc.rect(startX, y, pageWidth, headerHeight).fillAndStroke("#7a1f3d", "#7a1f3d");
            doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
            columnas.forEach((col, i) => {
                doc.text(col.label, x + 4, y + 6, { width: colWidths[i] - 8, align: col.align ?? "left" });
                x += colWidths[i];
            });
            doc.y = y + headerHeight;
        };

        encabezado();

        if (filas.length === 0) {
            doc.fillColor("#666666").font("Helvetica-Oblique").fontSize(9).text(textoVacio, startX + 4, doc.y + 6);
            doc.y += 26;
            doc.fillColor("#000000");
            return;
        }

        filas.forEach((fila, idx) => {
            if (doc.y + rowHeight > limite()) {
                doc.addPage();
                doc.y = doc.page.margins.top;
                encabezado();
            }
            const y = doc.y;
            let x = startX;
            if (idx % 2 === 0) doc.rect(startX, y, pageWidth, rowHeight).fill("#f4f4f7");
            doc.fillColor("#000000").font("Helvetica").fontSize(8.5);
            fila.forEach((valor, i) => {
                doc.text(String(valor ?? ""), x + 4, y + 5, {
                    width: colWidths[i] - 8,
                    align: columnas[i].align ?? "left",
                    ellipsis: true,
                    lineBreak: false,
                });
                x += colWidths[i];
            });
            doc.rect(startX, y, pageWidth, rowHeight).stroke("#dddddd");
            doc.y = y + rowHeight;
        });

        doc.fillColor("#000000");
        doc.y += 18;
    }

    // ==========================
    // ENCABEZADO (con logo + branding)
    // ==========================
    _dibujarEncabezado(doc, titulo, subtitulo = null) {
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const startX = doc.page.margins.left;
        const startY = doc.page.margins.top;
        const boxHeight = 100;

        doc.rect(startX, startY, pageWidth, boxHeight).stroke("#7a1f3d");

        // Logo a la izquierda
        const logoWidth = 55;
        const logoHeight = 55;
        try {
            doc.image(LOGO_PATH, startX + 12, startY + 10, {
                width: logoWidth,
                height: logoHeight,
            });
        } catch (err) {
            // Si el logo no carga, el PDF sigue generándose sin romperse
            console.error("No se pudo cargar el logo:", err.message);
        }

        const textStartX = startX + logoWidth + 25;
        const textWidth = pageWidth - logoWidth - 35;

        doc
            .fillColor("#7a1f3d")
            .fontSize(16)
            .font("Helvetica-Bold")
            .text(NOMBRE_EMPRESA, textStartX, startY + 14, {
                width: textWidth,
                align: "center",
            });

        doc
            .fillColor("#999999")
            .fontSize(9)
            .font("Helvetica-Oblique")
            .text(SLOGAN_EMPRESA, textStartX, startY + 33, {
                width: textWidth,
                align: "center",
            });

        doc
            .fillColor("#1a1a2e")
            .fontSize(12)
            .font("Helvetica-Bold")
            .text(titulo, textStartX, startY + 50, {
                width: textWidth,
                align: "center",
            });

        if (subtitulo) {
            doc
                .fillColor("#555555")
                .fontSize(10)
                .font("Helvetica-Bold")
                .text(subtitulo, textStartX, startY + 66, {
                    width: textWidth,
                    align: "center",
                });
        }

        doc
            .fillColor("#555555")
            .fontSize(8)
            .font("Helvetica")
            .text(`Fecha: ${new Date().toLocaleDateString("es-CO")}`, startX + 15, startY + 84)
            .text(
                `Hora: ${new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true })}`,
                startX,
                startY + 84,
                { width: pageWidth - 15, align: "right" }
            );

        doc.fillColor("#000000");
        doc.y = startY + boxHeight + 15;
    }

    // ==========================
    // RESUMEN (inventario, sin cambios)
    // ==========================
    _dibujarResumen(doc, resumen) {
        const startX = doc.page.margins.left;
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        let y = doc.y;

        const titleHeight = 20;
        doc.rect(startX, y, pageWidth, titleHeight).fillAndStroke("#7a1f3d", "#7a1f3d");
        doc
            .fillColor("#ffffff")
            .fontSize(10)
            .font("Helvetica-Bold")
            .text("RESUMEN DEL INVENTARIO", startX, y + 5, { width: pageWidth, align: "center" });

        y += titleHeight;

        const columnas = [
            { label: "Total\nProductos", value: resumen.totalProductos },
            { label: "Con Stock", value: resumen.productosConStock },
            { label: "Sin Stock", value: resumen.productosSinStock },
            { label: "Stock Bajo", value: resumen.productosConStockBajo },
            { label: "Próx. a\nVencer", value: resumen.productosProximosAVencer },
        ];

        const colWidth = pageWidth / columnas.length;
        const rowHeight = 42;

        columnas.forEach((col, i) => {
            const x = startX + i * colWidth;

            doc.rect(x, y, colWidth, rowHeight).stroke("#cccccc");

            doc
                .fillColor("#555555")
                .fontSize(8)
                .font("Helvetica")
                .text(col.label, x + 2, y + 7, { width: colWidth - 4, align: "center" });

            doc
                .fillColor("#7a1f3d")
                .fontSize(17)
                .font("Helvetica-Bold")
                .text(String(col.value), x + 2, y + 22, { width: colWidth - 4, align: "center" });
        });

        doc.fillColor("#000000");
        doc.y = y + rowHeight + 20;
    }

    // ==========================
    // INDICADORES FINANCIEROS (inventario, sin cambios)
    // ==========================
    _dibujarIndicadoresFinancieros(doc, resumen) {
        const startX = doc.page.margins.left;
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        let y = doc.y;

        doc
            .fillColor("#000000")
            .fontSize(12)
            .font("Helvetica-Bold")
            .text("Indicadores Financieros", startX, y);

        y += 20;

        const filas = [
            { label: "Costo total inventario", value: resumen.costoTotalInventario },
            { label: "Valor potencial ventas", value: resumen.valorPotencialVentas },
            { label: "Ganancia potencial", value: resumen.gananciaPotencial },
        ];

        filas.forEach((fila) => {
            const valorTexto = this._formatearMoneda(fila.value);

            doc.fontSize(10).font("Helvetica").fillColor("#333333");
            doc.text(fila.label, startX, y);

            const labelWidth = doc.widthOfString(fila.label);
            const valorWidth = doc.widthOfString(valorTexto);
            const puntosDisponibles = pageWidth - labelWidth - valorWidth - 10;
            const anchoPunto = doc.widthOfString(".");
            const numPuntos = Math.max(0, Math.floor(puntosDisponibles / anchoPunto));

            doc
                .fillColor("#999999")
                .text(".".repeat(numPuntos), startX + labelWidth + 3, y);

            doc
                .fillColor("#7a1f3d")
                .font("Helvetica-Bold")
                .text(valorTexto, startX, y, { width: pageWidth, align: "right" });

            y += 17;
        });

        y += 8;
        doc.moveTo(startX, y).lineTo(startX + pageWidth, y).lineWidth(1.5).stroke("#7a1f3d");

        doc.fillColor("#000000");
        doc.y = y + 20;
    }

    // ==========================
    // TABLA DE DETALLE (inventario, sin cambios)
    // ==========================
    _dibujarDetalleInventario(doc, inventario) {
        const startX = doc.page.margins.left;
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        doc
            .fillColor("#000000")
            .fontSize(12)
            .font("Helvetica-Bold")
            .text("Detalle del Inventario", startX, doc.y);

        doc.y += 16;

        const columnas = [
            { key: "codigo_producto", label: "Código", width: 0.12 },
            { key: "nombre_producto", label: "Producto", width: 0.28 },
            { key: "stock", label: "Stock", width: 0.12 },
            { key: "costo_produccion", label: "Costo", width: 0.16 },
            { key: "precio_venta", label: "Venta", width: 0.16 },
            { key: "estado", label: "Estado", width: 0.16 },
        ];

        const colWidths = columnas.map((c) => Math.floor(c.width * pageWidth));
        const rowHeight = 20;
        const headerHeight = 22;

        const dibujarEncabezadoTabla = () => {
            let x = startX;
            const y = doc.y;

            doc.rect(startX, y, pageWidth, headerHeight).fillAndStroke("#7a1f3d", "#7a1f3d");

            doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
            columnas.forEach((col, i) => {
                doc.text(col.label, x + 4, y + 7, { width: colWidths[i] - 8, align: "left" });
                x += colWidths[i];
            });

            doc.y = y + headerHeight;
        };

        dibujarEncabezadoTabla();
        doc.font("Helvetica").fontSize(9);

        inventario.forEach((producto, idx) => {
            if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 40) {
                doc.addPage();
                doc.y = doc.page.margins.top;
                dibujarEncabezadoTabla();
                doc.font("Helvetica").fontSize(9);
            }

            const y = doc.y;
            let x = startX;

            if (idx % 2 === 0) {
                doc.rect(startX, y, pageWidth, rowHeight).fill("#f4f4f7");
            }

            const colorEstado = this._colorPorEstado(producto.estado);

            const valores = [
                producto.codigo_producto,
                producto.nombre_producto,
                String(producto.stock),
                this._formatearMoneda(producto.costo_produccion, false),
                this._formatearMoneda(producto.precio_venta, false),
                producto.estado,
            ];

            valores.forEach((valor, i) => {
                doc.fillColor(i === 5 ? colorEstado : "#000000");
                doc.text(valor, x + 4, y + 6, {
                    width: colWidths[i] - 8,
                    align: i === 2 || i === 3 || i === 4 ? "right" : "left",
                    ellipsis: true,
                });
                x += colWidths[i];
            });

            doc.rect(startX, y, pageWidth, rowHeight).stroke("#dddddd");
            doc.y = y + rowHeight;
        });

        doc.fillColor("#000000");
    }

    // ==========================
    // DATOS DE LA VENTA
    // ==========================
    _dibujarDatosVenta(doc, venta) {
        const startX = doc.page.margins.left;
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const y = doc.y;

        // "2026-07-23" se interpreta como UTC y en Colombia saldría el día anterior: se arma en hora local
        const [a, m, d] = String(venta.fecha ?? "").slice(0, 10).split("-").map(Number);
        const fechaFormateada = a ? new Date(a, m - 1, d).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) : "—";

        const c = venta.cliente;
        const u = venta.usuario;
        const nombre = (p, n, ap) => (p ? `${p[n] ?? ""} ${p[ap] ?? ""}`.trim() : "");

        const columnaIzq = [
            ["Cliente", nombre(c, "nombre_cliente", "apellido_cliente") || "Cliente no registrado"],
            ["Identificación", c?.identificacion ?? "—"],
            ["Teléfono", c?.telefono_cliente || "—"],
            ["Dirección", [c?.direccion_cliente, c?.ciudad_cliente].filter(Boolean).join(", ") || "—"],
        ];
        const columnaDer = [
            ["Fecha de venta", fechaFormateada],
            ["Vendedor", nombre(u, "nombre_usuario", "apellido_usuario") || "Vendedor no registrado"],
            ["Correo cliente", c?.correo_cliente || "—"],
            ["Productos", `${venta.cantidad_items ?? "—"}`],
        ];

        const filaAlto = 17;
        const boxHeight = columnaIzq.length * filaAlto + 16;
        doc.rect(startX, y, pageWidth, boxHeight).stroke("#cccccc");

        const mitad = pageWidth / 2;
        const dibujarColumna = (filas, x) => {
            filas.forEach(([etiqueta, valor], i) => {
                const fy = y + 10 + i * filaAlto;
                doc.fontSize(9).font("Helvetica-Bold").fillColor("#7a1f3d").text(`${etiqueta}:`, x, fy, { width: 85 });
                doc.font("Helvetica").fillColor("#333333").text(String(valor), x + 88, fy, { width: mitad - 100, ellipsis: true, lineBreak: false });
            });
        };
        dibujarColumna(columnaIzq, startX + 10);
        dibujarColumna(columnaDer, startX + mitad + 5);

        doc.fillColor("#000000");
        doc.y = y + boxHeight + 20;
    }

    // ==========================
    // TABLA DE PRODUCTOS (factura)
    // ==========================
    _dibujarDetalleFactura(doc, detalles) {
        const startX = doc.page.margins.left;
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        doc
            .fillColor("#000000")
            .fontSize(12)
            .font("Helvetica-Bold")
            .text("Detalle de Productos", startX, doc.y);

        doc.y += 16;

        const columnas = [
            { label: "Producto", width: 0.34 },
            { label: "Cant.", width: 0.10 },
            { label: "Precio unit.", width: 0.18 },
            { label: "IVA %", width: 0.12 },
            { label: "Subtotal", width: 0.13 },
            { label: "Total", width: 0.13 },
        ];

        const colWidths = columnas.map((c) => Math.floor(c.width * pageWidth));
        const rowHeight = 20;
        const headerHeight = 22;

        const dibujarEncabezadoTabla = () => {
            let x = startX;
            const y = doc.y;

            doc.rect(startX, y, pageWidth, headerHeight).fillAndStroke("#7a1f3d", "#7a1f3d");

            doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold");
            columnas.forEach((col, i) => {
                doc.text(col.label, x + 4, y + 7, { width: colWidths[i] - 8, align: "left" });
                x += colWidths[i];
            });

            doc.y = y + headerHeight;
        };

        dibujarEncabezadoTabla();
        doc.font("Helvetica").fontSize(9);

        detalles.forEach((item, idx) => {
            if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 40) {
                doc.addPage();
                doc.y = doc.page.margins.top;
                dibujarEncabezadoTabla();
                doc.font("Helvetica").fontSize(9);
            }

            const y = doc.y;
            let x = startX;

            if (idx % 2 === 0) {
                doc.rect(startX, y, pageWidth, rowHeight).fill("#f4f4f7");
            }

            const nombreProducto = item.producto?.nombre_producto || `Producto #${item.fk_det_venta_id_producto}`;

            const valores = [
                nombreProducto,
                String(item.cantidad),
                this._formatearMoneda(item.precio_venta, false),
                `${Number(item.iva_producto).toFixed(2)}%`,
                this._formatearMoneda(item.subtotal, false),
                this._formatearMoneda(item.total, false),
            ];

            doc.fillColor("#000000");
            valores.forEach((valor, i) => {
                doc.text(valor, x + 4, y + 6, {
                    width: colWidths[i] - 8,
                    align: i === 0 ? "left" : "right",
                    ellipsis: true,
                });
                x += colWidths[i];
            });

            doc.rect(startX, y, pageWidth, rowHeight).stroke("#dddddd");
            doc.y = y + rowHeight;
        });

        doc.fillColor("#000000");
        doc.y += 15;
    }

    // ==========================
    // TOTALES DE LA FACTURA
    // ==========================
    _dibujarTotalesFactura(doc, venta) {
        const startX = doc.page.margins.left;
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        let y = doc.y;

        const filas = [
            { label: "Subtotal", value: venta.subtotal },
            { label: "IVA", value: venta.iva },
            { label: "Descuento", value: venta.descuento || 0 },
        ];

        filas.forEach((fila) => {
            const valorTexto = this._formatearMoneda(fila.value);

            doc.fontSize(10).font("Helvetica").fillColor("#333333");
            doc.text(fila.label, startX, y, { width: pageWidth * 0.7, align: "right" });

            doc
                .fillColor("#7a1f3d")
                .font("Helvetica-Bold")
                .text(valorTexto, startX, y, { width: pageWidth, align: "right" });

            y += 17;
        });

        y += 5;
        doc.moveTo(startX, y).lineTo(startX + pageWidth, y).lineWidth(1.5).stroke("#7a1f3d");
        y += 10;

        doc.fontSize(13).font("Helvetica-Bold").fillColor("#7a1f3d");
        doc.text("TOTAL A PAGAR", startX, y, { width: pageWidth * 0.7, align: "right" });
        doc.text(this._formatearMoneda(venta.total), startX, y, { width: pageWidth, align: "right" });

        doc.fillColor("#000000");
        doc.y = y + 30;
    }

    // ==========================
    // PIE DE PÁGINA
    // ==========================
    _dibujarPiePagina(doc) {
        const range = doc.bufferedPageRange();

        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);

            const startX = doc.page.margins.left;
            const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const y = doc.page.height - doc.page.margins.bottom + 15;
            // El pie queda dentro del margen inferior: sin esto PDFKit agrega páginas en blanco
            const margenInferior = doc.page.margins.bottom;
            doc.page.margins.bottom = 0;

            doc
                .fontSize(8)
                .font("Helvetica")
                .fillColor("#666666")
                .text(`Página ${i + 1} de ${range.count}`, startX, y, { width: pageWidth / 2, align: "left" })
                .text(`${NOMBRE_EMPRESA} - ${SLOGAN_EMPRESA}`, startX, y, {
                    width: pageWidth,
                    align: "right",
                });
            doc.page.margins.bottom = margenInferior;
        }
    }

    // ==========================
    // HELPERS
    // ==========================
    _formatearMoneda(valor, conSimbolo = true) {
        const numero = Number(valor) || 0;
        const texto = numero.toLocaleString("es-CO", { maximumFractionDigits: 0 });
        return conSimbolo ? `$${texto}` : texto;
    }

    _colorPorEstado(estado) {
        switch (estado) {
            case "Agotado":
            case "Sin stock":
                return "#c0392b";
            case "Stock Bajo":
                return "#d68910";
            default:
                return "#1e8449";
        }
    }
}

export default new PdfGenerator();