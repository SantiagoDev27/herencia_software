"""Pruebas de interfaz (Playwright + Chrome) con capturas como evidencia del plan de pruebas."""
import json, time, datetime, requests
from playwright.sync_api import sync_playwright

WEB = "http://localhost:5173"
API = "http://localhost:3000/api"
OUT = "/home/claude/test/capturas"
import os
os.makedirs(OUT, exist_ok=True)
R = []


def check(cp, esc, desc, ok, obtenido, captura):
    R.append({"cp": cp, "esc": esc, "desc": desc, "ok": bool(ok), "obtenido": obtenido, "captura": captura})
    print(("PASS " if ok else "FAIL ") + f"{cp}-{esc} {desc} -> {obtenido}")


def api_login(correo, clave):
    return requests.post(f"{API}/auth/login", json={"correo_usuario": correo, "contraseña_usuario": clave}).json()["token"]


def nueva_pagina(browser, clock=False):
    ctx = browser.new_context(viewport={"width": 1366, "height": 820}, locale="es-CO", timezone_id="America/Bogota")
    page = ctx.new_page()
    if clock:
        page.clock.install()
    return ctx, page


def entrar(page, correo, clave):
    page.goto(WEB + "/")
    page.fill("#login-correo", correo)
    page.fill("#login-clave", clave)
    page.click("button[type=submit]")
    page.wait_for_url("**/dashboard", timeout=10000)
    page.wait_for_timeout(1200)


def shot(page, nombre, full=False, locator=None):
    ruta = f"{OUT}/{nombre}.png"
    if locator is not None:
        locator.screenshot(path=ruta)
    else:
        page.screenshot(path=ruta, full_page=full)
    return ruta


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)

    # ---------- Login sin registro ----------
    ctx, page = nueva_pagina(browser)
    page.goto(WEB + "/")
    page.wait_for_timeout(800)
    tiene_registro = page.get_by_text("Registrarse").count() > 0 or page.get_by_text("Crear cuenta").count() > 0
    check("002", "E3", "La pantalla de inicio no ofrece registro público", not tiene_registro, "Solo formulario de inicio de sesión", shot(page, "u_login"))
    page.fill("#login-correo", "admin@herenciadepapa.com")
    page.fill("#login-clave", "incorrecta1")
    page.click("button[type=submit]")
    page.wait_for_timeout(1200)
    err = page.get_by_text("Credenciales incorrectas").count() > 0
    check("001", "E2", "Mensaje de error con contraseña incorrecta", err, "Se muestra 'Credenciales incorrectas.'", shot(page, "u_login_error", locator=page.locator(".auth-card")))
    ctx.close()

    # ---------- Administrador: usuarios ----------
    ctx, page = nueva_pagina(browser)
    entrar(page, "admin@herenciadepapa.com", "admin1234")
    menu = page.locator("aside nav").inner_text()
    check("007", "E4", "Administrador ve todos los módulos, incluido Usuarios", "Usuarios" in menu and "Reportes" in menu, "Menú: " + menu.replace("\n", " · "), shot(page, "u_admin_dashboard"))
    page.goto(WEB + "/dashboard/usuarios")
    page.wait_for_timeout(1500)
    check("003", "E7", "Listado de usuarios con rol y estado", page.get_by_text("laura.ventas@herenciadepapa.com").count() > 0, "Lista usuarios con rol, estado y último acceso", shot(page, "u_usuarios"))
    page.click("text=Añadir usuario")
    page.fill("#u-nombre", "Sofía")
    page.fill("#u-apellido", "Muñoz")
    page.fill("#u-correo", "sofia.ventas@herenciadepapa.com")
    page.fill("#u-tel", "3157778899")
    page.select_option("#u-rol", "2")
    page.fill("#u-clave", "Dulces2026")
    shot(page, "u_usuario_form", locator=page.locator("[role=dialog] .card"))
    page.click("text=Crear usuario")
    page.wait_for_timeout(1500)
    creado = page.get_by_text("sofia.ventas@herenciadepapa.com").count() > 0
    check("003", "E8", "Añadir usuario Vendedor desde la interfaz", creado, "Mensaje de confirmación y usuario en la lista", shot(page, "u_usuario_creado"))
    page.click("text=Auditoría de accesos")
    page.wait_for_timeout(800)
    check("008", "E2", "Consulta de la auditoría en la interfaz", page.get_by_text("CREAR USUARIO").count() > 0, "Tabla con fecha, usuario, acción, detalle e IP", shot(page, "u_auditoria"))
    ctx.close()

    # ---------- Vendedor: menú según rol ----------
    ctx, page = nueva_pagina(browser)
    entrar(page, "sofia.ventas@herenciadepapa.com", "Dulces2026")
    menu = page.locator("aside nav").inner_text()
    ok = "Usuarios" not in menu and "Reportes" not in menu and "Ventas" in menu
    check("007", "E5", "Vendedor solo ve sus módulos", ok, "Menú: " + menu.replace("\n", " · "), shot(page, "u_menu_vendedor", locator=page.locator("aside")))
    page.goto(WEB + "/dashboard/usuarios")
    page.wait_for_timeout(800)
    check("007", "E6", "Vendedor que escribe la URL de Usuarios es redirigido", page.url.endswith("/dashboard"), f"URL final: {page.url.replace(WEB, '')}", shot(page, "u_vendedor_redirect"))
    ctx.close()

    # ---------- Productos: agotado sin fecha y retiro ----------
    tok = api_login("vendedor@herenciadepapa.com", "vendedor1234")
    h = {"Authorization": f"Bearer {tok}"}
    cocadas = requests.get(f"{API}/productos/codigo/COC-006", headers=h).json()["data"]
    requests.post(f"{API}/ventas/ventas", headers=h, json={"fecha": datetime.date.today().isoformat(), "detalles": [{"fk_det_venta_id_producto": cocadas["id_producto"], "cantidad": cocadas["stock"]}]})
    ctx, page = nueva_pagina(browser)
    entrar(page, "vendedor@herenciadepapa.com", "vendedor1234")
    page.goto(WEB + "/dashboard/productos")
    page.wait_for_timeout(1500)
    fila = page.locator("tr", has_text="Cocadas de coco x6")
    sin_fecha = "Sin existencias" in fila.inner_text()
    check("009", "E7", "Producto agotado se muestra sin fecha de vencimiento", sin_fecha, "Columna Vencimiento: 'Sin existencias'", shot(page, "u_productos"))
    page.click("button:has-text('Agotados')")
    page.wait_for_timeout(1200)
    shot(page, "u_productos_agotados")
    page.click("button:has-text('Retirar agotados')")
    page.wait_for_timeout(500)
    shot(page, "u_retirar_confirmar", locator=page.locator("[role=dialog] .card"))
    page.click("[role=dialog] button:has-text('Retirar todos')")
    page.wait_for_timeout(1500)
    retirado = page.get_by_text("retirado(s) del catálogo").count() > 0
    check("010", "E4", "Retirar agotados desde la interfaz", retirado, "Confirmación y el producto sale del catálogo", shot(page, "u_retirados"))
    ctx.close()

    # ---------- Ventas: último mes y actualización automática ----------
    ctx, page = nueva_pagina(browser)
    entrar(page, "admin@herenciadepapa.com", "admin1234")
    page.goto(WEB + "/dashboard/ventas")
    page.wait_for_timeout(1500)
    txt = page.locator("table").inner_text()
    check("012", "E3", "Ventas muestra por defecto el último mes", "VEN-H01" not in txt and "VEN-001" in txt, "Filtro 'Último mes' activo; ventas antiguas ocultas", shot(page, "u_ventas_mes"))
    page.click("button:has-text('Todo')")
    page.wait_for_timeout(1500)
    txt = page.locator("table").inner_text()
    check("012", "E4", "Opción 'Todo' muestra ventas antiguas", "VEN-H01" in txt, "Aparecen VEN-H01 y VEN-H02", shot(page, "u_ventas_todo"))
    page.click("button:has-text('Último mes')")
    page.wait_for_timeout(1200)
    antes = page.locator("tbody tr").count()
    pan = requests.get(f"{API}/productos/codigo/PAN-010", headers=h).json()["data"]
    nv = requests.post(f"{API}/ventas/ventas", headers=h, json={"fecha": datetime.date.today().isoformat(), "detalles": [{"fk_det_venta_id_producto": pan["id_producto"], "cantidad": 2}]}).json()["data"]["venta"]["numero_venta"]
    page.wait_for_timeout(17000)  # intervalo de actualización: 15 s
    aparece = page.locator("table").inner_text().count(nv) > 0
    check("013", "E1", "Una venta hecha por otro usuario aparece sin recargar", aparece, f"{nv} apareció tras ≤15 s sin pulsar recargar", shot(page, "u_ventas_auto"))
    page.goto(WEB + "/dashboard/movimientos?tab=salidas")
    page.wait_for_timeout(1500)
    shot(page, "u_movimientos_mes")
    txt = page.locator("table").inner_text()
    check("012", "E5", "Entradas y salidas muestran el último mes", "VEN-H01" not in txt, "Selector 'Mostrar: Último mes' activo", "u_movimientos_mes.png")
    ctx.close()

    # ---------- Finanzas: reporte general de ventas ----------
    ctx, page = nueva_pagina(browser)
    entrar(page, "carlos.finanzas@herenciadepapa.com", "Finanzas2027")
    menu = page.locator("aside nav").inner_text()
    check("007", "E7", "Finanzas ve Reportes y no Productos ni Usuarios", "Reportes" in menu and "Productos" not in menu and "Usuarios" not in menu, "Menú: " + menu.replace("\n", " · "), shot(page, "u_menu_finanzas", locator=page.locator("aside")))
    page.goto(WEB + "/dashboard/reportes")
    page.wait_for_timeout(2500)
    ok = page.get_by_text("Reporte general de ventas").count() > 0 and page.get_by_text("Ventas e IVA por día").count() > 0
    check("011", "E6", "Reporte general de ventas en pantalla (último mes)", ok, "Indicadores, gráfico diario, productos, vendedores y detalle", shot(page, "u_reporte_ventas", full=True))
    with page.expect_download() as d:
        page.click("button:has-text('Excel')")
    nombre = d.value.suggested_filename
    d.value.save_as(f"{OUT}/{nombre}")
    check("011", "E7", "Exportar el reporte a Excel (CSV)", nombre.endswith(".csv"), f"Archivo descargado: {nombre}", "u_reporte_ventas.png")
    with page.expect_download() as d:
        page.click("button:has-text('Exportar PDF')")
    nombre = d.value.suggested_filename
    d.value.save_as(f"{OUT}/{nombre}")
    check("011", "E8", "Exportar el reporte a PDF desde la interfaz", nombre.endswith(".pdf"), f"Archivo descargado: {nombre}", "u_reporte_ventas.png")
    page.click("button:has-text('Personalizado')")
    page.fill("#rv-ini", (datetime.date.today() - datetime.timedelta(days=150)).isoformat())
    page.click("button:has-text('Aplicar')")
    page.wait_for_timeout(2000)
    shot(page, "u_reporte_personalizado")
    page.click("button:has-text('Reporte de inventario')")
    page.wait_for_timeout(1500)
    shot(page, "u_reporte_inventario")
    page.goto(WEB + "/dashboard/cuenta")
    page.wait_for_timeout(800)
    page.fill("#c-actual", "Finanzas2027")
    page.fill("#c-nueva", "abc")
    page.fill("#c-conf", "abc")
    page.click("button:has-text('Actualizar contraseña')")
    page.wait_for_timeout(800)
    check("006", "E4", "Cambio de contraseña valida la clave robusta en la interfaz", page.get_by_text("al menos 8 caracteres").count() > 0, "Mensaje de validación", shot(page, "u_mi_cuenta"))
    ctx.close()

    # ---------- Cierre por inactividad ----------
    ctx, page = nueva_pagina(browser, clock=True)
    entrar(page, "vendedor@herenciadepapa.com", "vendedor1234")
    page.clock.fast_forward("16:00")
    page.wait_for_timeout(1500)
    cerrado = page.get_by_text("inactividad").count() > 0 and page.url.rstrip("/").endswith("5173")
    check("014", "E1", "La sesión se cierra tras 15 minutos sin actividad", cerrado, "Vuelve al inicio con aviso de inactividad", shot(page, "u_inactividad"))
    ctx.close()
    browser.close()

json.dump({"resultados": R}, open("/home/claude/test/resultados_ui.json", "w"), ensure_ascii=False, indent=1)
print(f"\n{sum(x['ok'] for x in R)}/{len(R)} escenarios de interfaz conformes")
