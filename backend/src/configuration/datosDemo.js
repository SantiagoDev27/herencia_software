/**
 * Datos de demostración de Herencia de Papá: el catálogo real (Instagram) y 15 días
 * de operación simulada. Se cargan solos al iniciar el backend (npm run dev / npm start)
 * la primera vez; en los siguientes arranques no hacen nada. Para no cargarlos, poner
 * DATOS_DEMO=false en el .env.
 *
 * Todo pasa por los mismos servicios que usa la aplicación (órdenes de compra, recepción
 * con lotes, ventas FEFO, anulaciones, devoluciones, salidas, movimientos contables),
 * así que inventario, lotes, contabilidad y auditoría quedan coherentes entre sí.
 * Para fechar cada operación en su día se adelanta el reloj del proceso solo mientras
 * se cargan los datos (antes de que el servidor empiece a atender).
 */
import { Op } from "sequelize";
import "../models/associations-ingreso.js";
import "../models/associations-negocio.js";
import Categoria from "../models/CategoriesModels.js";
import Producto from "../models/ProductModels.js";
import Proveedor from "../models/ProovedorModel.js";
import Cliente from "../models/clienteModel.js";
import Usuario from "../models/UsuariosModels.js";
import Lote from "../models/loteModel.js";
import ProductoProveedor from "../models/Producto-ProovedorModel.js";
import { OrdenCompra, EvaluacionProveedor, CuentaContable, MetodoPago } from "../models/NegocioModels.js";
import ProductoService from "../services/ProductoService.js";
import ProveedorService from "../services/ProveedorService.js";
import ClienteService from "../services/ClienteService.js";
import OrdenCompraService from "../services/OrdenCompraService.js";
import VentaService from "../services/VentaService.js";
import SalidaMercanciaServices from "../services/SalidaMercanciaServices.js";
import ContabilidadService from "../services/ContabilidadService.js";
import AuditoriaRepository from "../repositories/AuditoriaRepository.js";

// ---------------------------------------------------------------------------
// Reloj simulado: mientras se cargan los datos, new Date() y Date.now() devuelven el
// instante simulado (+ el tiempo real transcurrido, para que el pool de conexiones
// siga funcionando). Al terminar se devuelve el reloj real.
// ---------------------------------------------------------------------------
const RealDate = Date;
let desfase = 0;
class RelojSimulado extends RealDate {
    constructor(...args) {
        if (args.length === 0) super(RealDate.now() + desfase);
        else super(...args);
    }
    static now() {
        return RealDate.now() + desfase;
    }
}
const ponerReloj = (fecha) => {
    globalThis.Date = RelojSimulado;
    desfase = fecha.getTime() - RealDate.now();
};
const restaurarReloj = () => {
    desfase = 0;
    globalThis.Date = RealDate;
};

const MARCA = "[simulación]";

// Generador pseudoaleatorio con semilla (misma semilla = misma simulación)
let semilla = 2010;
const azar = () => {
    semilla = (semilla + 0x6d2b79f5) >>> 0;
    let t = semilla;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const entero = (min, max) => min + Math.floor(azar() * (max - min + 1));
const elegir = (lista) => lista[Math.floor(azar() * lista.length)];
const elegirPonderado = (lista, peso) => {
    const total = lista.reduce((s, x) => s + peso(x), 0);
    let r = azar() * total;
    for (const x of lista) {
        r -= peso(x);
        if (r <= 0) return x;
    }
    return lista[lista.length - 1];
};

// Fechas locales
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const sumarDias = (d, n) => { const x = new RealDate(d.getTime()); x.setDate(x.getDate() + n); return x; };
const enHora = (dia, h, m = 0) => new RealDate(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m, entero(0, 59));
const lotecodigo = (d) => iso(d).slice(2).replaceAll("-", "");

// ---------------------------------------------------------------------------
// Catálogo (tomado del catálogo de Instagram de Herencia de Papá)
// ---------------------------------------------------------------------------
const CATEGORIAS = [
    { clave: "postres", nombre: "Postres", descripcion: "Postres caseros en vaso de 8 oz (refrigerados)" },
    { clave: "rellenos", nombre: "Dulces rellenos", descripcion: "Naranjas y limones rellenos de manjar blanco tradicional" },
    { clave: "desamargados", nombre: "Desamargados", descripcion: "Papaya, breva, naranja y limón en almíbar, 100 % naturales" },
    { clave: "confites", nombre: "Cocadas y confites", descripcion: "Cocadas de panela y de leche, masmelos de chocolate" },
    { clave: "pasabocas", nombre: "Pasabocas", descripcion: "Chips de chontaduro y galletas" },
];

const PROVEEDORES = [
    { clave: "postres", nit: "901456321", razon_social: "Postres Doña Rosa S.A.S.", telefono_proveedor: "3164427810", direccion: "Calle 5 # 38-21, San Fernando", ciudad: "Cali", plazo: 1 },
    { clave: "dulces", nit: "900771245", razon_social: "Dulces Típicos del Valle S.A.S.", telefono_proveedor: "3127745520", direccion: "Carrera 4 # 9-60", ciudad: "Palmira", plazo: 2 },
    { clave: "chonta", nit: "901238877", razon_social: "Chontaduros del Pacífico S.A.S.", telefono_proveedor: "3205518842", direccion: "Calle 7 # 3-15", ciudad: "Buenaventura", plazo: 3 },
    { clave: "confites", nit: "900664019", razon_social: "Confitería La Ermita", telefono_proveedor: "3002219034", direccion: "Carrera 10 # 13-40, La Ermita", ciudad: "Cali", plazo: 2 },
    { clave: "galletas", nit: "800215436", razon_social: "Galletería San Antonio Ltda.", telefono_proveedor: "3155098761", direccion: "Calle 2 # 10-35, San Antonio", ciudad: "Cali", plazo: 2 },
];

// precio = precio del catálogo (IVA 0: los precios publicados son finales); vida = días de vida útil del lote
// peso = popularidad relativa en las ventas
const PRODUCTOS = [
    { codigo: "2001", nombre: "Postre de limón 8 oz", cat: "postres", prov: "postres", precio: 10000, costo: 4800, vida: 6, peso: 3.0 },
    { codigo: "2002", nombre: "Arroz con leche 8 oz", cat: "postres", prov: "postres", precio: 10000, costo: 4500, vida: 6, peso: 3.2 },
    { codigo: "2003", nombre: "Postre de tres leches 8 oz", cat: "postres", prov: "postres", precio: 10000, costo: 5200, vida: 5, peso: 4.0 },
    { codigo: "2004", nombre: "Postre de oreo 8 oz", cat: "postres", prov: "postres", precio: 10000, costo: 5300, vida: 6, peso: 3.6 },
    { codigo: "2005", nombre: "Postre de maracuyá 8 oz", cat: "postres", prov: "postres", precio: 10000, costo: 4900, vida: 6, peso: 3.0 },
    { codigo: "2006", nombre: "Postre de milo 8 oz", cat: "postres", prov: "postres", precio: 10000, costo: 5100, vida: 6, peso: 2.8 },
    { codigo: "2101", nombre: "Naranja rellena individual", cat: "rellenos", prov: "dulces", precio: 6000, costo: 2900, vida: 45, peso: 4.2 },
    { codigo: "2102", nombre: "Caja de naranjas rellenas x3", cat: "rellenos", prov: "dulces", precio: 14000, costo: 7300, vida: 45, peso: 2.0 },
    { codigo: "2103", nombre: "Caja de limones rellenos x6", cat: "rellenos", prov: "dulces", precio: 14000, costo: 7100, vida: 45, peso: 2.1 },
    { codigo: "2104", nombre: "Caja mixta (1 naranja + 3 limones)", cat: "rellenos", prov: "dulces", precio: 14000, costo: 7200, vida: 45, peso: 1.6 },
    { codigo: "2201", nombre: "Desamargados 130 ml", cat: "desamargados", prov: "dulces", precio: 10000, costo: 4700, vida: 180, peso: 1.6 },
    { codigo: "2202", nombre: "Desamargados 250 ml", cat: "desamargados", prov: "dulces", precio: 16000, costo: 7800, vida: 180, peso: 1.1 },
    { codigo: "2203", nombre: "Desamargados 500 ml", cat: "desamargados", prov: "dulces", precio: 21000, costo: 10900, vida: 180, peso: 0.7 },
    { codigo: "2301", nombre: "Chontapitas chips de chontaduro 30 g", cat: "pasabocas", prov: "chonta", precio: 6000, costo: 2700, vida: 120, peso: 2.4 },
    { codigo: "2302", nombre: "Galleta negra pequeña x12 (180 g)", cat: "pasabocas", prov: "galletas", precio: 5000, costo: 2300, vida: 60, peso: 2.0 },
    { codigo: "2401", nombre: "Cocadas de panela x40", cat: "confites", prov: "confites", precio: 12000, costo: 6100, vida: 30, peso: 1.5 },
    { codigo: "2402", nombre: "Cocadas de leche x40", cat: "confites", prov: "confites", precio: 12000, costo: 6300, vida: 30, peso: 1.4 },
    { codigo: "2403", nombre: "Masmelos de chocolate x40", cat: "confites", prov: "confites", precio: 12000, costo: 6400, vida: 60, peso: 1.2 },
];

const CLIENTES = [
    ["1144203587", "Valentina", "Ospina Restrepo", "3104456271", "valentina.ospina@gmail.com", "Calle 9 # 44-12, Tequendama"],
    ["1107845120", "Andrés Felipe", "Caicedo Lozano", "3178820145", "andres.caicedo@hotmail.com", "Carrera 66 # 13-40, Limonar"],
    ["31298455", "Luz Marina", "Gómez de Arboleda", "3006612398", "luzmarina.gomez@gmail.com", "Calle 52 # 3N-22, La Merced"],
    ["94512037", "Jorge Enrique", "Valencia Mina", "3157734410", null, "Carrera 39 # 26B-15, El Poblado"],
    ["1130678245", "Daniela", "Sánchez Quintero", "3012247789", "dani.sanchezq@gmail.com", "Calle 18 # 100-30, Ciudad Jardín"],
    ["66845210", "María Eugenia", "Lasso Bermúdez", "3168890032", "maru.lasso@yahoo.com", "Avenida 6N # 28-14, Santa Mónica"],
    ["1006389214", "Santiago", "Rengifo Paz", "3225561902", "santi.rengifo@gmail.com", "Carrera 1 # 70-15, Floralia"],
    ["29117634", "Carmen Elisa", "Mosquera Riascos", "3147720581", null, "Calle 33 # 11D-20, El Troncal"],
    ["1112468035", "Camila", "Hurtado Benítez", "3186643025", "camila.hurtado@outlook.com", "Calle 16 # 56-40, Pampalinda"],
    ["900845632", "Eventos y Banquetes", "El Peñón S.A.S.", "6023964410", "compras@eventoselpenon.com", "Carrera 3 Oeste # 2-48, El Peñón"],
    ["16754320", "Hernando", "Cifuentes Arango", "3112209874", "hcifuentes@gmail.com", "Calle 5 # 66-80, El Refugio"],
    ["1143852916", "Natalia", "Escobar Vidal", "3014478853", "nata.escobar@gmail.com", "Carrera 98 # 42-11, Valle del Lili"],
];

// ---------------------------------------------------------------------------
// Preparación
// ---------------------------------------------------------------------------
const log = (...m) => console.log(...m);
let resumen = { ordenes: 0, recibidas: 0, canceladas: 0, ventas: 0, anuladas: 0, editadas: 0, devoluciones: 0, bajas: 0, egresos: 0, ingresos: 0, evaluaciones: 0, ventasValor: 0, sinStock: 0 };

async function cargarCatalogo(diaAlta) {
    ponerReloj(enHora(diaAlta, 7, 0));
    const categorias = {};
    for (const c of CATEGORIAS) {
        let cat = await Categoria.findOne({ where: { nombre_categoria: c.nombre } });
        if (!cat) cat = await Categoria.create({ nombre_categoria: c.nombre, descripcion: c.descripcion });
        categorias[c.clave] = cat.id_categoria;
    }

    const proveedores = {};
    for (const p of PROVEEDORES) {
        let prov = await Proveedor.findOne({ where: { nit: p.nit }, paranoid: false });
        if (!prov) prov = await ProveedorService.registrarProveedor({ nit: p.nit, razon_social: p.razon_social, telefono_proveedor: p.telefono_proveedor, direccion: p.direccion, ciudad: p.ciudad });
        else if (prov.deleted_at) await prov.restore();
        proveedores[p.clave] = { ...p, id: prov.id_proveedor };
    }

    const productos = [];
    let creados = 0;
    for (const p of PRODUCTOS) {
        let prod = await Producto.findOne({ where: { codigo_producto: p.codigo }, paranoid: false });
        if (!prod) {
            prod = await ProductoService.registrarProducto({
                codigo_producto: p.codigo, nombre_producto: p.nombre, stock: 0,
                costo_produccion: p.costo, precio_venta: p.precio, iva: 0,
                fk_producto_id_categoria: categorias[p.cat],
            });
            creados++;
        } else if (prod.deleted_at) {
            await prod.restore();
        }
        const prov = proveedores[p.prov];
        const relacion = await ProductoProveedor.findOne({ where: { fk_producto_proveedor_id_proveedor: prov.id, fk_producto_proveedor_id_producto: prod.id_producto } });
        if (!relacion) await ProveedorService.asociarProductoAProveedor(prov.id, prod.id_producto, p.costo);
        productos.push({ ...p, id: prod.id_producto, proveedor: prov });
    }
    log(`📦 Catálogo: ${productos.length} productos (${creados} nuevos), ${CATEGORIAS.length} categorías, ${PROVEEDORES.length} proveedores.`);

    const clientes = [];
    for (const [identificacion, nombre, apellido, telefono, correo, direccion] of CLIENTES) {
        let cli = await Cliente.findOne({ where: { identificacion } });
        if (!cli) {
            cli = await ClienteService.crear({
                identificacion, nombre_cliente: nombre, apellido_cliente: apellido,
                telefono_cliente: telefono, correo_cliente: correo, direccion_cliente: direccion, ciudad_cliente: "Cali",
            });
        }
        clientes.push(cli.id_cliente);
    }
    log(`👥 Clientes frecuentes: ${clientes.length}.`);
    return { productos, proveedores: Object.values(proveedores), clientes };
}

async function usuariosDelSistema() {
    const activos = await Usuario.findAll({ order: [["idusuario", "ASC"]] });
    const porRol = (rol) => activos.filter((u) => Number(u.fk_usuario_id_rol) === rol);
    const admin = porRol(1)[0];
    if (!admin) throw new Error("No hay un usuario administrador todavía (node src/scrips/seedUsuario.js); se cargarán en el próximo arranque.");
    const vendedores = porRol(2).length ? porRol(2) : [admin];
    const finanzas = porRol(3)[0] || admin;
    return { admin, vendedores, finanzas };
}

async function cuentaPorCodigo(codigo) {
    const c = await CuentaContable.findOne({ where: { codigo } });
    if (!c) throw new Error(`Falta la cuenta contable ${codigo}.`);
    return c.id_cuenta;
}

async function metodos() {
    const filas = await MetodoPago.findAll();
    const id = (nombre, defecto) => filas.find((m) => m.metodo_pago.toLowerCase() === nombre)?.id_metodo_pago ?? defecto;
    return {
        efectivo: id("efectivo", 1), debito: id("tarjeta debito", 2), credito: id("tarjeta credito", 3),
        transferencia: id("transferencia", 4), nequi: id("nequi", 5),
    };
}

// ---------------------------------------------------------------------------
// Simulación
// ---------------------------------------------------------------------------
async function stockDisponible(idProducto) {
    return (await Lote.sum("cantidad_actual", { where: { fk_lote_id_producto: idProducto } })) || 0;
}

// Unidades vendidas por día que se esperan de cada producto (para pedir a los proveedores)
const VENTAS_DIA = 24;
const UNIDADES_POR_VENTA = 1.55 * 1.38;
const pesoTotal = PRODUCTOS.reduce((s, p) => s + p.peso, 0);
const demandaDiaria = (p) => (VENTAS_DIA * 1.1 * UNIDADES_POR_VENTA * p.peso) / pesoTotal;

const redondearA = (n, paquete) => Math.max(paquete, Math.ceil(n / paquete) * paquete);

async function revisarReposicion(dia, ctx, { inicial = false, cancelarUna = false } = {}) {
    // Pedidos pendientes por proveedor (para no duplicar)
    const pendientes = await OrdenCompra.findAll({ where: { estado: "Pendiente" } });
    const conPedido = new Set(pendientes.map((o) => o.fk_orden_compra_id_proveedor));
    const porProveedor = new Map();
    for (const p of ctx.productos) {
        if (conPedido.has(p.proveedor.id)) continue;
        const stock = await stockDisponible(p.id);
        const d = demandaDiaria(p);
        const esPostre = p.cat === "postres";
        const puntoPedido = esPostre ? d * 3.2 : d * (p.proveedor.plazo + 3);
        if (!inicial && stock > puntoPedido) continue;
        const cobertura = esPostre ? 4.5 : 10;
        const cantidad = redondearA(d * cobertura - (inicial ? 0 : stock * 0.5), esPostre ? 6 : 12);
        if (!porProveedor.has(p.proveedor.clave)) porProveedor.set(p.proveedor.clave, []);
        porProveedor.get(p.proveedor.clave).push({ p, cantidad });
    }

    const creadas = [];
    for (const [clave, lineas] of porProveedor) {
        const prov = ctx.proveedores.find((x) => x.clave === clave);
        // Si hay productos del mismo proveedor que no llegaron al punto de pedido, se aprovecha el pedido
        for (const p of ctx.productos.filter((x) => x.proveedor.clave === clave && !lineas.some((l) => l.p.id === x.id))) {
            const stock = await stockDisponible(p.id);
            if (stock < demandaDiaria(p) * (p.cat === "postres" ? 3 : 6)) lineas.push({ p, cantidad: redondearA(demandaDiaria(p) * (p.cat === "postres" ? 3 : 8), p.cat === "postres" ? 6 : 12) });
        }
        ponerReloj(enHora(dia, 7, entero(5, 40)));
        const plazo = inicial ? 0 : prov.plazo;
        const orden = await OrdenCompraService.crear({
            fk_proveedor: prov.id,
            fecha_entrega_estimada: iso(sumarDias(dia, plazo)),
            observacion: `${MARCA} ${inicial ? "Pedido de apertura del inventario" : "Reposición por punto de pedido"}`,
            detalles: lineas.map((l) => ({ fk_producto: l.p.id, cantidad: l.cantidad })),
        }, ctx.usuarios.admin);
        resumen.ordenes++;
        creadas.push({ orden, prov, lineas, llega: sumarDias(dia, plazo) });
    }

    // Una orden cancelada (el proveedor no tenía disponibilidad) que se vuelve a pedir al día siguiente
    if (cancelarUna && creadas.length) {
        const c = creadas.find((x) => x.prov.clave !== "postres") || creadas[0];
        ponerReloj(enHora(dia, 9, 15));
        await OrdenCompraService.cancelar(c.orden.id_orden_compra, "El proveedor informó que no tiene disponibilidad esta semana", ctx.usuarios.admin);
        resumen.canceladas++;
        creadas.splice(creadas.indexOf(c), 1);
    }
    ctx.porRecibir.push(...creadas);
}

async function recibirOrdenes(dia, ctx) {
    const hoy = iso(dia);
    const llegan = ctx.porRecibir.filter((o) => iso(o.llega) <= hoy);
    ctx.porRecibir = ctx.porRecibir.filter((o) => iso(o.llega) > hoy);
    for (const { orden, prov, lineas } of llegan) {
        ponerReloj(enHora(dia, 8, entero(0, 50)));
        const vigente = await OrdenCompra.findByPk(orden.id_orden_compra);
        if (!vigente || vigente.estado !== "Pendiente") continue;
        await OrdenCompraService.recibir(orden.id_orden_compra, {
            registrar_pago: true,
            fk_metodo_pago: ctx.metodos.transferencia,
            detalles: lineas.map(({ p }) => ({
                fk_producto: p.id,
                numero_lote: `${p.codigo}-${lotecodigo(dia)}`,
                fecha_produccion: iso(sumarDias(dia, p.cat === "postres" ? -1 : -entero(3, 10))),
                fecha_vencimiento: iso(sumarDias(dia, p.vida)),
            })),
        }, ctx.usuarios.admin);
        resumen.recibidas++;

        // De vez en cuando, el administrador califica al proveedor tras la entrega
        if (azar() < 0.45) {
            ponerReloj(enHora(dia, 8, 55));
            const puntual = prov.clave === "chonta" ? entero(3, 4) : entero(4, 5);
            const calidad = entero(4, 5);
            const respuesta = prov.clave === "chonta" ? entero(3, 4) : entero(4, 5);
            await EvaluacionProveedor.create({
                fk_evaluacion_id_proveedor: prov.id, fecha: new Date(),
                cumplimiento: puntual, calidad, tiempo_respuesta: respuesta,
                calificacion: Math.round(((puntual + calidad + respuesta) / 3) * 100) / 100,
                observaciones: `${MARCA} ${elegir(["Entrega completa y bien empacada", "Producto en buen estado", "Llegó un poco tarde pero completo", "Buena cadena de frío"])}`,
                fk_evaluacion_id_usuario: ctx.usuarios.admin.idusuario,
            });
            await AuditoriaRepository.registrar({ idusuario: ctx.usuarios.admin.idusuario, correo: ctx.usuarios.admin.correo_usuario, accion: "EVALUAR_PROVEEDOR", detalle: `${prov.razon_social}: ${Math.round(((puntual + calidad + respuesta) / 3) * 100) / 100}/5` });
            resumen.evaluaciones++;
        }
    }
}

// Lotes vencidos con existencias: se dan de baja con una salida de mercancía antes de abrir
async function darDeBajaVencidos(dia, ctx) {
    const vencidos = await Lote.findAll({ where: { fecha_vencimiento: { [Op.lt]: iso(dia) }, cantidad_actual: { [Op.gt]: 0 } } });
    if (!vencidos.length) return;
    const porProducto = new Map();
    for (const l of vencidos) porProducto.set(l.fk_lote_id_producto, (porProducto.get(l.fk_lote_id_producto) || 0) + l.cantidad_actual);
    ponerReloj(enHora(dia, 7, 50));
    ctx.bajas++;
    await SalidaMercanciaServices.crearSalida(
        { codigo_salida: `BAJA-${lotecodigo(dia)}-${ctx.bajas}`, fecha: new Date(), observacion: `${MARCA} Baja por vencimiento de lotes` },
        [...porProducto].map(([id, cantidad]) => ({ fk_det_salida_id_producto: id, cantidad })),
    );
    resumen.bajas++;
}

// Degustaciones en fin de semana (salida de mercancía sin venta)
async function degustacion(dia, ctx) {
    const postres = ctx.productos.filter((p) => p.cat === "postres");
    const p = elegir(postres);
    if ((await stockDisponible(p.id)) < 4) return;
    ponerReloj(enHora(dia, 10, 0));
    ctx.bajas++;
    await SalidaMercanciaServices.crearSalida(
        { codigo_salida: `DEG-${lotecodigo(dia)}-${ctx.bajas}`, fecha: new Date(), observacion: `${MARCA} Degustación en el punto de venta` },
        [{ fk_det_salida_id_producto: p.id, cantidad: 2 }],
    );
    resumen.bajas++;
}

function metodoDePago(ctx, total) {
    const r = azar();
    if (total >= 40000 && r < 0.3) return ctx.metodos.credito;
    if (r < 0.45) return ctx.metodos.efectivo;
    if (r < 0.72) return ctx.metodos.nequi;
    if (r < 0.88) return ctx.metodos.transferencia;
    return ctx.metodos.debito;
}

async function armarCanasta(ctx, { lineas, corporativo = false }) {
    const canasta = [];
    const usados = new Set();
    for (let i = 0; i < lineas; i++) {
        const p = elegirPonderado(ctx.productos.filter((x) => !usados.has(x.id)), (x) => x.peso);
        usados.add(p.id);
        let cantidad = corporativo ? entero(6, 15) : elegirPonderado([1, 2, 3], (q) => ({ 1: 70, 2: 22, 3: 8 }[q]));
        const disponible = await stockDisponible(p.id);
        if (disponible < cantidad) resumen.sinStock++;
        cantidad = Math.min(cantidad, disponible);
        if (cantidad > 0) canasta.push({ fk_det_venta_id_producto: p.id, cantidad });
    }
    return canasta;
}

async function venderDia(dia, ctx, indice) {
    const finDeSemana = [0, 6].includes(dia.getDay());
    const esQuincena = [15, 30, 31].includes(dia.getDate()) || dia.getDate() === 1;
    const esHoy = iso(dia) === iso(new RealDate());
    let numero = Math.round(VENTAS_DIA * (finDeSemana ? 1.35 : 1) * (esQuincena ? 1.2 : 1) * (0.8 + azar() * 0.4));
    // Hoy solo se simula hasta la hora actual
    const horaLimite = esHoy ? Math.max(9, new RealDate().getHours()) : 19;
    if (esHoy) numero = Math.max(2, Math.round((numero * (horaLimite - 9)) / 10));

    const minutos = Array.from({ length: numero }, () => entero(9 * 60, horaLimite * 60 + 30)).sort((a, b) => a - b);
    const ventasDelDia = [];
    for (const m of minutos) {
        const corporativo = !finDeSemana && azar() < 0.025;
        const canasta = await armarCanasta(ctx, { lineas: corporativo ? entero(2, 4) : elegirPonderado([1, 2, 3], (n) => ({ 1: 55, 2: 35, 3: 10 }[n])), corporativo });
        if (!canasta.length) continue;
        ponerReloj(enHora(dia, Math.floor(m / 60), m % 60));
        const cliente = corporativo ? ctx.clientes[9] : azar() < 0.42 ? elegir(ctx.clientes) : null;
        const bruto = (await Promise.all(canasta.map(async (l) => Number((await Producto.findByPk(l.fk_det_venta_id_producto)).precio_venta) * l.cantidad))).reduce((a, b) => a + b, 0);
        const descuento = corporativo ? Math.round(bruto * 0.1) : (cliente && bruto >= 30000 && azar() < 0.25 ? 2000 : 0);
        const vendedor = ctx.usuarios.vendedores[Math.floor(m / 60) < 14 ? 0 : (ctx.usuarios.vendedores.length > 1 ? 1 : 0)];
        const { venta } = await VentaService.crearVentaCompleta({
            fecha: iso(dia),
            fk_venta_id_cliente: cliente,
            fk_venta_id_metodopago: metodoDePago(ctx, bruto),
            fk_venta_id_usuario: vendedor.idusuario,
            descuento,
        }, canasta);
        await AuditoriaRepository.registrar({ idusuario: vendedor.idusuario, correo: vendedor.correo_usuario, accion: "REGISTRAR_VENTA", detalle: `Venta ${venta.numero_venta} por ${venta.total}` });
        resumen.ventas++;
        resumen.ventasValor += Number(venta.total);
        ventasDelDia.push({ venta, vendedor, canasta, minuto: m });
    }

    // Anulación del día (aprox. cada 3 días)
    if (ventasDelDia.length > 3 && azar() < 0.33) {
        const v = elegir(ventasDelDia.slice(0, -1));
        ventasDelDia.splice(ventasDelDia.indexOf(v), 1);
        ponerReloj(enHora(dia, Math.floor(v.minuto / 60), Math.min(59, (v.minuto % 60) + 12)));
        await VentaService.anularVenta(v.venta.id_venta, elegir([
            "El cliente desistió de la compra antes de pagar",
            "Venta registrada dos veces por error",
            "El pago con tarjeta fue rechazado",
        ]), v.vendedor);
        resumen.anuladas++;
    }

    // Modificación del mismo día: el cliente agrega un producto (aprox. cada 4 días)
    if (ventasDelDia.length > 2 && azar() < 0.27) {
        const v = elegir(ventasDelDia);
        const extra = ctx.productos.find((p) => p.codigo === "2101");
        if (!v.canasta.some((l) => l.fk_det_venta_id_producto === extra.id) && (await stockDisponible(extra.id)) > 0) {
            ponerReloj(enHora(dia, Math.floor(v.minuto / 60), Math.min(59, (v.minuto % 60) + 5)));
            await VentaService.actualizarVenta(v.venta.id_venta, { detalles: [...v.canasta, { fk_det_venta_id_producto: extra.id, cantidad: 1 }] }, v.vendedor);
            resumen.editadas++;
        }
    }
    ctx.ventasPorDia[indice] = ventasDelDia;
}

// Devoluciones: un día después de la venta (postre en mal estado, caja golpeada, producto equivocado)
const DEVOLUCIONES = [
    { dias: 3, cat: "postres", motivo: "Postre con sabor ácido, cadena de frío rota", reintegrar: false },
    { dias: 7, cat: "rellenos", motivo: "Caja golpeada durante el domicilio", reintegrar: false },
    { dias: 11, cat: null, motivo: "El cliente pidió otro producto (cambio)", reintegrar: true },
];

async function devolucionesDelDia(dia, ctx, indice) {
    for (const d of DEVOLUCIONES.filter((x) => x.dias === indice)) {
        const candidatas = (ctx.ventasPorDia[indice - 1] || []).filter((v) => v.canasta.some((l) => !d.cat || ctx.productos.find((p) => p.id === l.fk_det_venta_id_producto).cat === d.cat));
        if (!candidatas.length) continue;
        const v = elegir(candidatas);
        const linea = v.canasta.find((l) => !d.cat || ctx.productos.find((p) => p.id === l.fk_det_venta_id_producto).cat === d.cat);
        ponerReloj(enHora(dia, 11, entero(0, 40)));
        await VentaService.registrarDevolucion(v.venta.id_venta, {
            motivo: d.motivo, reintegrar: d.reintegrar,
            detalles: [{ fk_producto: linea.fk_det_venta_id_producto, cantidad: 1 }],
        }, v.vendedor);
        resumen.devoluciones++;
    }
}

// Gastos fijos y variables del negocio
async function movimientosDelDia(dia, ctx, indice) {
    const egreso = async (h, codigo, concepto, valor, metodo, observaciones) => {
        ponerReloj(enHora(dia, h, entero(0, 50)));
        await ContabilidadService.registrarMovimiento("egreso", { fecha: iso(dia), concepto, fk_cuenta: await cuentaPorCodigo(codigo), fk_metodo_pago: metodo, valor, observaciones: `${MARCA} ${observaciones || ""}`.trim() }, ctx.usuarios.finanzas);
        resumen.egresos++;
    };
    const mes = dia.toLocaleDateString("es-CO", { month: "long" });
    const t = ctx.metodos.transferencia;
    if (indice === 1) await egreso(10, "5120", `Arriendo del local - ${mes}`, 1250000, t, "Local comercial, Cali");
    if (indice === 2) await egreso(15, "5135", "Energía eléctrica EMCALI", 238400, t);
    if (indice === 2) await egreso(15, "5135", "Acueducto y alcantarillado EMCALI", 96700, t);
    if (indice === 4) await egreso(16, "5195", "Empaques, bolsas al vacío y etiquetas", 164500, ctx.metodos.efectivo);
    if (indice === 6) await egreso(17, "5135", "Internet y telefonía", 89900, t);
    if (indice === 8) await egreso(11, "5195", "Pauta en Instagram (catálogo de postres)", 120000, ctx.metodos.credito);
    if (indice === 12) await egreso(16, "5195", "Mantenimiento de la nevera exhibidora", 180000, ctx.metodos.efectivo);
    if ([4, 9, 13].includes(indice)) await egreso(18, "5195", "Mensajería de domicilios", entero(4, 8) * 6000, ctx.metodos.efectivo);
    if ([15, 30].includes(dia.getDate()) || (dia.getDate() === 31)) await egreso(18, "5105", `Nómina quincena - ${mes}`, 1523500, t, "Salario básico + auxilio de transporte del vendedor");
    if (indice === 10) {
        ponerReloj(enHora(dia, 12, 0));
        await ContabilidadService.registrarMovimiento("ingreso", { fecha: iso(dia), concepto: "Venta de cajas de cartón para reciclaje", fk_cuenta: await cuentaPorCodigo("4250"), fk_metodo_pago: ctx.metodos.efectivo, valor: 18000, observaciones: MARCA }, ctx.usuarios.finanzas);
        resumen.ingresos++;
    }
}

// ---------------------------------------------------------------------------
export async function cargarDatosDemo({ dias = 15, semillaInicial = 2010 } = {}) {
    const previa = await OrdenCompra.count({ where: { observacion: { [Op.like]: `${MARCA}%` } } });
    if (previa) return null; // ya se cargaron en un arranque anterior

    semilla = semillaInicial >>> 0;
    resumen = { ordenes: 0, recibidas: 0, canceladas: 0, ventas: 0, anuladas: 0, editadas: 0, devoluciones: 0, bajas: 0, egresos: 0, ingresos: 0, evaluaciones: 0, ventasValor: 0, sinStock: 0 };
    const hoy = new RealDate();
    const inicio = sumarDias(new RealDate(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()), -(dias - 1));

    try {
        const usuarios = await usuariosDelSistema();
        if (!usuarios) return null;
        log(`🍊 Cargando datos de demostración: catálogo y ${dias} días de operación (${iso(inicio)} a ${iso(hoy)})...`);
        const catalogo = await cargarCatalogo(inicio);
        const ctx = { ...catalogo, usuarios, metodos: await metodos(), porRecibir: [], ventasPorDia: {}, bajas: 0 };

        for (let i = 1; i <= dias; i++) {
            const dia = sumarDias(inicio, i - 1);
            if (i === 1) {
                await revisarReposicion(dia, ctx, { inicial: true });
                await recibirOrdenes(dia, ctx);
            } else {
                await darDeBajaVencidos(dia, ctx);
                await recibirOrdenes(dia, ctx);
                await revisarReposicion(dia, ctx, { cancelarUna: i === 5 });
            }
            if (dia.getDay() === 6) await degustacion(dia, ctx);
            await devolucionesDelDia(dia, ctx, i);
            await venderDia(dia, ctx, i);
            await movimientosDelDia(dia, ctx, i);
        }
    } finally {
        restaurarReloj();
    }

    log(`✅ Datos de demostración cargados:`);
    log(`   Órdenes de compra: ${resumen.ordenes} (${resumen.recibidas} recibidas, ${resumen.canceladas} cancelada, ${resumen.ordenes - resumen.recibidas - resumen.canceladas} pendientes)`);
    log(`   Ventas: ${resumen.ventas} por $${resumen.ventasValor.toLocaleString("es-CO")} · anuladas: ${resumen.anuladas} · modificadas: ${resumen.editadas} · devoluciones: ${resumen.devoluciones}`);
    log(`   Salidas (bajas y degustaciones): ${resumen.bajas} · evaluaciones de proveedores: ${resumen.evaluaciones} · gastos registrados: ${resumen.egresos}`);
    return resumen;
}
