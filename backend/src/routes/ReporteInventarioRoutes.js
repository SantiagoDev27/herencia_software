import {Router} from "express";
import { verificarToken, requierePermiso } from '../middleware/authMiddleware.js';
import ReporteProveedoresController from "../controllers/ReporteProveedoresController.js";
import { generarReporteInventarioValidation } from "../validations/ReporteInventarioValidations.js";
import { validarCampos } from "../middleware/validarCampos.middleware.js";
import ReporteInventarioController from "../controllers/ReporteInventarioController.js";
import ReporteVentasController from "../controllers/ReporteVentasController.js";
import { generarReporteVentasValidation } from "../validations/ReporteVentasValidations.js";

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
    requierePermiso('reportes'),
    ReporteInventarioController.generarReporteInventarioPDF
);

// ============================================
// HU-VEN-008 / HU-CON-008: Reporte general de ventas (Administrador y Finanzas)
// ============================================
router.get(
    "/ventas",
    generarReporteVentasValidation,
    validarCampos,
    requierePermiso('reportes'),
    ReporteVentasController.generarReporteVentas
);

router.get(
    "/ventas/pdf",
    generarReporteVentasValidation,
    validarCampos,
    requierePermiso('reportes'),
    ReporteVentasController.generarReporteVentasPDF
);

// HU-PROV-008: Reporte de proveedores
router.get("/proveedores", generarReporteVentasValidation, validarCampos, requierePermiso('reportes'), ReporteProveedoresController.generar);
router.get("/proveedores/pdf", generarReporteVentasValidation, validarCampos, requierePermiso('reportes'), ReporteProveedoresController.pdf);

export default router;