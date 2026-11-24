import { Router } from "express";
import { verificarToken, requierePermiso } from "../middleware/authMiddleware.js";
import { validarCampos } from "../middleware/validarCampos.middleware.js";
import { crearClienteValidation, actualizarClienteValidation, idValidation } from "../validations/NegocioValidations.js";
import ClienteController from "../controllers/ClienteController.js";

// HU-VEN-006: Gestionar clientes — /api/clientes
const router = Router();
router.use(verificarToken);

router.get("/", ClienteController.listar);
router.get("/:id", idValidation, validarCampos, ClienteController.obtener);
router.post("/", crearClienteValidation, validarCampos, requierePermiso("gestionarClientes"), ClienteController.crear);
router.put("/:id", actualizarClienteValidation, validarCampos, requierePermiso("gestionarClientes"), ClienteController.actualizar);
router.delete("/:id", idValidation, validarCampos, requierePermiso("gestionarClientes"), ClienteController.eliminar);

export default router;
