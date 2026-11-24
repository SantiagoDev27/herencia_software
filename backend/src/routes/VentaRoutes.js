import { Router } from "express";
import { verificarToken, permitirRoles } from '../middleware/authMiddleware.js';
import { OPERACION } from '../configuration/roles.js';
import {
    crearVentaValidation,
    listarVentasValidation
} from "../validations/VentaValidations.js";
import { errorHandler } from "../middleware/errorHandler.js";
import VentaController from "../controllers/VentaController.js";

const router = Router();

// Toda ruta exige sesión iniciada; por defecto la consulta queda abierta a los tres roles
router.use(verificarToken);

router.post(
    "/ventas",
    crearVentaValidation,
    errorHandler,
    permitirRoles(...OPERACION),
    VentaController.crear
);

router.get(
    "/ventas",
    listarVentasValidation,
    errorHandler,
    VentaController.listar
);

router.get(
    "/ventas/:id_venta",
    crearVentaValidation,
    errorHandler,
    VentaController.obtenerPorId
);

router.get(
    "/ventas/codigo/:numero_venta",
    crearVentaValidation,
    errorHandler,
    VentaController.obtenerPorCodigo
);

router.patch(
    "/ventas/:id_venta/recalcular",
    crearVentaValidation,
    errorHandler,
    permitirRoles(...OPERACION),
    VentaController.recalcularTotales
);

router.get(
    "/ventas/:id_venta/factura-pdf",
    crearVentaValidation,
    errorHandler,
    VentaController.generarFacturaPDF
);



export default router;