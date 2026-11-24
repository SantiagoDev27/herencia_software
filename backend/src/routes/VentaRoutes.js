import { Router } from "express";
import { verificarToken, requierePermiso } from '../middleware/authMiddleware.js';
import { validarCampos } from "../middleware/validarCampos.middleware.js";
import {
    crearVentaValidation, actualizarVentaValidation, anularVentaValidation,
    devolucionValidation, listarVentasValidation, idVentaValidation, rangoValidation
} from "../validations/NegocioValidations.js";
import VentaController from "../controllers/VentaController.js";
import { MetodoPago } from "../models/NegocioModels.js";

const router = Router();

// Toda ruta exige sesión iniciada. Las consultas quedan abiertas a quien vea Ventas.
router.use(verificarToken);

// Métodos de pago (para el formulario de venta)
router.get("/metodos-pago", async (req, res, next) => {
    try {
        res.json({ success: true, data: await MetodoPago.findAll({ order: [["id_metodopago", "ASC"]] }) });
    } catch (error) {
        next(error);
    }
});

// HU-VEN-001: Registrar venta
router.post("/ventas", crearVentaValidation, validarCampos, requierePermiso('registrarVenta'), VentaController.crear);

// HU-VEN-004: Consultar ventas
router.get("/ventas", listarVentasValidation, validarCampos, VentaController.listar);
router.get("/ventas/codigo/:numero_venta", VentaController.obtenerPorCodigo);

// HU-VEN-007: Devoluciones (listado general)
router.get("/devoluciones", rangoValidation, validarCampos, VentaController.listarDevoluciones);
router.get("/devoluciones/:id/comprobante-pdf", VentaController.comprobanteDevolucionPDF);

router.get("/ventas/:id_venta", idVentaValidation, validarCampos, VentaController.obtenerPorId);
router.get("/ventas/:id_venta/factura-pdf", idVentaValidation, validarCampos, VentaController.generarFacturaPDF);

// HU-VEN-002: Modificar venta (solo del día, sin devoluciones)
router.put("/ventas/:id_venta", actualizarVentaValidation, validarCampos, requierePermiso('editarVenta'), VentaController.actualizar);

// HU-VEN-003: Anular venta
router.patch("/ventas/:id_venta/anular", anularVentaValidation, validarCampos, requierePermiso('anularVenta'), VentaController.anular);

// HU-VEN-007: Registrar devolución de una venta
router.post("/ventas/:id_venta/devoluciones", devolucionValidation, validarCampos, requierePermiso('devoluciones'), VentaController.registrarDevolucion);

router.patch("/ventas/:id_venta/recalcular", idVentaValidation, validarCampos, requierePermiso('editarVenta'), VentaController.recalcularTotales);

export default router;
