import {Router} from "express";
import { verificarToken, permitirRoles } from '../middleware/authMiddleware.js';
import { CONTABILIDAD } from '../configuration/roles.js';
import { generarReporteInventarioValidation } from "../validations/ReporteInventarioValidations.js";
import { validarCampos } from "../middleware/validarCampos.middleware.js";
import ReporteInventarioController from "../controllers/ReporteInventarioController.js";

const router = Router();

// Toda ruta exige sesión iniciada; por defecto la consulta queda abierta a los tres roles
router.use(verificarToken);

// Ruta para generar el reporte de inventario
router.get("/inventario",
     generarReporteInventarioValidation,
      validarCampos,
       ReporteInventarioController.generarReporteInventario);

router.get(
    "/inventario/pdf",
    generarReporteInventarioValidation,
    validarCampos,
    permitirRoles(...CONTABILIDAD),
    ReporteInventarioController.generarReporteInventarioPDF
);

export default router;