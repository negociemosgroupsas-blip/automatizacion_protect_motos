#!/usr/bin/env python3
"""Arma conectores/unico/Codigo_UNICO.gs a partir de los 6 conectores existentes (que NO se modifican).
Cada conector queda encerrado en su propio espacio (así no chocan TOKEN, SHEET_ID, COL, doGet...).
Un enrutador envía cada petición al conector que corresponde según su clave (token)."""
import os,re
B=os.path.dirname(os.path.abspath(__file__))+'/..'
def rd(p): return open(B+'/'+p,encoding='utf-8').read()
MODS=[('PM_Cobros','cobros/Codigo_cobros.gs','PM-COBROS-2026',['pruebaDrive']),
      ('PM_CRM','crm/Codigo_crm.gs','PM-CRM-2026',[]),
      ('PM_OMS','oms/Codigo_oms.gs','PM-OMS-2026',['autorizarPermisos']),
      ('PM_SOAT','soat/Codigo_soat.gs','PM-SOAT-2026',[]),
      ('PM_Contratos','contratos/Codigo_conector.gs','PM-9K3ZQ-2026',['diagnostico'])]
out=['''/**
 * PROTECT MOTOS — CONECTOR ÚNICO (un solo Apps Script para todo el sistema)  ·  versión unico-1
 *
 * Reúne, sin cambiarlos, los conectores de Cobros, CRM, Clientes OMS, SOAT, Contratos y Conciliación.
 * Cada uno conserva su clave (token), sus acciones y sus respuestas: el sistema web sigue llamando igual,
 * solo que ahora TODOS los módulos usan la MISMA URL. El enrutador mira la clave y entrega la petición al conector correcto.
 *
 * ARCHIVO GENERADO por conectores/unico/construir.py — no lo edite a mano; si algún conector cambia, vuelva a generarlo.
 * Publicar como Aplicación web:  Ejecutar como: Yo  ·  Quién tiene acceso: Cualquier usuario.
 * Primera vez: ejecute la función AUTORIZAR_TODO una vez para dar los permisos (hojas y Drive).
 */
var UNICO_VERSION = 'unico-1';
''']
for ns,p,tok,extra in MODS:
    src=rd(p)
    exp=['doGet:doGet']+(['doPost:doPost'] if re.search(r'^function doPost\b',src,re.M) else [])+[x+':'+x for x in extra]
    out.append('\n// ========================================================================\n// MÓDULO: %s  (origen: conectores/%s)\n// ========================================================================\nvar %s = (function () {\n%s\n  return { %s };\n})();\n'%(ns,p,ns,src,', '.join(exp)))
# Conciliación: ya usa prefijo CONC_ ; solo se renombra su doGet
c1=rd('conciliacion/PASO_1_pegar_en_Codigo.gs'); c2=rd('conciliacion/PASO_2_pegar_en_Sin_titulo.gs')
assert 'function doGet(e)' in c2 and 'function doGet' not in c1 and 'doPost' not in c1+c2
c2=c2.replace('function doGet(e)','function CONC_doGet(e)')
out.append('\n// ========================================================================\n// MÓDULO: Conciliación (origen: conectores/conciliacion/PASO_1 + PASO_2; ya usa el prefijo CONC_)\n// ========================================================================\n'+c1+'\n'+c2+'\n')
out.append('''
// ========================================================================
// ENRUTADOR
// ========================================================================
var UNICO_RUTAS = {
  'PM-COBROS-2026': 'PM_Cobros',
  'PM-CRM-2026': 'PM_CRM',
  'PM-OMS-2026': 'PM_OMS',
  'PM-SOAT-2026': 'PM_SOAT',
  'PM-9K3ZQ-2026': 'PM_Contratos',
  'PM-CONC-3e97c3a8bb5298ef9d192391': 'CONC'
};

var UNICO_MODS = { PM_Cobros: PM_Cobros, PM_CRM: PM_CRM, PM_OMS: PM_OMS, PM_SOAT: PM_SOAT, PM_Contratos: PM_Contratos };

function UNICO_modulo(token) { return UNICO_RUTAS[String(token || '')] || ''; }

function UNICO_texto(t) { return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT); }

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var m = UNICO_modulo(p.token);
  if (m === 'CONC') return CONC_doGet(e);
  if (m) return UNICO_MODS[m].doGet(e);
  if (p.token) {   // clave que ninguno de los conectores conoce: mismo aviso que daban ellos
    var salida = JSON.stringify({ ok: false, error: 'Token inválido.' });
    return ContentService.createTextOutput(p.callback ? p.callback + '(' + salida + ')' : salida)
      .setMimeType(p.callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }
  // Sin clave: solo confirma que está activo (los textos de abajo los reconocen las pantallas)
  return UNICO_texto('Conector Protect Motos activo ✔ · Conector único ' + UNICO_VERSION +
    ' · Conciliación Dugo activa · versión v12 · módulos: Cobros, CRM, Clientes OMS, SOAT, Contratos, Conciliación');
}

function doPost(e) {
  var body = {};
  try { body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {}; } catch (x) {}
  var m = UNICO_modulo(body.token);
  if (m && m !== 'CONC' && UNICO_MODS[m] && UNICO_MODS[m].doPost) return UNICO_MODS[m].doPost(e);
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: m ? 'Este conector no recibe esa petición.' : 'Token inválido.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- Funciones para ejecutar a mano desde el editor ----
function AUTORIZAR_TODO() {   // ejecútela UNA vez: pide los permisos de Hojas de cálculo y Drive
  SpreadsheetApp.openById('1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04').getName();
  DriveApp.getRootFolder().getName();
  LockService.getScriptLock();
  return 'Permisos listos. Ya puede publicar la aplicación web.';
}
function COBROS_pruebaDrive() { return PM_Cobros.pruebaDrive(); }
function OMS_autorizarPermisos() { return PM_OMS.autorizarPermisos(); }
function CONTRATOS_diagnostico() { return PM_Contratos.diagnostico(); }
''')
open(B+'/unico/Codigo_UNICO.gs','w',encoding='utf-8').write(''.join(out))
print('listo',sum(len(x) for x in out))
