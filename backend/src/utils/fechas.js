// Fecha local YYYY-MM-DD (toISOString usa UTC y en Colombia adelanta el día después de las 7 p. m.)
export const fechaLocalISO = (fecha = new Date()) => {
    const d = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
    return d.toISOString().split("T")[0];
};

// Fecha de un movimiento contable: el día indicado al mediodía (los movimientos son diarios)
export const fechaContable = (iso) => `${String(iso ?? fechaLocalISO()).slice(0, 10)} 12:00:00`;

export const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;
