/**
 * PROTECT MOTOS · Conector (v8 — anti-duplicados + base de Fasecolda)
 * ------------------------------------------------------------------
 * Archivo: "Seguimiento Protec Motos 2026 ACTUAL"
 * Pestaña principal de clientes: "Protect"  (títulos fila 2, datos desde fila 3)
 *
 * v7:  no duplica contratos (busca por N° de contrato) + LockService.
 * v8:  base de datos propia de códigos Fasecolda, en la pestaña "Codigos Fasecolda".
 *      - action=fase_list  -> devuelve todos los códigos guardados.
 *      - action=fase_save  -> guarda / actualiza un código (marca, línea, cilindraje, modelo, tipo).
 *      (Lo demás queda EXACTAMENTE igual; no se tocan los guardados de contratos, RC ni AP.)
 *
 * Corre  diagnostico()  una vez para verificar.
 */

var TOKEN     = 'PM-9K3ZQ-2026';
var SHEET_ID  = '1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04';   // "Seguimiento Protec Motos 2026 ACTUAL"
var NOMBRE_PESTANA = 'Protect';
var GID       = null;
var SHEET2_ID = '1x8yZENs-5gGhT64CPStTuBa_YHQtCM89W5o7t0hSNB8';  // Responsabilidad Civil
var SHEET3_ID = '1RopIZryAegrNvSdLQK5KdLjDA_sqvme4SMG11g8b4ck';  // Accidentes Personales
var HOJA_FASECOLDA = 'Codigos Fasecolda';                        // base de datos propia de Fasecolda

function doGet(e) {
  var cb = (e && e.parameter) ? e.parameter.callback : null;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);                                  // seguro anti-encimado
    var accion = (e && e.parameter) ? (e.parameter.action || '') : '';

    // ===== BASE DE FASECOLDA =====
    if (accion === 'fase_list') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });
      return out_(cb, { ok:true, rows: faseList_() });
    }
    if (accion === 'fase_save') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });
      return out_(cb, faseSave_(e.parameter));
    }

    // ===== GUARDAR CONTRATO (igual que v7) =====
    if (accion === 'save') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });

      var sh  = getSheet_();
      var row = JSON.parse(e.parameter.row);
      var contrato = String(row[13] || '').trim();         // col N (#CONTRATO) = índice 13

      // --- ANTI-DUPLICADO: si el contrato ya está, no lo vuelve a pegar ---
      var yaFila = contrato ? buscarContrato_(sh, contrato) : 0;
      if (yaFila > 0) {
        return out_(cb, { ok:true, fila:yaFila, duplicado:true });
      }

      // 1) Protect (siempre)
      var fila = lastRowByCol_(sh, 14) + 1;
      sh.getRange(fila, 1, 1, row.length).setValues([row]);
      var res = { ok:true, fila:fila };

      // 2) Responsabilidad Civil (solo CON RC)
      if (e.parameter.rc === 'SI' && e.parameter.rcRow) {
        try {
          var rc  = JSON.parse(e.parameter.rcRow);
          var sh2 = SpreadsheetApp.openById(SHEET2_ID).getSheets()[0];
          var f2  = lastRowByCol_(sh2, 5) + 1;             // col E = Nombre completo
          sh2.getRange(f2, 1, 1, rc.length).setValues([rc]);
          res.fila2 = f2;
        } catch (e2) { res.rcError = String(e2); }
      }

      // 3) Accidentes Personales (solo si lleva AP)
      if (e.parameter.ap === 'SI' && e.parameter.apRow) {
        try {
          var ap  = JSON.parse(e.parameter.apRow);
          var sh3 = SpreadsheetApp.openById(SHEET3_ID).getSheets()[0];
          var f3  = lastRowByCol_(sh3, 10) + 1;            // col J = N° Documento
          sh3.getRange(f3, 1, 1, ap.length).setValues([ap]);
          res.fila3 = f3;
        } catch (e3) { res.apError = String(e3); }
      }

      SpreadsheetApp.flush();
      return out_(cb, res);
    }

    return ContentService.createTextOutput('Conector Protect Motos activo ✔');
  } catch (err) {
    return out_(cb, { ok:false, error:String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function out_(cb, obj) {
  var j = JSON.stringify(obj);
  if (cb) return ContentService.createTextOutput(cb + '(' + j + ')')
                                .setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(j).setMimeType(ContentService.MimeType.JSON);
}

/* ============ BASE DE FASECOLDA ============ */
/* Pestaña "Codigos Fasecolda": fila 1 = encabezados; datos desde fila 2.
   Columnas: A Fasecolda · B Marca · C Línea · D Cilindraje · E Modelo · F Tipo */
function hojaFase_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(HOJA_FASECOLDA);
  if (!sh) {
    sh = ss.insertSheet(HOJA_FASECOLDA);
    sh.appendRow(['Fasecolda', 'Marca', 'Línea', 'Cilindraje', 'Modelo', 'Tipo']);
    sh.getRange(1, 1, 1, 6).setFontWeight('bold');
  }
  return sh;
}

function faseList_() {
  var sh = hojaFase_(); var last = sh.getLastRow(); if (last < 2) return [];
  var v = sh.getRange(2, 1, last - 1, 6).getValues(); var out = [];
  for (var r = 0; r < v.length; r++) {
    var f = String(v[r][0] || '').replace(/[^0-9]/g, '');
    if (!f) continue;
    out.push({
      fase: f,
      marca: String(v[r][1] || ''),
      linea: String(v[r][2] || ''),
      cil:   String(v[r][3] || ''),
      modelo:String(v[r][4] || ''),
      tipo:  String(v[r][5] || '')
    });
  }
  return out;
}

function faseBuscar_(sh, fase) {
  var last = sh.getLastRow(); if (last < 2) return 0;
  var v = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var r = 0; r < v.length; r++) {
    if (String(v[r][0] || '').replace(/[^0-9]/g, '') === fase) return r + 2;
  }
  return 0;
}

function faseSave_(p) {
  var fase = String(p.fase || '').replace(/[^0-9]/g, '');
  if (!fase) return { ok:false, error:'SIN_FASECOLDA' };
  var sh = hojaFase_();
  var row = [fase, p.marca || '', p.linea || '', p.cil || '', p.modelo || '', p.tipo || ''];
  var f = faseBuscar_(sh, fase);
  if (f > 0) { sh.getRange(f, 1, 1, 6).setValues([row]); SpreadsheetApp.flush(); return { ok:true, fila:f, actualizado:true }; }
  sh.appendRow(row); SpreadsheetApp.flush();
  return { ok:true, fila:sh.getLastRow(), nuevo:true };
}

/* ============ CONTRATOS (igual que v7) ============ */
/* Busca un N° de contrato en la columna N. Devuelve la fila si existe, o 0. */
function buscarContrato_(sh, contrato) {
  var last = sh.getLastRow(); if (last < 1) return 0;
  var vals = sh.getRange(1, 14, last, 1).getValues();      // col N = #CONTRATO
  for (var r = vals.length - 1; r >= 1; r--) if (String(vals[r][0]).trim() === contrato) return r + 1;
  return 0;
}

function getSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var byName = ss.getSheetByName(NOMBRE_PESTANA);
  if (byName) return byName;
  var sheets = ss.getSheets();
  if (GID) for (var i = 0; i < sheets.length; i++) if (sheets[i].getSheetId() === GID) return sheets[i];
  for (var j = 0; j < sheets.length; j++) {
    var n = sheets[j].getName().toLowerCase();
    if (n.indexOf('protect') >= 0 || n.indexOf('seguim') >= 0) return sheets[j];
  }
  return sheets[0];
}

function lastRowByCol_(sh, col) {
  var vals = sh.getRange(1, col, sh.getMaxRows(), 1).getValues();
  for (var r = vals.length - 1; r >= 1; r--) if (String(vals[r][0]).trim() !== '') return r + 1;
  return 1;
}

function diagnostico() {
  var log = [];
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    log.push('Archivo: "' + ss.getName() + '"');
    ss.getSheets().forEach(function(s){ log.push('   - "' + s.getName() + '"  GID=' + s.getSheetId() + '  última fila: ' + s.getLastRow()); });
    var sh = getSheet_();
    log.push('>> Escribirá en: "' + sh.getName() + '"  |  próxima fila (col N): ' + (lastRowByCol_(sh, 14) + 1));
  } catch (e) { log.push('ERROR principal: ' + e); }
  try { SpreadsheetApp.openById(SHEET2_ID).getSheets()[0]; log.push('RC: OK'); } catch (e) { log.push('RC ERROR: ' + e); }
  try { SpreadsheetApp.openById(SHEET3_ID).getSheets()[0]; log.push('AP: OK'); } catch (e) { log.push('AP ERROR: ' + e); }
  try { var shf = hojaFase_(); log.push('Fasecolda: OK ("' + shf.getName() + '", ' + Math.max(0, shf.getLastRow()-1) + ' códigos)'); } catch (e) { log.push('Fasecolda ERROR: ' + e); }
  Logger.log(log.join('\n'));
}
