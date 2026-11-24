"""Pruebas de caja negra sobre la API (backend real + MariaDB).
Guarda cada escenario con su resultado obtenido en resultados_api.json para el plan de pruebas."""
import json, subprocess, datetime, requests

API = "http://localhost:3000/api"
R = []  # resultados


def sql(q):
    return subprocess.run(["sudo", "mariadb", "-N", "herencia_database", "-e", q], capture_output=True, text=True).stdout.strip()


def call(method, path, token=None, **kw):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.request(method, API + path, headers=h, timeout=20, **kw)
    try:
        body = r.json()
    except Exception:
        body = {"_bytes": len(r.content), "_type": r.headers.get("content-type")}
    return r.status_code, body


def check(cp, esc, desc, ok, obtenido):
    R.append({"cp": cp, "esc": esc, "desc": desc, "ok": bool(ok), "obtenido": obtenido})
    print(("PASS " if ok else "FAIL ") + f"{cp}-{esc} {desc} -> {obtenido}")


def login(correo, clave):
    return call("POST", "/auth/login", json={"correo_usuario": correo, "contraseña_usuario": clave})


hoy = datetime.date.today()
iso = lambda d: d.isoformat()

# ---------------- CP-001 Iniciar sesión ----------------
s, b = login("admin@herenciadepapa.com", "admin1234")
ADM = b.get("token")
check("001", "E1", "Credenciales válidas", s == 200 and ADM, f"HTTP {s}, rol={b.get('data',{}).get('rol',{}).get('nombre_rol')}")
s, b = login("admin@herenciadepapa.com", "malaClave1")
check("001", "E2", "Contraseña incorrecta", s == 401, f"HTTP {s}: {b.get('message')}")
s, b = login("noexiste@herenciadepapa.com", "algo12345")
check("001", "E3", "Usuario no registrado", s == 401, f"HTTP {s}: {b.get('message')}")
s, b = call("POST", "/auth/login", json={"correo_usuario": "", "contraseña_usuario": ""})
check("001", "E4", "Campos vacíos", s == 400, f"HTTP {s}: {', '.join((b.get('detalles') or {}).values())}")

# ---------------- CP-002 Registro público eliminado ----------------
s, b = call("POST", "/auth/register", json={"nombre_usuario": "X", "apellido_usuario": "Y", "correo_usuario": "x@y.com", "contraseña_usuario": "abc12345", "fk_usuario_id_rol": 1})
check("002", "E1", "POST /auth/register ya no existe", s == 404, f"HTTP {s}: {b.get('message')}")
s, b = call("POST", "/usuarios", json={"nombre_usuario": "X", "apellido_usuario": "Y", "correo_usuario": "x@y.com", "contraseña_usuario": "abc12345", "fk_usuario_id_rol": 2})
check("002", "E2", "Crear usuario sin sesión", s == 401, f"HTTP {s}: {b.get('message')}")

# ---------------- CP-003 Admin añade usuarios ----------------
nuevo_v = {"nombre_usuario": "Laura", "apellido_usuario": "Gómez", "correo_usuario": "laura.ventas@herenciadepapa.com", "contraseña_usuario": "Ventas2026", "telefono_usuario": "3104445566", "fk_usuario_id_rol": 2}
s, b = call("POST", "/usuarios", ADM, json=nuevo_v)
ID_LAURA = b.get("data", {}).get("idusuario")
check("003", "E1", "Crear usuario Vendedor", s == 201 and b["data"]["rol"]["nombre_rol"] == "Vendedor", f"HTTP {s}: id={ID_LAURA}, rol={b.get('data',{}).get('rol',{}).get('nombre_rol')}")
nuevo_f = {"nombre_usuario": "Carlos", "apellido_usuario": "Ríos", "correo_usuario": "carlos.finanzas@herenciadepapa.com", "contraseña_usuario": "Finanzas2026", "fk_usuario_id_rol": 3}
s, b = call("POST", "/usuarios", ADM, json=nuevo_f)
ID_CARLOS = b.get("data", {}).get("idusuario")
check("003", "E2", "Crear usuario Finanzas", s == 201 and b["data"]["rol"]["nombre_rol"] == "Finanzas", f"HTTP {s}: id={ID_CARLOS}, rol={b.get('data',{}).get('rol',{}).get('nombre_rol')}")
s, b = call("POST", "/usuarios", ADM, json=nuevo_v)
check("003", "E3", "Correo ya registrado", s == 409, f"HTTP {s}: {b.get('message')}")
s, b = call("POST", "/usuarios", ADM, json={**nuevo_v, "correo_usuario": "otro@herenciadepapa.com", "contraseña_usuario": "123"})
check("003", "E4", "Contraseña débil", s == 400, f"HTTP {s}: {(b.get('detalles') or {}).get('contraseña_usuario')}")
s, b = call("POST", "/usuarios", ADM, json={"correo_usuario": "incompleto@herenciadepapa.com"})
check("003", "E5", "Campos obligatorios incompletos", s == 400, f"HTTP {s}: {len(b.get('detalles') or {})} campos con error")
s, b = login("laura.ventas@herenciadepapa.com", "Ventas2026")
VEN = b.get("token")
s2, b2 = call("POST", "/usuarios", VEN, json={**nuevo_v, "correo_usuario": "intruso@herenciadepapa.com"})
check("003", "E6", "Vendedor intenta crear usuarios", s == 200 and s2 == 403, f"login HTTP {s}; crear HTTP {s2}: {b2.get('message')}")

# ---------------- CP-004 Modificar / desactivar usuarios ----------------
s, b = call("PUT", f"/usuarios/{ID_LAURA}", ADM, json={"telefono_usuario": "3201112233"})
check("004", "E1", "Editar datos del usuario", s == 200 and b["data"]["telefono_usuario"] == "3201112233", f"HTTP {s}: teléfono={b.get('data',{}).get('telefono_usuario')}")
s, b = call("PATCH", f"/usuarios/{ID_LAURA}/estado", ADM, json={"activo": False})
s2, b2 = login("laura.ventas@herenciadepapa.com", "Ventas2026")
s3, b3 = call("GET", "/productos", VEN)
check("004", "E2", "Desactivar usuario", s == 200 and s2 == 403 and s3 == 401, f"desactivar {s}; login {s2}: {b2.get('message')}; token anterior {s3}")
s, b = call("PATCH", f"/usuarios/{ID_LAURA}/estado", ADM, json={"activo": True})
s2, b2 = login("laura.ventas@herenciadepapa.com", "Ventas2026")
VEN = b2.get("token")
check("004", "E3", "Reactivar usuario", s == 200 and s2 == 200, f"activar {s}; login {s2}")
id_admin = sql("SELECT idusuario FROM usuario WHERE correo_usuario='admin@herenciadepapa.com'")
s, b = call("PATCH", f"/usuarios/{id_admin}/estado", ADM, json={"activo": False})
check("004", "E4", "Administrador se desactiva a sí mismo", s == 409, f"HTTP {s}: {b.get('message')}")
s, b = call("PUT", f"/usuarios/{ID_CARLOS}", ADM, json={"fk_usuario_id_rol": 9})
check("004", "E5", "Asignar rol inexistente", s == 400, f"HTTP {s}: {(b.get('detalles') or {}).get('fk_usuario_id_rol') or b.get('message')}")

# ---------------- CP-005 Bloqueo por intentos fallidos ----------------
msgs = []
for i in range(5):
    s, b = login("carlos.finanzas@herenciadepapa.com", "Equivocada1")
    msgs.append(s)
s, b = login("carlos.finanzas@herenciadepapa.com", "Finanzas2026")
check("005", "E1", "5 intentos fallidos bloquean la cuenta", msgs[-1] == 401 and s == 423, f"intentos {msgs}; con clave correcta HTTP {s}: {b.get('message')}")
s, b = call("PATCH", f"/usuarios/{ID_CARLOS}/contrasena", ADM, json={"nueva_contrasena": "Temporal2026"})
s2, b2 = login("carlos.finanzas@herenciadepapa.com", "Temporal2026")
check("005", "E2", "Administrador restablece y desbloquea", s == 200 and s2 == 200, f"restablecer {s}; login {s2}")
FIN = b2.get("token")

# ---------------- CP-006 Cambiar contraseña ----------------
s, b = call("PATCH", "/auth/cambiar-contrasena", FIN, json={"contrasena_actual": "otra", "nueva_contrasena": "Finanzas2027"})
check("006", "E1", "Contraseña actual incorrecta", s == 400, f"HTTP {s}: {b.get('message')}")
s, b = call("PATCH", "/auth/cambiar-contrasena", FIN, json={"contrasena_actual": "Temporal2026", "nueva_contrasena": "corta"})
check("006", "E2", "Nueva contraseña débil", s == 400, f"HTTP {s}: {(b.get('detalles') or {}).get('nueva_contrasena')}")
s, b = call("PATCH", "/auth/cambiar-contrasena", FIN, json={"contrasena_actual": "Temporal2026", "nueva_contrasena": "Finanzas2027"})
s2, _ = login("carlos.finanzas@herenciadepapa.com", "Finanzas2027")
check("006", "E3", "Cambio exitoso", s == 200 and s2 == 200, f"cambio {s}; login con la nueva {s2}")

# ---------------- CP-007 Permisos por rol ----------------
s, _ = call("GET", "/reportes/ventas", VEN)
s2, _ = call("GET", "/reportes/ventas", FIN)
s3, _ = call("POST", "/productos", FIN, json={"codigo_producto": "X", "nombre_producto": "X", "fk_producto_id_categoria": 1, "costo_produccion": 1, "precio_venta": 2})
s4, _ = call("GET", "/usuarios", FIN)
check("007", "E1", "Vendedor sin acceso a reportes financieros", s == 403, f"HTTP {s}")
check("007", "E2", "Finanzas accede a reportes", s2 == 200, f"HTTP {s2}")
check("007", "E3", "Finanzas no registra productos ni gestiona usuarios", s3 == 403 and s4 == 403, f"productos {s3}; usuarios {s4}")

# ---------------- CP-008 Auditoría ----------------
s, b = call("GET", "/usuarios/auditoria", ADM)
acciones = {a["accion"] for a in b.get("data", [])}
check("008", "E1", "Se registran accesos y acciones", s == 200 and {"LOGIN", "LOGIN_FALLIDO", "CUENTA_BLOQUEADA", "CREAR_USUARIO", "DESACTIVAR_USUARIO"} <= acciones, f"HTTP {s}: {len(b.get('data', []))} eventos; acciones={sorted(acciones)}")

# ---------------- Datos de inventario ----------------
productos = [
    ("AREQ-250", "Arequipe 250 g", 1, 4200, 7500, 0),
    ("BOC-012", "Bocadillo veleño x12", 2, 6000, 11000, 0),
    ("COC-006", "Cocadas de coco x6", 1, 5000, 9000, 19),
    ("MAN-500", "Manjar blanco 500 g", 1, 9000, 16000, 0),
    ("PAN-010", "Pandebono x10", 3, 7000, 12000, 0),
]
IDS = {}
for cod, nom, cat, costo, precio, iva in productos:
    s, b = call("POST", "/productos", VEN, json={"codigo_producto": cod, "nombre_producto": nom, "fk_producto_id_categoria": cat, "costo_produccion": costo, "precio_venta": precio, "iva": iva})
    IDS[cod] = b["data"]["id_producto"]

v1 = iso(hoy + datetime.timedelta(days=12))
v2 = iso(hoy + datetime.timedelta(days=60))
s, b = call("POST", "/ingreso-mercancia", VEN, json={"codigo_entrada": "ENT-T01", "observacion": "Compra inicial", "detalles": [
    {"fk_det_entrada_id_producto": IDS["AREQ-250"], "cantidad": 10, "precio_unitario": 4200, "iva": 0, "numero_lote": "L-AREQ-1", "fecha_vencimiento": v1},
    {"fk_det_entrada_id_producto": IDS["AREQ-250"], "cantidad": 20, "precio_unitario": 4200, "iva": 0, "numero_lote": "L-AREQ-2", "fecha_vencimiento": v2},
    {"fk_det_entrada_id_producto": IDS["BOC-012"], "cantidad": 4, "precio_unitario": 6000, "iva": 0, "numero_lote": "L-BOC-1", "fecha_vencimiento": v1},
    {"fk_det_entrada_id_producto": IDS["COC-006"], "cantidad": 25, "precio_unitario": 5000, "iva": 0, "numero_lote": "L-COC-1", "fecha_vencimiento": v2},
    {"fk_det_entrada_id_producto": IDS["MAN-500"], "cantidad": 3, "precio_unitario": 9000, "iva": 0, "numero_lote": "L-MAN-1", "fecha_vencimiento": v1},
    {"fk_det_entrada_id_producto": IDS["PAN-010"], "cantidad": 40, "precio_unitario": 7000, "iva": 0, "numero_lote": "L-PAN-1", "fecha_vencimiento": v2},
]})
assert s == 201, b


def prod(cod):
    s, b = call("GET", f"/productos/codigo/{cod}", ADM)
    return b.get("data") or {}


# ---------------- CP-009 Vencimiento al agotarse ----------------
p = prod("BOC-012")
check("009", "E1", "Producto con existencias muestra el vencimiento del lote más próximo", p.get("fecha_vencimiento") == v1, f"stock={p.get('stock')}, vence={p.get('fecha_vencimiento')}")
s, b = call("POST", "/ventas/ventas", VEN, json={"fecha": iso(hoy), "detalles": [{"fk_det_venta_id_producto": IDS["BOC-012"], "cantidad": 4}, {"fk_det_venta_id_producto": IDS["AREQ-250"], "cantidad": 12}]})
p = prod("BOC-012")
bd = sql(f"SELECT IFNULL(fecha_vencimiento,'NULL') FROM producto WHERE id_producto={IDS['BOC-012']}")
check("009", "E2", "Al agotarse por venta se quita la fecha de vencimiento", s == 201 and p.get("stock") == 0 and p.get("fecha_vencimiento") is None and bd == "NULL", f"venta HTTP {s}; stock={p.get('stock')}, vence API={p.get('fecha_vencimiento')}, BD={bd}")
s, b = call("GET", "/productos/proximos-vencer?dias=30", ADM)
cods = [x["codigo_producto"] for x in b.get("data", [])]
check("009", "E3", "Agotados no aparecen como próximos a vencer", "BOC-012" not in cods and "MAN-500" in cods, f"próximos a vencer: {cods}")
p = prod("AREQ-250")
check("009", "E4", "Venta FEFO: al agotarse el primer lote toma la fecha del siguiente", p.get("stock") == 18 and p.get("fecha_vencimiento") == v2, f"stock={p.get('stock')}, vence={p.get('fecha_vencimiento')}")
s, b = call("POST", "/salida-mercancia", VEN, json={"codigo_salida": "SAL-T01", "observacion": "Producto vencido", "detalles": [{"fk_det_salida_id_producto": IDS["MAN-500"], "cantidad": 3}]})
p = prod("MAN-500")
lotes = sql(f"SELECT cantidad_actual FROM lote WHERE fk_lote_id_producto={IDS['MAN-500']}")
check("009", "E5", "Salida de mercancía agota el producto y sus lotes", s == 201 and p.get("stock") == 0 and p.get("fecha_vencimiento") is None and lotes == "0", f"salida HTTP {s}; stock={p.get('stock')}, vence={p.get('fecha_vencimiento')}, lote={lotes}")
s, b = call("POST", "/ingreso-mercancia", VEN, json={"codigo_entrada": "ENT-T02", "detalles": [{"fk_det_entrada_id_producto": IDS["MAN-500"], "cantidad": 8, "precio_unitario": 9000, "numero_lote": "L-MAN-2", "fecha_vencimiento": v2}]})
p = prod("MAN-500")
check("009", "E6", "Nueva entrada devuelve la fecha del nuevo lote", s == 201 and p.get("fecha_vencimiento") == v2, f"entrada HTTP {s}; stock={p.get('stock')}, vence={p.get('fecha_vencimiento')}")

# ---------------- CP-010 Retirar productos agotados ----------------
s, b = call("POST", "/ingreso-mercancia", VEN, json={"codigo_entrada": "ENT-T03", "detalles": [{"fk_det_entrada_id_producto": IDS["PAN-010"], "cantidad": 1, "precio_unitario": 7000, "numero_lote": "L-PAN-2", "fecha_vencimiento": v2}]})
s, b = call("POST", "/productos/retirar-agotados", FIN)
check("010", "E1", "Finanzas no puede retirar productos", s == 403, f"HTTP {s}")
s, b = call("POST", "/productos/retirar-agotados", VEN)
nombres = [x["nombre_producto"] for x in b.get("data", [])]
s2, b2 = call("GET", "/productos", ADM)
visibles = [x["codigo_producto"] for x in b2.get("data", [])]
check("010", "E2", "Retirar agotados del catálogo", s == 200 and "BOC-012" not in visibles and "AREQ-250" in visibles, f"HTTP {s}: retirados={nombres}; catálogo={visibles}")
s, b = call("POST", "/productos/retirar-agotados", VEN)
check("010", "E3", "Sin agotados que retirar", s == 200 and b.get("data") == [], f"HTTP {s}: {b.get('message')}")

# ---------------- Ventas adicionales e históricas ----------------
call("POST", "/ventas/ventas", VEN, json={"fecha": iso(hoy - datetime.timedelta(days=3)), "detalles": [{"fk_det_venta_id_producto": IDS["COC-006"], "cantidad": 5}, {"fk_det_venta_id_producto": IDS["PAN-010"], "cantidad": 6}]})
call("POST", "/ventas/ventas", ADM, json={"fecha": iso(hoy - datetime.timedelta(days=10)), "descuento": 2000, "detalles": [{"fk_det_venta_id_producto": IDS["AREQ-250"], "cantidad": 4}]})
call("POST", "/ventas/ventas", VEN, json={"fecha": iso(hoy - datetime.timedelta(days=20)), "detalles": [{"fk_det_venta_id_producto": IDS["PAN-010"], "cantidad": 10}]})
# ventas antiguas (hace 2 y 4 meses) directamente en BD
uid = sql("SELECT idusuario FROM usuario WHERE correo_usuario='vendedor@herenciadepapa.com'")
sql(f"INSERT INTO venta (total,numero_venta,fecha,fk_venta_id_usuario,subtotal,iva,descuento) VALUES (150000,'VEN-H01','{iso(hoy - datetime.timedelta(days=65))}',{uid},150000,0,0),(178500,'VEN-H02','{iso(hoy - datetime.timedelta(days=125))}',{uid},150000,28500,0)")

# ---------------- CP-011 Reporte general de ventas ----------------
s, b = call("GET", "/reportes/ventas", FIN)
d = b.get("data", {})
r = d.get("resumen", {})
check("011", "E1", "Reporte por defecto = último mes", s == 200 and d["periodo"]["fechaInicio"] == iso(hoy - datetime.timedelta(days=30)) and r.get("cantidadVentas") == 4, f"periodo {d.get('periodo')}; ventas={r.get('cantidadVentas')}, total={r.get('totalVentas')}, IVA={r.get('iva')}, utilidad={r.get('utilidadBruta')}")
s, b = call("GET", f"/reportes/ventas?fechaInicio={iso(hoy - datetime.timedelta(days=150))}&fechaFin={iso(hoy)}", FIN)
check("011", "E2", "Rango personalizado incluye ventas antiguas", s == 200 and b["data"]["resumen"]["cantidadVentas"] == 6, f"ventas en 150 días = {b.get('data',{}).get('resumen',{}).get('cantidadVentas')}")
s, b = call("GET", f"/reportes/ventas?fechaInicio={iso(hoy)}&fechaFin={iso(hoy - datetime.timedelta(days=5))}", FIN)
check("011", "E3", "Rango inválido (inicio > fin)", s == 400, f"HTTP {s}: {b.get('message')}")
s, b = call("GET", "/reportes/ventas/pdf", FIN)
check("011", "E4", "Exportar a PDF", s == 200 and "pdf" in (b.get("_type") or ""), f"HTTP {s}: {b.get('_type')}, {b.get('_bytes')} bytes")
s, b = call("GET", "/reportes/ventas", ADM)
pp = b["data"]["porProducto"]
check("011", "E5", "Producto retirado conserva su historial en el reporte", any(x["nombre_producto"] == "Bocadillo veleño x12" for x in pp), f"productos en reporte: {[x['nombre_producto'] for x in pp]}")

# ---------------- CP-012 Listas del último mes ----------------
s, b = call("GET", f"/ventas/ventas?pagina=1&limite=50&fechaInicio={iso(hoy - datetime.timedelta(days=30))}&fechaFin={iso(hoy)}", FIN)
nums = [v["numero_venta"] for v in b["data"]["ventas"]]
check("012", "E1", "Ventas filtradas al último mes", s == 200 and "VEN-H01" not in nums and len(nums) == 4, f"ventas={nums}")
s, b = call("GET", "/ventas/ventas?pagina=1&limite=50", FIN)
nums = [v["numero_venta"] for v in b["data"]["ventas"]]
check("012", "E2", "Opción 'Todo' muestra el historial completo", "VEN-H01" in nums and "VEN-H02" in nums, f"total ventas={b['data']['total']}")

json.dump({"fecha": iso(hoy), "resultados": R}, open("/home/claude/test/resultados_api.json", "w"), ensure_ascii=False, indent=1)
print(f"\n{sum(x['ok'] for x in R)}/{len(R)} escenarios conformes")
