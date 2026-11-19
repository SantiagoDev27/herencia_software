import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import sequelize from "./configuration/database.js";
import ProductoProveedor from "./models/Producto-ProovedorModel.js";
import { prepararTablaProveedorProducto } from "./configuration/esquemaProveedorProducto.js";
import { ajustarModelosAlEsquema } from "./configuration/esquemaModelos.js";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log("✅ Base de datos conectada correctamente");

        // Ajusta el modelo a la tabla real proveedor-producto (o la crea si no existe)
        try {
            await prepararTablaProveedorProducto(sequelize, ProductoProveedor);
        } catch (error) {
            console.error("⚠️ No se pudo preparar la tabla proveedor-producto:", error.message);
        }

        // Corrige columnas mal nombradas en los modelos (ej. clientes.dirreccion_clientes)
        try {
            await ajustarModelosAlEsquema(sequelize);
        } catch (error) {
            console.error("⚠️ No se pudieron revisar los modelos contra la base de datos:", error.message);
        }

        app.listen(PORT, () => {
            console.log(`🚀 Servidor ejecutándose en el puerto ${PORT}`);
        });

    } catch (error) {
        console.error("❌ Error conectando la base de datos:", error);
        process.exit(1);
    }
};

startServer();