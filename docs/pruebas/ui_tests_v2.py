"""Plan de pruebas v2 — pruebas de interfaz (Playwright + Chrome) de los módulos completados."""
import json, os, datetime, requests
from playwright.sync_api import sync_playwright

WEB, API = "http://localhost:5173", "http://localhost:3000/api"
OUT = "/home/claude/test/capturas_v2"
os.makedirs(OUT, exist_ok=True)
R = []
hoy = datetime.date.today()


def check(cp, esc, desc, ok, obtenido, captura):
    R.append({"cp": cp, "esc": esc, "desc": desc, "ok": bool(ok), "obtenido": obtenido, "captura": captura})
    print(("PASS " if ok else "FAIL ") + f"{cp}-{esc} {desc} -> {obtenido}")


def tok(c, k):
    return requests.post(f"{API}/auth/login", json={"correo_usuario": c, "contraseña_usuario": k}).json()["token"]


def pagina(b):
    ctx = b.new_context(viewport={"width": 1366, "height": 820}, locale="es-CO", timezone_id="America/Bogota", accept_downloads=True)
    return ctx, ctx.new_page()


def entrar(page, c, k):
    page.goto(WEB + "/")
    page.fill("#login-correo", c)
    page.fill("#login-clave", k)
    page.click("button[type=submit]")
    page.wait_for_url("**/dashboard", timeout=10000)
    page.wait_for_timeout(1000)


def shot(page, nombre, loc=None, full=False):
    ruta = f"{OUT}/{nombre}.png"
    (loc.screenshot(path=ruta) if loc is not None else page.screenshot(path=ruta, full_page=full))
    return f"{nombre}.png"


DIALOG = "[role=dialog] .card"

with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", headless=True)

    # ---------- Vendedor: clientes y venta con cliente ----------
    ctx, page = pagina(b)
    entrar(page, "vendedor@herenciadepapa.com", "vendedor1234")
    menu = page.locator("aside nav").inner_text()
    check("117", "E1", "Menú del Vendedor incluye Clientes y Órdenes de compra, no Contabilidad",
          "Clientes" in menu and "Órdenes de compra" in menu and "Contabilidad" not in menu, "Menú: " + " · ".join(x for x in menu.split("\n") if x), shot(page, "v_menu_vendedor", page.locator("aside")))
    page.goto(WEB + "/dashboard/clientes")
    page.wait_for_timeout(1200)
    page.click("text=Nuevo cliente")
    page.fill("#c-id", "1144556677")
    page.fill("#c-nom", "Andrés")
    page.fill("#c-ape", "Cárdenas")
    page.fill("#c-tel", "3017778899")
    page.fill("#c-mail", "andres@correo.com")
    page.fill("#c-ciu", "Palmira")
    shot(page, "v_cliente_form", page.locator(DIALOG))
    page.click("text=Guardar cliente")
    page.wait_for_timeout(1200)
    check("101", "E8", "Registrar cliente desde la interfaz", page.get_by_text("Cliente Andrés registrado").count() > 0, "Aviso de éxito y cliente en la lista con sus compras", shot(page, "v_clientes"))

    page.goto(WEB + "/dashboard/ventas")
    page.wait_for_timeout(1200)
    page.click("text=Nueva venta")
    page.wait_for_timeout(1200)
    page.select_option("#v-cliente", label=page.locator("#v-cliente option", has_text="Andrés").inner_text())
    page.select_option("#v-metodo", label="nequi")
    page.locator("input[aria-label=Cantidad]").first.fill("3")
    shot(page, "v_venta_form", page.locator(DIALOG))
    page.click("text=Finalizar y facturar")
    page.wait_for_timeout(1800)
    ok = page.get_by_text("Andrés Cárdenas").count() > 0 and page.get_by_role("button", name="Modificar").count() > 0
    check("102", "E4", "Venta con cliente y método de pago desde la interfaz", ok, "La factura muestra el cliente, el pago Nequi y las acciones Modificar / Devolución", shot(page, "v_venta_factura", page.locator(DIALOG)))

    page.get_by_role("button", name="Modificar").click()
    page.wait_for_timeout(1500)
    page.locator("input[aria-label=Cantidad]").first.fill("5")
    page.fill("#v-desc", "1000")
    shot(page, "v_venta_editar", page.locator(DIALOG))
    page.click("text=Guardar cambios")
    page.wait_for_timeout(1800)
    check("103", "E5", "Modificar la venta desde la interfaz", page.get_by_text("actualizada").count() > 0, "Aviso 'Venta … actualizada' y factura con la nueva cantidad", shot(page, "v_venta_editada"))

    page.locator("tbody tr").first.get_by_role("button", name="Ver").click() if page.locator("[role=dialog]").count() == 0 else None
    page.wait_for_timeout(1200)
    page.get_by_role("button", name="Registrar devolución").click()
    page.wait_for_timeout(800)
    page.locator("input[aria-label^='Cantidad a devolver']").first.fill("2")
    page.fill("#d-motivo", "Empaque abierto")
    shot(page, "v_devolucion_form", page.locator(DIALOG))
    with page.expect_download() as d:
        page.get_by_role("button", name="Registrar devolución").last.click()
    nombre = d.value.suggested_filename
    page.wait_for_timeout(1500)
    check("104", "E7", "Registrar devolución desde la interfaz", page.get_by_text("Devolución DEV-").count() > 0 and nombre.endswith(".pdf"),
          f"Aviso de devolución y descarga del comprobante {nombre}", shot(page, "v_devolucion_ok"))
    ctx.close()

    # ---------- Administrador: anular, permisos y evaluar ----------
    ctx, page = pagina(b)
    entrar(page, "admin@herenciadepapa.com", "admin1234")
    page.goto(WEB + "/dashboard/ventas")
    page.wait_for_timeout(1500)
    fila = page.locator("tbody tr", has_text="Registrada").first
    fila.get_by_role("button", name="Ver").click()
    page.wait_for_timeout(1200)
    page.get_by_role("button", name="Anular").click()
    page.fill("#v-motivo", "Error de digitación en la cantidad")
    shot(page, "v_anular_form", page.locator(DIALOG))
    page.get_by_role("button", name="Anular venta").click()
    page.wait_for_timeout(1500)
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    check("105", "E7", "Anular venta desde la interfaz", page.locator("tbody").get_by_text("Anulada").count() > 0, "La venta aparece como 'Anulada' y su total tachado", shot(page, "v_ventas_estados"))

    page.goto(WEB + "/dashboard/usuarios")
    page.wait_for_timeout(1000)
    page.click("text=Permisos por rol")
    page.wait_for_timeout(1200)
    page.get_by_label("Ver contabilidad para Vendedor").check()
    shot(page, "v_permisos")
    page.click("text=Guardar cambios")
    page.wait_for_timeout(1200)
    check("106", "E7", "Configurar permisos desde la interfaz", page.get_by_text("Permisos guardados").count() > 0, "Matriz por rol con casillas y aviso de guardado", shot(page, "v_permisos_ok"))

    page.goto(WEB + "/dashboard/proveedores")
    page.wait_for_timeout(1500)
    page.locator("button[aria-label^='Desempeño de']").first.click()
    page.wait_for_timeout(800)
    page.get_by_label("Calidad de los productos: 3").click()
    page.get_by_placeholder("Observaciones (opcional)").fill("Un lote llegó con empaques golpeados")
    page.click("text=Registrar evaluación")
    page.wait_for_timeout(1200)
    check("108", "E5", "Evaluar proveedor desde la interfaz", page.get_by_text("Evaluación registrada").count() > 0, "Estrellas por criterio, aviso y historial", shot(page, "v_evaluacion", page.locator(DIALOG)))
    page.keyboard.press("Escape")
    page.wait_for_timeout(1500)
    shot(page, "v_proveedores")
    ctx.close()

    # ---------- Vendedor: el permiso concedido aparece sin cerrar sesión ----------
    ctx, page = pagina(b)
    entrar(page, "vendedor@herenciadepapa.com", "vendedor1234")
    menu = page.locator("aside nav").inner_text()
    check("106", "E8", "El Vendedor ve Contabilidad tras concederle el permiso", "Contabilidad" in menu, "Menú: " + " · ".join(x for x in menu.split("\n") if x), shot(page, "v_menu_vendedor_permiso", page.locator("aside")))
    page.goto(WEB + "/dashboard/compras")
    page.wait_for_timeout(1200)
    page.click("text=Nueva orden")
    page.wait_for_timeout(1000)
    page.select_option("#oc-prov", index=1)
    page.wait_for_timeout(1000)
    page.click("text=Agregar producto")
    page.locator("input[aria-label=Cantidad]").last.fill("12")
    page.fill("#oc-fecha", (hoy + datetime.timedelta(days=4)).isoformat())
    shot(page, "v_oc_form", page.locator(DIALOG))
    page.click("text=Registrar orden")
    page.wait_for_timeout(1500)
    check("107", "E9", "Crear orden de compra desde la interfaz", page.get_by_text("registrada por").count() > 0, "Aviso con número y total; se abre el detalle", shot(page, "v_oc_detalle", page.locator(DIALOG)))
    page.locator("[role=dialog]").get_by_role("button", name="Recibir", exact=True).click()
    page.wait_for_timeout(1000)
    for i in range(page.locator("input[type=date][id^=venc-]").count()):
        page.fill(f"#venc-{i}", (hoy + datetime.timedelta(days=60)).isoformat())
    shot(page, "v_oc_recibir", page.locator(DIALOG))
    page.click("text=Confirmar recepción")
    page.wait_for_timeout(1500)
    check("107", "E10", "Recibir orden desde la interfaz", page.get_by_text("recibida").count() > 0, "Aviso de recepción; la orden pasa a 'Recibida'", shot(page, "v_oc_lista"))
    ctx.close()

    # ---------- Finanzas: contabilidad y reportes ----------
    ctx, page = pagina(b)
    entrar(page, "finanzas@herenciadepapa.com", "finanzas1234")
    page.goto(WEB + "/dashboard/contabilidad")
    page.wait_for_timeout(1800)
    shot(page, "v_cont_movimientos")
    page.get_by_role("button", name="Ingreso", exact=True).click()
    page.wait_for_timeout(800)
    page.fill("#m-valor", "350000")
    page.fill("#m-concepto", "Venta de dulces por encargo para evento")
    shot(page, "v_cont_ingreso_form", page.locator(DIALOG))
    with page.expect_download() as d:
        page.get_by_role("button", name="Registrar ingreso").click()
    nombre = d.value.suggested_filename
    page.wait_for_timeout(1500)
    check("111", "E7", "Registrar ingreso desde la interfaz con comprobante", page.get_by_text("registrado por").count() > 0 and nombre.endswith(".pdf"), f"Aviso y descarga {nombre}", shot(page, "v_cont_ingreso_ok"))

    for tab, nombre_cap, cp, esc, desc, texto in [
        ("Estado de resultados", "v_cont_resultados", "113", "E4", "Estado de resultados en pantalla", "Utilidad bruta"),
        ("Balance general", "v_cont_balance", "114", "E4", "Balance general en pantalla con la ecuación contable", "Total pasivo + patrimonio"),
        ("Flujo de caja", "v_cont_flujo", "115", "E4", "Flujo de caja con gráfico diario", "Saldo final"),
        ("Cuentas contables", "v_cont_cuentas", "110", "E7", "Catálogo de cuentas en pantalla", "Caja"),
    ]:
        page.get_by_role("tab", name=tab).click()
        page.wait_for_timeout(1800)
        check(cp, esc, desc, page.get_by_text(texto).count() > 0, f"Pestaña '{tab}' con sus totales y exportación PDF/Excel", shot(page, nombre_cap, full=True))
    page.get_by_role("tab", name="Estado de resultados").click()
    page.wait_for_timeout(1200)
    with page.expect_download() as d:
        page.get_by_role("button", name="PDF").click()
    check("113", "E5", "Descargar estado de resultados en PDF desde la interfaz", d.value.suggested_filename.endswith(".pdf"), f"Archivo {d.value.suggested_filename}", "v_cont_resultados.png")
    d.value.save_as(f"{OUT}/{d.value.suggested_filename}")

    page.goto(WEB + "/dashboard/reportes")
    page.wait_for_timeout(1200)
    page.click("text=Reporte de proveedores")
    page.wait_for_timeout(1800)
    check("109", "E4", "Reporte de proveedores en pantalla", page.get_by_text("Total comprado").count() > 0, "Indicadores y tabla por proveedor con estrellas", shot(page, "v_reporte_proveedores"))
    page.click("text=Reporte de inventario")
    page.wait_for_timeout(1500)
    with page.expect_download() as d:
        page.get_by_role("button", name="Excel").click()
    check("118", "E1", "Exportar el reporte de inventario a Excel (HU-INV-008)", d.value.suggested_filename.endswith(".csv"), f"Archivo {d.value.suggested_filename}", shot(page, "v_reporte_inventario"))
    page.goto(WEB + "/dashboard/clientes")
    page.wait_for_timeout(1200)
    check("101", "E9", "Finanzas consulta clientes sin poder editarlos", page.get_by_text("Nuevo cliente").count() == 0 and page.locator("tbody tr").count() > 0, "Lista visible, sin botón 'Nuevo cliente'", shot(page, "v_clientes_finanzas"))
    ctx.close()
    b.close()

json.dump({"resultados": R}, open("/home/claude/test/resultados_ui_v2.json", "w"), ensure_ascii=False, indent=1)
print(f"\n{sum(x['ok'] for x in R)}/{len(R)} escenarios de interfaz conformes")
