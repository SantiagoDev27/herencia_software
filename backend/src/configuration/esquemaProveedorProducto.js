// ============================================================
// Ajuste de la tabla puente PROVEEDOR <-> PRODUCTO
//
// En esta base de datos varios nombres llevan el error "proovedor"
// (la tabla de proveedores es "proovedores"), así que el nombre real de la
// tabla puente y de sus columnas puede no coincidir con el modelo.
// Al arrancar el servidor se busca la tabla real y se adapta el modelo:
//   - si existe (proveedor_producto, proovedor_producto, producto_proveedor...),
//     se usan su nombre y sus columnas reales;
//   - si no existe, se crea con la estructura del modelo.
// ============================================================

const REGEX_TABLA = /^(pro+ve+dor(es)?_?productos?|productos?_?pro+ve+dor(es)?)$/i;

export async function prepararTablaProveedorProducto(sequelize, Modelo) {
    const qi = sequelize.getQueryInterface();
    const tablas = (await qi.showAllTables()).map((t) => (typeof t === "string" ? t : t.tableName));
    const tabla = tablas.find((t) => REGEX_TABLA.test(t));

    if (!tabla) {
        await Modelo.sync();
        console.log(`🆕 Tabla "${Modelo.getTableName()}" creada para relacionar proveedores y productos.`);
        return { tabla: Modelo.getTableName(), creada: true };
    }

    const columnas = await qi.describeTable(tabla);
    const nombres = Object.keys(columnas);

    const pk = nombres.find((c) => columnas[c].primaryKey);
    const libres = nombres.filter((c) => c !== pk);
    const colProveedor =
        libres.find((c) => /pro+ve+dor(es)?$/i.test(c)) ?? libres.find((c) => /id_?pro+ve+dor/i.test(c));
    const colProducto =
        libres.find((c) => c !== colProveedor && /productos?$/i.test(c)) ??
        libres.find((c) => c !== colProveedor && /id_?producto/i.test(c));
    let colPrecio = libres.find((c) => /precio/i.test(c));

    if (!pk || !colProveedor || !colProducto) {
        console.error(
            `⚠️ La tabla "${tabla}" no tiene las columnas esperadas (id, proveedor, producto). Columnas encontradas: ${nombres.join(", ")}`
        );
        return { tabla, error: true, columnas: nombres };
    }

    // Si la tabla no tiene precio de compra, se agrega la columna
    if (!colPrecio) {
        const { DataTypes } = await import("sequelize");
        await qi.addColumn(tabla, "precio_compra", { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 });
        colPrecio = "precio_compra";
        console.log(`➕ Columna "precio_compra" agregada a "${tabla}".`);
    }

    const mapa = {
        id_proveedor_producto: pk,
        fk_producto_proveedor_id_proveedor: colProveedor,
        fk_producto_proveedor_id_producto: colProducto,
        precio_compra: colPrecio,
    };
    for (const [atributo, campo] of Object.entries(mapa)) {
        Modelo.rawAttributes[atributo].field = campo;
    }
    Modelo.tableName = tabla;
    Modelo.options.tableName = tabla;
    Modelo.refreshAttributes();

    // Las asociaciones guardan el nombre de columna al definirse: se actualizan también
    // (Producto/Proveedor.hasMany(ProductoProveedor) y ProductoProveedor.belongsTo(...))
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

    console.log(
        `🔗 Proveedor-producto usando la tabla "${tabla}" (${colProveedor}, ${colProducto}, ${colPrecio}).`
    );
    return { tabla, mapa };
}
