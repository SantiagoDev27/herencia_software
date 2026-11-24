import { Router } from "express";
import { verificarToken, requierePermiso } from "../middleware/authMiddleware.js";
import { validarCampos } from "../middleware/validarCampos.middleware.js";
import {
    crearCuentaValidation, actualizarCuentaValidation, estadoCuentaValidation, movimientoValidation,
    anularMovimientoValidation, rangoValidation, fechaCorteValidation, idValidation,
} from "../validations/NegocioValidations.js";
import C from "../controllers/ContabilidadController.js";

// HU-CON-001 a HU-CON-008: Gestión contable — /api/contabilidad
const router = Router();
router.use(verificarToken, requierePermiso("contabilidad"));
const v = (...reglas) => [...reglas.flat(), validarCampos];

router.get("/metodos-pago", C.metodosPago);

router.get("/cuentas", C.listarCuentas);
router.post("/cuentas", v(crearCuentaValidation), requierePermiso("gestionarCuentas"), C.crearCuenta);
router.put("/cuentas/:id", v(actualizarCuentaValidation), requierePermiso("gestionarCuentas"), C.actualizarCuenta);
router.patch("/cuentas/:id/estado", v(estadoCuentaValidation), requierePermiso("gestionarCuentas"), C.estadoCuenta);

router.get("/movimientos", v(rangoValidation), C.movimientos);
router.post("/ingresos", v(movimientoValidation), requierePermiso("registrarContable"), C.registrarIngreso);
router.post("/egresos", v(movimientoValidation), requierePermiso("registrarContable"), C.registrarEgreso);
router.patch("/ingresos/:id/anular", v(anularMovimientoValidation), requierePermiso("registrarContable"), C.anularIngreso);
router.patch("/egresos/:id/anular", v(anularMovimientoValidation), requierePermiso("registrarContable"), C.anularEgreso);
router.get("/ingresos/:id/comprobante-pdf", v(idValidation), C.comprobante("ingreso"));
router.get("/egresos/:id/comprobante-pdf", v(idValidation), C.comprobante("egreso"));

router.get("/balance-general", v(fechaCorteValidation), C.balance);
router.get("/balance-general/pdf", v(fechaCorteValidation), C.balancePDF);
router.get("/estado-resultados", v(rangoValidation), C.resultados);
router.get("/estado-resultados/pdf", v(rangoValidation), C.resultadosPDF);
router.get("/flujo-caja", v(rangoValidation), C.flujo);
router.get("/flujo-caja/pdf", v(rangoValidation), C.flujoPDF);

export default router;
