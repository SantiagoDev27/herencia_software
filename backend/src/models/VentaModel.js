import { DataTypes } from "sequelize";
import sequelize from "../configuration/database.js";

const Venta = sequelize.define('Venta', {
    id_venta: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
        unique: true
    },
    numero_venta: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    total: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    fk_venta_id_cliente: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    },
    fk_venta_id_usuario: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    },
    subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    iva: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    descuento: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
    },
    // v1.2: estado (Registrada, Devolución parcial, Devuelta, Anulada), método de pago y anulación
    estado_venta: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'Registrada'
    },
    fk_venta_id_metodopago: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    motivo_anulacion: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    fecha_anulacion: {
        type: DataTypes.DATE,
        allowNull: true
    },
    actualizada_en: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'venta',
    timestamps: false
});

export default Venta;