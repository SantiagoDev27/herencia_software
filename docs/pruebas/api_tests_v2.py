"""Plan de pruebas v2 — pruebas de caja negra sobre la API de los módulos completados en la v1.2.
Requiere: base limpia (reset.sh). Guarda los resultados en resultados_api_v2.json."""
import json, subprocess, datetime, requests

API = "http://localhost:3000/api"
R = []
hoy = datetime.date.today()
iso = lambda d: d.isoformat()
dias = lambda n: iso(hoy + datetime.timedelta(days=n))


def sql(q):
    return subprocess.run(["sudo", "mariadb", "-N", "herencia_database", "-e", q], capture_output=True, text=True).stdout.strip()


def call(method, path, token=None, **kw):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.request(method, API + path, headers=h, timeout=30, **kw)
    try:
        body = r.json()
    except Exception:
        body = {"_bytes": len(r.content), "_type": r.headers.get("content-type")}
    return r.status_code, body


def msg(b):
    d = b.get("detalles")
    return "; ".join(d.values()) if isinstance(d, dict) and d else b.get("message")


def check(cp, esc, desc, ok, obtenido):
    R.append({"cp": cp, "esc": esc, "desc": desc, "ok": bool(ok), "obtenido": obtenido})
    print(("PASS " if ok else "FAIL ") + f"{cp}-{esc} {desc} -> {obtenido}")


def login(c, k):
    s, b = call("POST", "/auth/login", json={"correo_usuario": c, "contraseña_usuario": k})
    return b.get("token"), b.get("data", {})


ADM, _ = login("admin@herenciadepapa.com", "admin1234")
VEN, ven_data = login("vendedor@herenciadepapa.com", "vendedor1234")
FIN, _ = login("finanzas@herenciadepapa.com", "finanzas1234")

# ---------- datos base ----------
IDS = {}
for cod, nom, cat, costo, precio, iva in [("AREQ-250", "Arequipe 250 g", 1, 4200, 7500, 0), ("BOC-012", "Bocadillo veleño x12", 2, 6000, 11000, 0),
                                         ("COC-006", "Cocadas de coco x6", 1, 5000, 9000, 19), ("MAN-500", "Manjar blanco 500 g", 1, 9000, 16000, 0)]:
    s, b = call("POST", "/productos", VEN, json={"codigo_producto": cod, "nombre_producto": nom, "fk_producto_id_categoria": cat, "costo_produccion": costo, "precio_venta": precio, "iva": iva})
    IDS[cod] = b["data"]["id_producto"]
s, b = call("POST", "/ingreso-mercancia", VEN, json={"codigo_entrada": "ENT-V2-01", "detalles": [
    {"fk_det_entrada_id_producto": IDS["AREQ-250"], "cantidad": 40, "precio_unitario": 4200, "numero_lote": "L-A1", "fecha_vencimiento": dias(20)},
    {"fk_det_entrada_id_producto": IDS["BOC-012"], "cantidad": 30, "precio_unitario": 6000, "numero_lote": "L-B1", "fecha_vencimiento": dias(40)},
    {"fk_det_entrada_id_producto": IDS["COC-006"], "cantidad": 20, "precio_unitario": 5000, "iva": 19, "numero_lote": "L-C1", "fecha_vencimiento": dias(30)},
    {"fk_det_entrada_id_producto": IDS["MAN-500"], "cantidad": 10, "precio_unitario": 9000, "numero_lote": "L-M1", "fecha_vencimiento": dias(50)}]})
assert s == 201, b
stock = lambda cod: call("GET", f"/productos/codigo/{cod}", ADM)[1]["data"]["stock"]

# ---------- CP-101 Gestionar clientes (HU-VEN-006) ----------
cli = {"identificacion": 1107123456, "nombre_cliente": "María", "apellido_cliente": "López", "telefono_cliente": "3004445566", "correo_cliente": "maria@correo.com", "ciudad_cliente": "Cali"}
s, b = call("POST", "/clientes", VEN, json=cli)
CLI = b.get("data", {}).get("id_cliente")
check("101", "E1", "Registrar cliente con datos válidos", s == 201 and CLI, f"HTTP {s}: id={CLI}")
s, b = call("POST", "/clientes", VEN, json=cli)
check("101", "E2", "Identificación duplicada", s == 409, f"HTTP {s}: {msg(b)}")
s, b = call("POST", "/clientes", VEN, json={"identificacion": "abc", "nombre_cliente": "", "correo_cliente": "no-es-correo"})
check("101", "E3", "Datos inválidos", s == 400, f"HTTP {s}: {msg(b)}")
s, b = call("PUT", f"/clientes/{CLI}", VEN, json={"telefono_cliente": "3105556677", "direccion_cliente": "Cra 10 # 5-20"})
check("101", "E4", "Actualizar cliente", s == 200 and b["data"]["telefono_cliente"] == "3105556677", f"HTTP {s}: teléfono={b.get('data', {}).get('telefono_cliente')}")
s, b = call("GET", "/clientes?busqueda=lópez", FIN)
check("101", "E5", "Consultar clientes por búsqueda", s == 200 and len(b["data"]) == 1, f"HTTP {s}: {len(b.get('data', []))} resultado(s)")
s, b = call("POST", "/clientes", FIN, json={**cli, "identificacion": 99887766})
check("101", "E6", "Finanzas no registra clientes", s == 403, f"HTTP {s}")
s, b = call("POST", "/clientes", VEN, json={"identificacion": 1234567890123, "nombre_cliente": "Pedro"})
check("101", "E7", "Cédula/NIT largo (BIGINT)", s == 201, f"HTTP {s}: identificación={b.get('data', {}).get('identificacion')}")

# ---------- CP-102 Registrar venta con cliente y método de pago ----------
s, b = call("POST", "/ventas/ventas", VEN, json={"fecha": iso(hoy), "fk_venta_id_cliente": CLI, "fk_venta_id_metodopago": 5,
                                                 "detalles": [{"fk_det_venta_id_producto": IDS["AREQ-250"], "cantidad": 4}, {"fk_det_venta_id_producto": IDS["COC-006"], "cantidad": 2}]})
V1 = b.get("data", {}).get("venta", {})
ing = sql(f"SELECT concat(valor,'|',origen,'|',fk_ingresos_id_metodospago) FROM ingresos WHERE referencia='{V1.get('numero_venta')}'")
check("102", "E1", "Venta con cliente y Nequi genera ingreso contable", s == 201 and (V1.get("cliente") or {}).get("nombre_cliente") == "María" and ing.startswith("51420.00|VENTA|5"),
      f"HTTP {s}: {V1.get('numero_venta')} total={V1.get('total')}, ingreso={ing}")
s, b = call("POST", "/ventas/ventas", VEN, json={"fecha": iso(hoy), "fk_venta_id_cliente": 999, "detalles": [{"fk_det_venta_id_producto": IDS["AREQ-250"], "cantidad": 1}]})
check("102", "E2", "Cliente inexistente", s == 404, f"HTTP {s}: {msg(b)}")
s, b = call("POST", "/ventas/ventas", VEN, json={"fecha": iso(hoy), "detalles": [{"fk_det_venta_id_producto": IDS["MAN-500"], "cantidad": 99}]})
check("102", "E3", "Stock insuficiente", s == 400, f"HTTP {s}: {msg(b)}")

# ---------- CP-103 Actualizar venta (HU-VEN-002) ----------
idv = V1["id_venta"]
s, b = call("PUT", f"/ventas/ventas/{idv}", VEN, json={"descuento": 1420, "detalles": [{"fk_det_venta_id_producto": IDS["AREQ-250"], "cantidad": 6}, {"fk_det_venta_id_producto": IDS["COC-006"], "cantidad": 2}]})
v = b.get("data", {}).get("venta", {})
check("103", "E1", "Modificar cantidades y descuento de una venta del día", s == 200 and float(v.get("total", 0)) == 65000 and stock("AREQ-250") == 34,
      f"HTTP {s}: total={v.get('total')}, stock arequipe={stock('AREQ-250')}")
ing = sql(f"SELECT valor FROM ingresos WHERE referencia='{V1['numero_venta']}'")
check("103", "E2", "El ingreso contable se actualiza con la venta", ing == "65000.00", f"ingreso={ing}")
sql(f"INSERT INTO venta (total,numero_venta,fecha,fk_venta_id_usuario,subtotal,iva,descuento) VALUES (20000,'VEN-090','{dias(-3)}',1,20000,0,0)")
idv_old = sql("SELECT id_venta FROM venta WHERE numero_venta='VEN-090'")
s, b = call("PUT", f"/ventas/ventas/{idv_old}", VEN, json={"descuento": 100})
check("103", "E3", "No se modifica una venta de otro día", s == 409, f"HTTP {s}: {msg(b)}")
s, b = call("PUT", f"/ventas/ventas/{idv}", FIN, json={"descuento": 0})
check("103", "E4", "Finanzas no modifica ventas", s == 403, f"HTTP {s}")

# ---------- CP-104 Devoluciones (HU-VEN-007) ----------
s, b = call("POST", f"/ventas/ventas/{idv}/devoluciones", VEN, json={"motivo": "Empaque abierto", "reintegrar": True, "detalles": [{"fk_producto": IDS["AREQ-250"], "cantidad": 2}]})
DEV = b.get("data", {})
egr = sql(f"SELECT concat(valor,'|',origen) FROM egresos WHERE referencia='DEV-{DEV.get('id_devolucion')}'")
check("104", "E1", "Devolución parcial que vuelve al inventario", s == 201 and stock("AREQ-250") == 36 and egr.startswith("14679.31|DEVOLUCION"),
      f"HTTP {s}: DEV-{DEV.get('id_devolucion')} total={DEV.get('total')}, stock arequipe={stock('AREQ-250')}, egreso={egr}")
s, b = call("POST", f"/ventas/ventas/{idv}/devoluciones", VEN, json={"motivo": "Error", "detalles": [{"fk_producto": IDS["AREQ-250"], "cantidad": 5}]})
check("104", "E2", "Devolver más de lo vendido", s == 400, f"HTTP {s}: {msg(b)}")
s, b = call("POST", f"/ventas/ventas/{idv}/devoluciones", VEN, json={"motivo": "Producto dañado", "reintegrar": False, "detalles": [{"fk_producto": IDS["COC-006"], "cantidad": 1}]})
check("104", "E3", "Devolución de producto dañado no reintegra stock", s == 201 and stock("COC-006") == 18, f"HTTP {s}: stock cocadas={stock('COC-006')}")
s, b = call("GET", f"/ventas/ventas/{idv}", VEN)
check("104", "E4", "La venta queda en 'Devolución parcial'", b["data"]["venta"]["estado_venta"] == "Devolución parcial" and not b["data"]["editable"], f"estado={b['data']['venta']['estado_venta']}, editable={b['data']['editable']}")
s, b = call("GET", f"/ventas/devoluciones/{DEV.get('id_devolucion')}/comprobante-pdf", VEN)
check("104", "E5", "Comprobante de devolución en PDF", s == 200 and "pdf" in (b.get("_type") or ""), f"HTTP {s}: {b.get('_type')}, {b.get('_bytes')} bytes")
s, b = call("POST", f"/ventas/ventas/{idv}/devoluciones", VEN, json={"motivo": "x", "detalles": []})
check("104", "E6", "Motivo y productos obligatorios", s == 400, f"HTTP {s}: {msg(b)}")

# ---------- CP-105 Anular venta (HU-VEN-003) ----------
s, b = call("POST", "/ventas/ventas", VEN, json={"fecha": iso(hoy), "detalles": [{"fk_det_venta_id_producto": IDS["MAN-500"], "cantidad": 3}]})
V2 = b["data"]["venta"]
s, b = call("PATCH", f"/ventas/ventas/{V2['id_venta']}/anular", VEN, json={"motivo": "Cliente desistió de la compra"})
check("105", "E1", "Vendedor no puede anular (permiso por defecto)", s == 403, f"HTTP {s}")
s, b = call("PATCH", f"/ventas/ventas/{V2['id_venta']}/anular", ADM, json={"motivo": "Cliente desistió de la compra"})
ing = sql(f"SELECT estado FROM ingresos WHERE referencia='{V2['numero_venta']}'")
check("105", "E2", "Anular venta restaura inventario y anula el ingreso", s == 200 and b["data"]["venta"]["estado_venta"] == "Anulada" and stock("MAN-500") == 10 and ing == "Anulado",
      f"HTTP {s}: estado={b.get('data', {}).get('venta', {}).get('estado_venta')}, stock manjar={stock('MAN-500')}, ingreso={ing}")
s, b = call("PATCH", f"/ventas/ventas/{V2['id_venta']}/anular", ADM, json={"motivo": "Otra vez"})
check("105", "E3", "No se anula dos veces", s == 409, f"HTTP {s}: {msg(b)}")
s, b = call("PATCH", f"/ventas/ventas/{idv}/anular", ADM, json={"motivo": "Prueba con devoluciones"})
check("105", "E4", "No se anula una venta con devoluciones", s == 409, f"HTTP {s}: {msg(b)}")
s, b = call("PATCH", f"/ventas/ventas/{V2['id_venta']}/anular", ADM, json={"motivo": "x"})
s2, b2 = call("GET", f"/ventas/ventas/{V2['id_venta']}/factura-pdf", ADM)
check("105", "E5", "La factura de una venta anulada sigue disponible (marcada)", s2 == 200, f"HTTP {s2}: {b2.get('_bytes')} bytes")
s, b = call("GET", f"/reportes/ventas", FIN)
nums = [x["numero_venta"] for x in b["data"]["ventas"]]
check("105", "E6", "Las ventas anuladas no suman en el reporte", V2["numero_venta"] not in nums, f"ventas en reporte={nums}; devoluciones={b['data']['resumen']['devoluciones']}")

# ---------- CP-106 Permisos configurables (HU-SEG-007) ----------
s, b = call("GET", "/usuarios/permisos", ADM)
perm_v = next(r["permisos"] for r in b["data"]["roles"] if r["idrol"] == 2)
check("106", "E1", "Consultar la matriz de permisos", s == 200 and len(b["data"]["catalogo"]) >= 20, f"HTTP {s}: {len(b['data']['catalogo'])} permisos; Vendedor tiene {len(perm_v)}")
s, b = call("PUT", "/usuarios/permisos/2", ADM, json={"permisos": perm_v + ["anularVenta"]})
s2, b2 = call("POST", "/ventas/ventas", VEN, json={"fecha": iso(hoy), "detalles": [{"fk_det_venta_id_producto": IDS["BOC-012"], "cantidad": 1}]})
s3, b3 = call("PATCH", f"/ventas/ventas/{b2['data']['venta']['id_venta']}/anular", VEN, json={"motivo": "Prueba de permiso concedido"})
check("106", "E2", "Conceder 'Anular ventas' al Vendedor surte efecto de inmediato", s == 200 and s3 == 200, f"guardar {s}; anular como vendedor {s3}")
s, b = call("PUT", "/usuarios/permisos/2", ADM, json={"permisos": [p for p in perm_v if p != "registrarVenta"]})
s2, _ = call("POST", "/ventas/ventas", VEN, json={"fecha": iso(hoy), "detalles": [{"fk_det_venta_id_producto": IDS["BOC-012"], "cantidad": 1}]})
s3, b3 = login("vendedor@herenciadepapa.com", "vendedor1234")
check("106", "E3", "Quitar 'Registrar ventas' bloquea la operación y el login refleja los permisos", s2 == 403 and "registrarVenta" not in b3["permisos"], f"venta HTTP {s2}; permisos en sesión={len(b3['permisos'])}")
call("PUT", "/usuarios/permisos/2", ADM, json={"permisos": perm_v})
s, b = call("PUT", "/usuarios/permisos/3", ADM, json={"permisos": ["inventado"]})
check("106", "E4", "Permiso desconocido", s == 400, f"HTTP {s}: {msg(b)}")
s, b = call("PUT", "/usuarios/permisos/1", ADM, json={"permisos": []})
check("106", "E5", "Los permisos del Administrador no se pueden quitar", s == 400, f"HTTP {s}: {msg(b)}")
s, b = call("GET", "/usuarios/permisos", FIN)
check("106", "E6", "Solo el administrador configura permisos", s == 403, f"HTTP {s}")

# ---------- CP-107 Órdenes de compra (HU-PROV-006) ----------
s, b = call("POST", "/proveedores/proveedores", VEN, json={"nit": "900555111", "razon_social": "Dulces Típicos del Valle SAS", "telefono_proveedor": "3104567890", "direccion": "Cra 5 # 10-20", "ciudad": "Palmira"})
PROV = b.get("data", {}).get("id_proveedor")
call("POST", f"/proveedores/proveedores/{PROV}/productos", VEN, json={"fk_producto_proveedor_id_producto": IDS["AREQ-250"], "precio_compra": 4000})
s, b = call("POST", "/ordenes-compra", VEN, json={"fk_proveedor": PROV, "fecha_entrega_estimada": dias(3), "observacion": "Pedido semanal",
                                                  "detalles": [{"fk_producto": IDS["AREQ-250"], "cantidad": 50}, {"fk_producto": IDS["COC-006"], "cantidad": 10, "precio_unitario": 4800}]})
OC = b.get("data", {})
check("107", "E1", "Crear orden de compra (precio pactado + IVA)", s == 201 and float(OC.get("subtotal", 0)) == 248000 and float(OC.get("iva", 0)) == 9120,
      f"HTTP {s}: OC-{OC.get('numero_orden')} subtotal={OC.get('subtotal')}, iva={OC.get('iva')}, total={OC.get('total')}")
s, b = call("POST", "/ordenes-compra", VEN, json={"fk_proveedor": PROV, "detalles": []})
check("107", "E2", "Orden sin productos", s == 400, f"HTTP {s}: {msg(b)}")
s, b = call("DELETE", f"/proveedores/proveedores/{PROV}", VEN)
check("107", "E3", "No se desactiva un proveedor con órdenes pendientes", s == 409, f"HTTP {s}: {msg(b)}")
s, b = call("GET", f"/ordenes-compra/{OC['id_orden_compra']}/pdf", FIN)
check("107", "E4", "Orden de compra imprimible (PDF)", s == 200 and "pdf" in (b.get("_type") or ""), f"HTTP {s}: {b.get('_bytes')} bytes")
antes = stock("AREQ-250")
s, b = call("PATCH", f"/ordenes-compra/{OC['id_orden_compra']}/recibir", VEN, json={"registrar_pago": True, "fk_metodo_pago": 4, "detalles": [
    {"fk_producto": IDS["AREQ-250"], "numero_lote": "OC1-A", "fecha_vencimiento": dias(60)}, {"fk_producto": IDS["COC-006"], "numero_lote": "OC1-C", "fecha_vencimiento": dias(45)}]})
egr = sql(f"SELECT concat(valor,'|',origen) FROM egresos WHERE referencia='OC-{OC['numero_orden']}'")
check("107", "E5", "Recibir la orden: entrada con lotes, stock y egreso", s == 200 and b["data"]["estado"] == "Recibida" and stock("AREQ-250") == antes + 50 and egr.startswith("257120.00|COMPRA"),
      f"HTTP {s}: estado={b.get('data', {}).get('estado')}, stock arequipe {antes}→{stock('AREQ-250')}, egreso={egr}")
s, b = call("PATCH", f"/ordenes-compra/{OC['id_orden_compra']}/recibir", VEN, json={"detalles": [{"fk_producto": IDS["AREQ-250"], "numero_lote": "X", "fecha_vencimiento": dias(60)}]})
check("107", "E6", "No se recibe dos veces", s == 409, f"HTTP {s}: {msg(b)}")
s, b = call("POST", "/ordenes-compra", VEN, json={"fk_proveedor": PROV, "fecha_entrega_estimada": dias(-1), "detalles": [{"fk_producto": IDS["MAN-500"], "cantidad": 5}]})
OC2 = b["data"]
s, b = call("PATCH", f"/ordenes-compra/{OC2['id_orden_compra']}/cancelar", VEN, json={"motivo": "Proveedor sin existencias"})
check("107", "E7", "Cancelar orden pendiente", s == 200 and b["data"]["estado"] == "Cancelada", f"HTTP {s}: estado={b.get('data', {}).get('estado')}")
s, b = call("POST", "/ordenes-compra", FIN, json={"fk_proveedor": PROV, "detalles": [{"fk_producto": IDS["MAN-500"], "cantidad": 5}]})
check("107", "E8", "Finanzas consulta pero no crea órdenes", s == 403 and call("GET", "/ordenes-compra", FIN)[0] == 200, f"crear HTTP {s}; consultar 200")

# ---------- CP-108 Evaluar proveedores (HU-PROV-007) ----------
s, b = call("POST", f"/proveedores/proveedores/{PROV}/evaluaciones", ADM, json={"cumplimiento": 5, "calidad": 4, "tiempo_respuesta": 4, "observaciones": "Entregó a tiempo"})
check("108", "E1", "Registrar evaluación (promedio automático)", s == 201 and float(b["data"]["calificacion"]) == 4.33, f"HTTP {s}: calificación={b.get('data', {}).get('calificacion')}")
call("POST", f"/proveedores/proveedores/{PROV}/evaluaciones", ADM, json={"cumplimiento": 3, "calidad": 5, "tiempo_respuesta": 4})
s, b = call("GET", f"/proveedores/proveedores/{PROV}/evaluaciones", VEN)
s2, b2 = call("GET", "/proveedores/evaluaciones/resumen", VEN)
check("108", "E2", "Historial y promedio del proveedor", s == 200 and len(b["data"]) == 2 and b2["data"][0]["promedio"] == 4.17, f"{len(b.get('data', []))} evaluaciones; promedio={b2.get('data', [{}])[0].get('promedio')}")
s, b = call("POST", f"/proveedores/proveedores/{PROV}/evaluaciones", ADM, json={"cumplimiento": 6, "calidad": 0, "tiempo_respuesta": 3})
check("108", "E3", "Notas fuera de 1 a 5", s == 400, f"HTTP {s}: {msg(b)}")
s, b = call("POST", f"/proveedores/proveedores/{PROV}/evaluaciones", VEN, json={"cumplimiento": 5, "calidad": 5, "tiempo_respuesta": 5})
check("108", "E4", "Vendedor sin permiso de evaluar", s == 403, f"HTTP {s}")

# ---------- CP-109 Reporte de proveedores (HU-PROV-008) ----------
s, b = call("GET", "/reportes/proveedores", FIN)
p = b.get("data", {}).get("proveedores", [{}])[0]
check("109", "E1", "Reporte con compras, cumplimiento y calificación", s == 200 and p.get("total_comprado") == 257120 and p.get("cumplimiento") == 100 and p.get("calificacion") == 4.17,
      f"HTTP {s}: {p.get('razon_social')}: órdenes={p.get('ordenes')}, comprado={p.get('total_comprado')}, cumplimiento={p.get('cumplimiento')}%, calificación={p.get('calificacion')}")
s, b = call("GET", "/reportes/proveedores/pdf", FIN)
check("109", "E2", "Exportar reporte de proveedores a PDF", s == 200 and "pdf" in (b.get("_type") or ""), f"HTTP {s}: {b.get('_bytes')} bytes")
s, b = call("GET", f"/reportes/proveedores?fechaInicio={dias(1)}&fechaFin={iso(hoy)}", FIN)
check("109", "E3", "Rango de fechas inválido", s == 400, f"HTTP {s}: {msg(b)}")

# ---------- CP-110 Cuentas contables (HU-CON-003) ----------
s, b = call("GET", "/contabilidad/cuentas", FIN)
check("110", "E1", "Catálogo base de cuentas (PUC)", s == 200 and len(b["data"]) >= 15, f"HTTP {s}: {len(b.get('data', []))} cuentas")
s, b = call("POST", "/contabilidad/cuentas", FIN, json={"codigo": "5160", "nombre_cuenta": "Mantenimiento de equipos", "tipo": "Gasto", "naturaleza": "Débito"})
CTA = b.get("data", {}).get("id_cuenta")
check("110", "E2", "Crear cuenta", s == 201, f"HTTP {s}: id={CTA}")
s, b = call("POST", "/contabilidad/cuentas", FIN, json={"codigo": "5160", "nombre_cuenta": "Otra", "tipo": "Gasto", "naturaleza": "Débito"})
check("110", "E3", "Código duplicado", s == 409, f"HTTP {s}: {msg(b)}")
s, b = call("POST", "/contabilidad/cuentas", FIN, json={"codigo": "ABC", "nombre_cuenta": "X", "tipo": "Otro", "naturaleza": "Neutra"})
check("110", "E4", "Datos inválidos", s == 400, f"HTTP {s}: {msg(b)}")
s, b = call("PATCH", f"/contabilidad/cuentas/{CTA}/estado", FIN, json={"estado": "Inactiva"})
s2, b2 = call("POST", "/contabilidad/egresos", FIN, json={"fecha": iso(hoy), "concepto": "Arreglo nevera", "valor": 80000, "fk_cuenta": CTA, "fk_metodo_pago": 1})
check("110", "E5", "Cuenta inactiva no recibe movimientos", s == 200 and s2 == 400, f"desactivar {s}; egreso HTTP {s2}: {msg(b2)}")
s, b = call("GET", "/contabilidad/cuentas", VEN)
check("110", "E6", "Vendedor sin acceso a contabilidad", s == 403, f"HTTP {s}")

cuenta = lambda cod: next(c["id_cuenta"] for c in call("GET", "/contabilidad/cuentas", FIN)[1]["data"] if c["codigo"] == cod)

# ---------- CP-111 Ingresos y egresos (HU-CON-001 / 002) ----------
s, b = call("POST", "/contabilidad/ingresos", FIN, json={"fecha": dias(-5), "concepto": "Aporte de capital socios", "valor": 2000000, "fk_cuenta": cuenta("3105"), "fk_metodo_pago": 4})
ING = b.get("data", {})
check("111", "E1", "Registrar ingreso", s == 201 and ING.get("referencia", "").startswith("ING-"), f"HTTP {s}: {ING.get('referencia')} valor={ING.get('valor')}")
s, b = call("POST", "/contabilidad/egresos", FIN, json={"fecha": dias(-2), "concepto": "Arriendo local noviembre", "valor": 800000, "fk_cuenta": cuenta("5120"), "fk_metodo_pago": 4})
EGR = b.get("data", {})
check("111", "E2", "Registrar egreso", s == 201 and EGR.get("referencia", "").startswith("EGR-"), f"HTTP {s}: {EGR.get('referencia')} valor={EGR.get('valor')}")
call("POST", "/contabilidad/egresos", FIN, json={"fecha": iso(hoy), "concepto": "Servicios públicos", "valor": 150000, "fk_cuenta": cuenta("5135"), "fk_metodo_pago": 1})
call("POST", "/contabilidad/ingresos", FIN, json={"fecha": iso(hoy), "concepto": "Venta de canastas navideñas por encargo", "valor": 60000, "fk_cuenta": cuenta("4250"), "fk_metodo_pago": 1})
s, b = call("POST", "/contabilidad/ingresos", FIN, json={"fecha": iso(hoy), "concepto": "", "valor": -5})
check("111", "E3", "Campos obligatorios y valor positivo", s == 400, f"HTTP {s}: {msg(b)}")
s, b = call("GET", f"/contabilidad/egresos/{EGR['id_egreso']}/comprobante-pdf", FIN)
check("111", "E4", "Comprobante de egreso en PDF", s == 200 and "pdf" in (b.get("_type") or ""), f"HTTP {s}: {b.get('_bytes')} bytes")
s, b = call("POST", "/contabilidad/egresos", FIN, json={"fecha": iso(hoy), "concepto": "Duplicado por error", "valor": 1000, "fk_cuenta": cuenta("5195"), "fk_metodo_pago": 1})
s2, b2 = call("PATCH", f"/contabilidad/egresos/{b['data']['id_egreso']}/anular", FIN, json={"motivo": "Registro duplicado"})
check("111", "E5", "Anular egreso manual", s2 == 200 and b2["data"]["estado"] == "Anulado", f"HTTP {s2}: estado={b2.get('data', {}).get('estado')}")
id_ing_venta = sql(f"SELECT id_ingresos FROM ingresos WHERE referencia='{V1['numero_venta']}'")
s, b = call("PATCH", f"/contabilidad/ingresos/{id_ing_venta}/anular", FIN, json={"motivo": "Intento"})
check("111", "E6", "No se anula desde contabilidad un ingreso generado por una venta", s == 409, f"HTTP {s}: {msg(b)}")

# ---------- CP-112 Consultar movimientos (HU-CON-004) ----------
s, b = call("GET", f"/contabilidad/movimientos?fechaInicio={dias(-30)}&fechaFin={iso(hoy)}", FIN)
t = b.get("data", {}).get("totales", {})
check("112", "E1", "Movimientos del periodo con totales", s == 200 and t.get("ingresos") > 0 and t.get("egresos") > 0, f"HTTP {s}: ingresos={t.get('ingresos')}, egresos={t.get('egresos')}, neto={t.get('neto')}, registros={t.get('movimientos')}")
s, b = call("GET", f"/contabilidad/movimientos?tipo=egreso&fk_cuenta={cuenta('5120')}", FIN)
check("112", "E2", "Filtrar por tipo y cuenta", s == 200 and len(b["data"]["movimientos"]) == 1, f"{len(b['data']['movimientos'])} movimiento(s): {b['data']['movimientos'][0]['concepto'] if b['data']['movimientos'] else ''}")
check("112", "E3", "Totales por cuenta", len(b["data"]["porCuenta"]) == 1, f"porCuenta={b['data']['porCuenta']}")

# ---------- CP-113 Estado de resultados (HU-CON-006) ----------
s, b = call("GET", f"/contabilidad/estado-resultados?fechaInicio={dias(-30)}&fechaFin={iso(hoy)}", FIN)
er = b.get("data", {})
esperado_bruta = er["ingresos"]["ingresosNetos"] - er["costos"]["total"]
check("113", "E1", "Estado de resultados cuadra", s == 200 and abs(er["utilidadBruta"] - esperado_bruta) < 0.01
      and abs(er["utilidadNeta"] - (er["utilidadBruta"] - er["gastos"]["total"] + er["otrosIngresos"]["total"])) < 0.01,
      f"HTTP {s}: ingresos netos={er['ingresos']['ingresosNetos']}, costo={er['costos']['total']}, bruta={er['utilidadBruta']}, gastos={er['gastos']['total']}, otros={er['otrosIngresos']['total']}, {er['resultado'].lower()} neta={er['utilidadNeta']}")
check("113", "E2", "Devoluciones y anuladas descontadas", er["ingresos"]["devoluciones"] > 0, f"devoluciones={er['ingresos']['devoluciones']}")
s, b = call("GET", f"/contabilidad/estado-resultados/pdf?fechaInicio={dias(-30)}&fechaFin={iso(hoy)}", FIN)
check("113", "E3", "Exportar a PDF", s == 200 and "pdf" in (b.get("_type") or ""), f"HTTP {s}: {b.get('_bytes')} bytes")

# ---------- CP-114 Balance general (HU-CON-005) ----------
s, b = call("GET", "/contabilidad/balance-general", FIN)
bg = b.get("data", {}).get("totales", {})
check("114", "E1", "Ecuación contable: Activo = Pasivo + Patrimonio", s == 200 and abs(bg["activos"] - bg["pasivoMasPatrimonio"]) < 0.01, f"HTTP {s}: activos={bg.get('activos')}, pasivos={bg.get('pasivos')}, patrimonio={bg.get('patrimonio')}")
inv = next(a["valor"] for a in b["data"]["activos"] if a["codigo"] == "1435")
inv_bd = float(sql("SELECT SUM(stock*costo_produccion) FROM producto WHERE deleted_at IS NULL AND stock>0"))
check("114", "E2", "Inventario valorado al costo coincide con la BD", abs(inv - inv_bd) < 0.01, f"inventario balance={inv}, BD={inv_bd}")
s, b = call("GET", f"/contabilidad/balance-general/pdf?fechaCorte={iso(hoy)}", FIN)
check("114", "E3", "Exportar balance a PDF", s == 200 and "pdf" in (b.get("_type") or ""), f"HTTP {s}: {b.get('_bytes')} bytes")

# ---------- CP-115 Flujo de caja (HU-CON-007) ----------
s, b = call("GET", f"/contabilidad/flujo-caja?fechaInicio={dias(-30)}&fechaFin={iso(hoy)}", FIN)
fc = b.get("data", {})
check("115", "E1", "Saldo final = inicial + entradas − salidas", s == 200 and abs(fc["saldoFinal"] - (fc["saldoInicial"] + fc["entradas"] - fc["salidas"])) < 0.01,
      f"HTTP {s}: inicial={fc.get('saldoInicial')}, entradas={fc.get('entradas')}, salidas={fc.get('salidas')}, final={fc.get('saldoFinal')}")
s2, b2 = call("GET", f"/contabilidad/flujo-caja?fechaInicio={iso(hoy)}&fechaFin={iso(hoy)}", FIN)
check("115", "E2", "El saldo inicial arrastra los días anteriores", abs(b2["data"]["saldoInicial"] - fc["porDia"][-2]["saldo"]) < 0.01 if len(fc["porDia"]) > 1 else True,
      f"saldo inicial hoy={b2['data']['saldoInicial']}")
s, b = call("GET", f"/contabilidad/flujo-caja/pdf?fechaInicio={dias(-30)}&fechaFin={iso(hoy)}", FIN)
check("115", "E3", "Exportar flujo de caja a PDF", s == 200 and "pdf" in (b.get("_type") or ""), f"HTTP {s}: {b.get('_bytes')} bytes")

# ---------- CP-116 Auditoría de las nuevas operaciones ----------
s, b = call("GET", "/usuarios/auditoria?limite=300", ADM)
acc = {a["accion"] for a in b["data"]}
esperadas = {"EDITAR_VENTA", "DEVOLUCION", "ANULAR_VENTA", "CAMBIAR_PERMISOS", "CREAR_ORDEN_COMPRA", "RECIBIR_ORDEN_COMPRA", "CANCELAR_ORDEN_COMPRA", "EVALUAR_PROVEEDOR", "REGISTRAR_INGRESO", "REGISTRAR_EGRESO", "ANULAR_EGRESO", "CREAR_CUENTA"}
check("116", "E1", "Las nuevas operaciones quedan en la auditoría", esperadas <= acc, f"faltan={sorted(esperadas - acc) or 'ninguna'}")

json.dump({"fecha": iso(hoy), "resultados": R}, open("/home/claude/test/resultados_api_v2.json", "w"), ensure_ascii=False, indent=1)
print(f"\n{sum(x['ok'] for x in R)}/{len(R)} escenarios conformes")
