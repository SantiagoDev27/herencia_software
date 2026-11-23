import { query } from "express-validator";

export const generarReporteVentasValidation = [
    query("fechaInicio")
        .optional()
        .isISO8601().withMessage("La fecha inicial debe tener formato YYYY-MM-DD."),
    query("fechaFin")
        .optional()
        .isISO8601().withMessage("La fecha final debe tener formato YYYY-MM-DD."),
];
