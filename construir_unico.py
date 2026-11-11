#!/usr/bin/env python3
"""Genera Protect_Motos_TODO_EN_UNO.gs = Codigo_cobros.gs + Protect_Motos_Cobros.html.
Uso: python3 construir_unico.py   (volver a correrlo cada vez que edites alguno de los dos originales)"""
import json, pathlib
aqui = pathlib.Path(__file__).parent
gs = (aqui / 'Codigo_cobros.gs').read_text(encoding='utf-8')
html = (aqui / 'Protect_Motos_Cobros.html').read_text(encoding='utf-8')

# El panel usa la URL del propio conector (se inyecta al servirlo) y oculta la barra de URL.
html = html.replace("localStorage.getItem(CLAVE_URL) || URL_CONECTOR_FIJA",
                    "(window.PM_URL_FIJA || localStorage.getItem(CLAVE_URL) || '')", 1)
html = html.replace('<div class="barra-conector">',
                    '<div class="barra-conector"><script>window.PM_URL_FIJA="__URL_CONECTOR__";</script>', 1)
html = html.replace('</style>', '  .barra-conector input,#btnGuardarUrl{display:none}\n</style>', 1)
assert '__URL_CONECTOR__' in html and 'PM_URL_FIJA ||' in html

assert 'function doGet(e) {' in gs
gs = gs.replace('function doGet(e) {', 'function doGetApi(e) {', 1)

extra = '''

// ==================== PANEL INCLUIDO (generado automáticamente) ====================
// Al abrir la URL /exec sin parámetros se muestra el panel; con token/action responde como API.
function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  if (p.token || p.action || p.callback) return doGetApi(e);
  var url = ScriptApp.getService().getUrl();
  return HtmlService.createHtmlOutput(PANEL_HTML.replace('__URL_CONECTOR__', url))
    .setTitle('Protect Motos - Cobros')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

var PANEL_HTML = ''' + json.dumps(html, ensure_ascii=False) + ';\n'
(aqui / 'Protect_Motos_TODO_EN_UNO.gs').write_text(gs + extra, encoding='utf-8')
print('Listo: Protect_Motos_TODO_EN_UNO.gs')
