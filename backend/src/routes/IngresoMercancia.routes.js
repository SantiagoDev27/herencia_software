import { Router } from "express";
import { verificarToken, requierePermiso } from '../middleware/authMiddleware.js';
import IngresoMercanciaController from "../controllers/IngresoMercancia.controller.js";
import { registrarEntradaValidation } from "../validations/ingresoMercancia.validation.js";
import { validarCampos } from "../middleware/validarCampos.middleware.js";

const router = Router();

// Toda ruta exige sesión iniciada; por defecto la consulta queda abierta a los tres roles
router.use(verificarToken);

/**
 * POST /api/ingreso-mercancia
 * Registrar una nueva entrada de mercancía
 */
router.post(
    "/",
    registrarEntradaValidation,
    validarCampos,
    requierePermiso('registrarMovimiento'),
    IngresoMercanciaController.registrarEntrada
);

/**
 * GET /api/ingreso-mercancia
 * Listar todas las entradas
 */
router.get(
    "/",
    IngresoMercanciaController.listarEntradas
);

/**
 * GET /api/ingreso-mercancia/:id
 * Obtener una entrada por su ID
 */
router.get(
    "/:id",
    IngresoMercanciaController.obtenerEntradaPorId
);

export default router;