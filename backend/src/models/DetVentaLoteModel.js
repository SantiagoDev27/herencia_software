import { DataTypes } from "sequelize";
import sequelize from "../configuration/database.js";

const DetVentaLote = sequelize.define('DetVentaLote', {
    id_det_venta_lote: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_det_venta_lote'
    },
    fk_det_venta_lote_id_detalleventa: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'fk_det_venta_lote_id_detalleventa'
    },
    fk_det_venta_lote_id_lote: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'fk_det_venta_lote_id_lote'
    },
    cantidad_tomada: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'cantidad_tomada'
    },
    // Unidades de este lote que volvieron al inventario por devoluciones (v1.2)
    cantidad_devuelta: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'cantidad_devuelta'
    }
}, {
    tableName: 'det_venta_lote',
    timestamps: false
});

export default DetVentaLote;