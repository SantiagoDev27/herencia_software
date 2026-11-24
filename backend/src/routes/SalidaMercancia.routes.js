import { Router } from "express";
import { verificarToken, requierePermiso } from '../middleware/authMiddleware.js';
import salidaMercanciaController from "../controllers/SalidaMercancia.controller.js";
import { registrarSalidaValidation } from "../validations/SalidaMercanciaValidations.js";
import { validarCampos } from "../middleware/validarCampos.middleware.js";

const router = Router();

// Toda ruta exige sesión iniciada; por defecto la consulta queda abierta a los tres roles
router.use(verificarToken);

// POST /api/salidas-mercancia
router.post(
    "/",
    registrarSalidaValidation,
    validarCampos,
    requierePermiso('registrarMovimiento'),
    salidaMercanciaController.crearSalida
);

// GET /api/salidas-mercancia
router.get("/", salidaMercanciaController.listarSalidas);

// GET /api/salidas-mercancia/:id
router.get("/:id", salidaMercanciaController.obtenerSalidaPorId);

export default router;