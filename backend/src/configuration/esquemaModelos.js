// ============================================================
// Ajuste de los modelos al esquema REAL de la base de datos
//
// Varios nombres de columna de la BD tienen errores de digitación o variaciones
// (ej. "dirreccion_clientes" vs "direccion_clientes", "proovedor" vs "proveedor",
// singular vs plural). Si un modelo apunta a una columna que no existe, MySQL
// responde "Unknown column ..." y la consulta completa falla.
//
// Al arrancar el servidor, por cada modelo:
//   1. se leen las columnas reales de su tabla;
//   2. si un atributo apunta a una columna que no existe, se busca la columna
//      equivalente ignorando mayúsculas, guiones bajos, letras dobles y plurales;
//   3. si no hay equivalente, el atributo se quita del modelo (deja de consultarse)
//      para que el resto de la información sí se pueda leer.
// ============================================================

// "dirreccion_clientes" -> "direcionclient" ; "direccion_cliente" -> "direcionclient"
const normalizar = (nombre) =>
    String(nombre)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split("_")
        .filter(Boolean)
        .map((parte) => parte.replace(/(.)\1+/g, "$1").replace(/s$/, "").replace(/e$/, ""))
        .join("");

// Actualiza los nombres de columna que las asociaciones guardaron al definirse
const refrescarAsociaciones = (sequelize, Modelo) => {
    for (const modelo of Object.values(sequelize.models)) {
        for (const asociacion of Object.values(modelo.associations ?? {})) {
            const duenoFk = asociacion.associationType === "BelongsTo" ? asociacion.source : asociacion.target;
            if (duenoFk !== Modelo) continue;
            const campo = Modelo.rawAttributes[asociacion.foreignKey]?.field;
            if (!campo) continue;
            asociacion.identifierField = campo;
            if ("foreignKeyField" in asociacion) asociacion.foreignKeyField = campo;
        }
    }
};

export async function ajustarModelosAlEsquema(sequelize, { omitir = [] } = {}) {
    const qi = sequelize.getQueryInterface();
    const tablas = new Set((await qi.showAllTables()).map((t) => (typeof t === "string" ? t : t.tableName)));
    const cambios = [];

    for (const Modelo of Object.values(sequelize.models)) {
        if (omitir.includes(Modelo)) continue;
        const tabla = Modelo.getTableName();
        const nombreTabla = typeof tabla === "string" ? tabla : tabla.tableName;
        if (!tablas.has(nombreTabla)) continue; // tabla inexistente: no se toca

        const columnas = Object.keys(await qi.describeTable(nombreTabla));
        // Llaves foráneas de las relaciones: nunca se quitan (romperían los "include")
        const llavesForaneas = new Set(
            Object.values(sequelize.models).flatMap((m) =>
                Object.values(m.associations ?? {})
                    .filter((a) => (a.associationType === "BelongsTo" ? a.source : a.target) === Modelo)
                    .map((a) => a.foreignKey)
            )
        );
        const existentes = new Set(columnas);
        const timestamps = new Set(Object.values(Modelo._timestampAttributes ?? {}));
        let modificado = false;

        for (const [atributo, def] of Object.entries(Modelo.rawAttributes)) {
            const campo = def.field ?? atributo;
            if (existentes.has(campo)) continue;

            const equivalente = columnas.find((c) => normalizar(c) === normalizar(campo));
            if (equivalente) {
                def.field = equivalente;
                cambios.push(`${nombreTabla}.${campo} → ${equivalente}`);
            } else if (def.primaryKey || llavesForaneas.has(atributo) || timestamps.has(atributo)) {
                console.error(`⚠️ La columna clave "${campo}" no existe en "${nombreTabla}". Columnas: ${columnas.join(", ")}`);
                continue;
            } else {
                Modelo.removeAttribute(atributo);
                cambios.push(`${nombreTabla}.${campo} (no existe en la BD, se omite)`);
            }
            modificado = true;
        }

        if (modificado) {
            Modelo.refreshAttributes();
            refrescarAsociaciones(sequelize, Modelo);
        }
    }

    if (cambios.length) {
        console.log(`🧩 Modelos ajustados a la base de datos:\n   - ${cambios.join("\n   - ")}`);
    }
    return cambios;
}
