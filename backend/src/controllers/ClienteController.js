import ClienteService from "../services/ClienteService.js";

const manejar = (fn, mensaje, status = 200) => async (req, res, next) => {
    try {
        const data = await fn(req);
        return res.status(status).json({ success: true, message: mensaje, data });
    } catch (error) {
        next(error);
    }
};

export default {
    listar: manejar((req) => ClienteService.listar({ busqueda: req.query.busqueda })),
    obtener: manejar((req) => ClienteService.obtener(req.params.id)),
    crear: manejar((req) => ClienteService.crear(req.body), "Cliente registrado.", 201),
    actualizar: manejar((req) => ClienteService.actualizar(req.params.id, req.body), "Cliente actualizado."),
    eliminar: manejar((req) => ClienteService.eliminar(req.params.id), "Cliente eliminado."),
};
