import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import sequelize from "./configuration/database.js";
import ProductoProveedor from "./models/Producto-ProovedorModel.js";
import { prepararTablaProveedorProducto } from "./configuration/esquemaProveedorProducto.js";
import { ajustarModelosAlEsquema } from "./configuration/esquemaModelos.js";
import { prepararEsquemaSeguridad } from "./configuration/esquemaSeguridad.js";
import { prepararEsquemaNegocio } from "./configuration/esquemaNegocio.js";
import ProductoRepository from "./repositories/ProductoRepositories.js";
import { cargarDatosDemo } from "./configuration/datosDemo.js";

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

        // Columnas de seguridad de usuario, roles oficiales y tabla de auditoría (antes de ajustar modelos)
        try {
            await prepararEsquemaSeguridad(sequelize);
        } catch (error) {
            console.error("⚠️ No se pudo preparar el esquema de seguridad:", error.message);
        }

        // Tablas y columnas de clientes, devoluciones, compras, contabilidad y permisos (v1.2)
        try {
            await prepararEsquemaNegocio(sequelize);
        } catch (error) {
            console.error("⚠️ No se pudo preparar el esquema de negocio:", error.message);
        }

        // Corrige columnas mal nombradas en los modelos (ej. clientes.dirreccion_clientes)
        try {
            await ajustarModelosAlEsquema(sequelize);
        } catch (error) {
            console.error("⚠️ No se pudieron revisar los modelos contra la base de datos:", error.message);
        }

        // Productos agotados sin fecha de vencimiento; los demás con la del lote más próximo a vencer
        try {
            const total = await ProductoRepository.sincronizarVencimientos();
            if (total) console.log(`🗓️ Fechas de vencimiento sincronizadas en ${total} producto(s)`);
        } catch (error) {
            console.error("⚠️ No se pudieron sincronizar las fechas de vencimiento:", error.message);
        }

        // Catálogo real y 15 días de operación de demostración (solo el primer arranque;
        // para no cargarlos, DATOS_DEMO=false en el .env)
        if (process.env.DATOS_DEMO !== "false") {
            try {
                await cargarDatosDemo();
            } catch (error) {
                console.error("⚠️ No se pudieron cargar los datos de demostración:", error.message);
            }
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