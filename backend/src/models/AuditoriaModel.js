import { DataTypes } from "sequelize";
import sequelize from "../configuration/database.js";

// HU-SEG-010: registro de accesos y acciones relevantes
const Auditoria = sequelize.define("Auditoria", {
    id_auditoria: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    fk_auditoria_id_usuario: { type: DataTypes.INTEGER, allowNull: true },
    correo: { type: DataTypes.STRING(150), allowNull: true },
    accion: { type: DataTypes.STRING(60), allowNull: false },
    detalle: { type: DataTypes.STRING(255), allowNull: true },
    ip: { type: DataTypes.STRING(60), allowNull: true },
}, {
    tableName: "auditoria",
    timestamps: false,
});

export default Auditoria;
