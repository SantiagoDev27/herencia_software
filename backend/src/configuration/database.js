import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

// Las fechas y horas se guardan en la hora local del servidor (Colombia, UTC-05:00) y no en UTC:
// así un movimiento hecho a las 8 p. m. queda con la fecha de ese día en reportes y cierres.
// Se puede cambiar con DB_TIMEZONE (ej. "-05:00").
const offsetLocal = () => {
    const min = -new Date().getTimezoneOffset();
    const signo = min >= 0 ? "+" : "-";
    const abs = Math.abs(min);
    return `${signo}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
};

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: "mysql",
        timezone: process.env.DB_TIMEZONE || offsetLocal(),
        logging: false
    }
);

export default sequelize;