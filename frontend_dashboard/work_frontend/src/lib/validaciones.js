// Misma regla que el backend (requisito 2.4.9: claves robustas)
export const validarClave = (clave) => {
  if (!clave || clave.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Za-z]/.test(clave)) return "La contraseña debe contener al menos una letra.";
  if (!/\d/.test(clave)) return "La contraseña debe contener al menos un número.";
  return null;
};
