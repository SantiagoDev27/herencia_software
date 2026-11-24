import { Router } from "express";
import { verificarToken, requierePermiso } from "../middleware/authMiddleware.js";
import { validarCampos } from "../middleware/validarCampos.middleware.js";
import { crearOrdenValidation, recibirOrdenValidation, cancelarOrdenValidation, idValidation, rangoValidation } from "../validations/NegocioValidations.js";
import OrdenCompraController from "../controllers/OrdenCompraController.js";

// HU-PROV-006: Órdenes de compra — /api/ordenes-compra
const router = Router();
router.use(verificarToken, requierePermiso("compras"));

router.get("/", rangoValidation, validarCampos, OrdenCompraController.listar);
router.get("/:id", idValidation, validarCampos, OrdenCompraController.obtener);
router.get("/:id/pdf", idValidation, validarCampos, OrdenCompraController.pdf);
router.post("/", crearOrdenValidation, validarCampos, requierePermiso("gestionarCompras"), OrdenCompraController.crear);
router.patch("/:id/recibir", recibirOrdenValidation, validarCampos, requierePermiso("gestionarCompras"), OrdenCompraController.recibir);
router.patch("/:id/cancelar", cancelarOrdenValidation, validarCampos, requierePermiso("gestionarCompras"), OrdenCompraController.cancelar);

export default router;
