import { body, param } from "express-validator";

// ============================================================
// Reglas de validación de PROVEEDOR
// Se usan las mismas reglas al crear y al actualizar; en la
// actualización cada campo es opcional, pero si llega se valida.
// ============================================================

// Dígito de verificación (DV) del NIT según el algoritmo de la DIAN
export const calcularDigitoVerificacion = (numero) => {
    const pesos = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    const digitos = String(numero).split("").reverse();
    const suma = digitos.reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const residuo = suma % 11;
    return residuo > 1 ? 11 - residuo : residuo;
};

// Solo letras (con tildes y ñ), números, espacios y signos habituales en nombres de empresa
const REGEX_RAZON_SOCIAL = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,&'()\-]+$/;
const REGEX_DIRECCION = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s#\-.,°º/]+$/;
const REGEX_CIUDAD = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s.\-]+$/;

const reglaNit = (campo) =>
    campo
        .customSanitizer((v) => (v === undefined || v === null ? v : String(v).replace(/[.\s]/g, "")))
        .notEmpty().withMessage("El NIT es obligatorio.").bail()
        .matches(/^\d{6,10}(-\d)?$/).withMessage("El NIT debe tener entre 6 y 10 dígitos y, si lleva dígito de verificación, separarlo con guion (ej. 900123456-8).").bail()
        .custom((nit) => {
            const [numero, dv] = nit.split("-");
            if (dv !== undefined && Number(dv) !== calcularDigitoVerificacion(numero)) {
                throw new Error(`El dígito de verificación no corresponde al NIT ${numero} (debería ser ${calcularDigitoVerificacion(numero)}).`);
            }
            return true;
        });

const reglaRazonSocial = (campo) =>
    campo
        .trim()
        .notEmpty().withMessage("La razón social es obligatoria.").bail()
        .isLength({ min: 3, max: 100 }).withMessage("La razón social debe tener entre 3 y 100 caracteres.").bail()
        .matches(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/).withMessage("La razón social debe contener letras.").bail()
        .matches(REGEX_RAZON_SOCIAL).withMessage("La razón social tiene caracteres no permitidos.");

const reglaTelefono = (campo) =>
    campo
        .trim()
        .notEmpty().withMessage("El teléfono del proveedor es obligatorio.").bail()
        .isLength({ max: 45 }).withMessage("El teléfono no puede exceder los 45 caracteres.").bail()
        .matches(/^\+?[0-9\s\-()]+$/).withMessage("El teléfono solo puede contener números, espacios, +, - y paréntesis.").bail()
        .custom((tel) => {
            // Se quita el indicativo de Colombia (+57) para revisar el número nacional
            const digitos = tel.replace(/\D/g, "").replace(/^57(?=\d{10}$)/, "");
            const esCelular = /^3\d{9}$/.test(digitos);
            const esFijo = /^60\d{8}$/.test(digitos) || /^\d{7}$/.test(digitos);
            if (!esCelular && !esFijo) {
                throw new Error("El teléfono debe ser un celular de 10 dígitos que empiece por 3, o un fijo de 7 dígitos o de 10 que empiece por 60.");
            }
            return true;
        });

const reglaDireccion = (campo) =>
    campo
        .trim()
        .notEmpty().withMessage("La dirección es obligatoria.").bail()
        .isLength({ min: 5, max: 45 }).withMessage("La dirección debe tener entre 5 y 45 caracteres.").bail()
        .matches(REGEX_DIRECCION).withMessage("La dirección tiene caracteres no permitidos.");

const reglaCiudad = () =>
    body("ciudad")
        .optional({ values: "falsy" })
        .trim()
        .isLength({ min: 3, max: 45 }).withMessage("La ciudad debe tener entre 3 y 45 caracteres.").bail()
        .matches(REGEX_CIUDAD).withMessage("La ciudad solo puede contener letras y espacios.");

const reglaId = () =>
    param("id_proveedor")
        .notEmpty().withMessage("El id del proveedor es obligatorio.")
        .isInt({ min: 1 }).withMessage("El id del proveedor debe ser un entero positivo.");

export const crearProveedorValidation = [
    reglaNit(body("nit")),
    reglaRazonSocial(body("razon_social")),
    reglaTelefono(body("telefono_proveedor")),
    reglaDireccion(body("direccion")),
    reglaCiudad(),
];

export const actualizarProveedorValidation = [
    reglaId(),
    reglaNit(body("nit").optional()),
    reglaRazonSocial(body("razon_social").optional()),
    reglaTelefono(body("telefono_proveedor").optional()),
    reglaDireccion(body("direccion").optional()),
    reglaCiudad(),
];

export const obtenerProveedorValidation = [reglaId()];

export const eliminarProveedorValidation = [reglaId()];
