/**
 * PROTECT MOTOS · Conector (v9 — anti-duplicados + Fasecolda + número del precobro)
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
 * v9:  action=poner_numero -> pone el número del PRECOBRO (que solo usted sabe) al frente de cada cliente en la hoja de
 *      Accidentes Personales (columna A) o de Responsabilidad Civil (columna B), buscando por cédula. No borra nada ni
 *      crea filas: solo escribe en celdas vacías (o reemplaza si usted lo confirma).
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

    // ===== NÚMERO DEL PRECOBRO EN LAS HOJAS DE AP / RC =====
    if (accion === 'poner_numero') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });
      return out_(cb, ponerNumero_(e.parameter));
    }

    // ===== GUARDAR CONTRATO (igual que v7) =====
    if (accion === 'save') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });

      var sh  = getSheet_();
      var row = JSON.parse(e.parameter.row);
      var contrato = String(row[13] || '').trim();         // col N (#CONTRATO) = índice 13
      // Un contrato nuevo siempre entra con el estado del cliente ACTIVO (col AR = índice 43), salvo que ya venga otro estado
      while (row.length < 44) row.push('');
      if (!String(row[43] || '').trim()) row[43] = 'ACTIVO';

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

    // ===== RECUPERAR UN CONTRATO YA BORRADO: buscar por cédula o nombre y traer su información de las hojas =====
    if (accion === 'contrato_buscar') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });
      return out_(cb, contratoBuscar_(e.parameter));
    }
    if (accion === 'contrato_traer') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });
      return out_(cb, contratoTraer_(e.parameter));
    }

    // ===== OTRO SÍ: buscar al cliente por N° de contrato y marcar RC / AP en la hoja Protect =====
    if (accion === 'otrosi_buscar') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });
      return out_(cb, otroSiBuscar_(e.parameter));
    }
    if (accion === 'otrosi_aplicar') {
      if (e.parameter.token !== TOKEN) return out_(cb, { ok:false, error:'CLAVE_INCORRECTA' });
      return out_(cb, otroSiAplicar_(e.parameter));
    }

    return ContentService.createTextOutput('Conector Protect Motos activo ✔');
  } catch (err) {
    return out_(cb, { ok:false, error:String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/* ============ NÚMERO DEL PRECOBRO ============ */
// AP (Accidentes Personales): cédula en la columna J, número en la columna A.
// RC (Responsabilidad Civil): cédula en la columna G, número en la columna B.
// Si una cédula está en varias filas, se usa la ÚLTIMA (la más reciente).
function ponerNumero_(p) {
  var tipo = String(p.tipo || '').toUpperCase();
  if (tipo !== 'AP' && tipo !== 'RC') return { ok:false, error:'Tipo no válido: debe ser AP o RC.' };
  var numero = String(p.numero || '').trim();
  if (!numero) return { ok:false, error:'Falta el número.' };
  var ceds; try { ceds = JSON.parse(p.ceds || '[]'); } catch (x) { return { ok:false, error:'La lista de cédulas no es válida.' }; }
  var escribir = p.modo === 'escribir', reemplazar = p.reemplazar === '1', aut = {};
  try { (JSON.parse(p.autorizar || '[]')).forEach(function (c) { aut[String(c).replace(/\D/g, '').replace(/^0+/, '')] = true; }); } catch (xa) {}
  var cfg = tipo === 'AP' ? { id: SHEET3_ID, colCed: 10, colNum: 1, nombre: 'Accidentes Personales', colNom: 4, nNom: 3 } : { id: SHEET2_ID, colCed: 7, colNum: 2, nombre: 'Responsabilidad Civil', colNom: 5, nNom: 1 };
  var sh = SpreadsheetApp.openById(cfg.id).getSheets()[0], last = sh.getLastRow();
  var norm = function (v) { return String(v == null ? '' : v).replace(/\.0+$/, '').replace(/\D/g, '').replace(/^0+/, ''); };
  var out = { ok:true, tipo:tipo, hoja:cfg.nombre, columna: tipo === 'AP' ? 'A' : 'B', escribir:escribir, encontrados:0, escritos:0, yaTenian:0, conflictos:[], noEncontrados:[] };
  if (last < 2) { out.noEncontrados = ceds.slice(); return out; }
  var C = sh.getRange(1, cfg.colCed, last, 1).getValues(), N = sh.getRange(1, cfg.colNum, last, 1).getValues(), NM = sh.getRange(1, cfg.colNom, last, cfg.nNom).getValues(), idx = {}, r;
  for (r = 1; r < last; r++) { var k = norm(C[r][0]); if (k) idx[k] = r + 1; }
  var valor = /^\d{1,15}$/.test(numero) ? Number(numero) : numero, vistos = {};
  ceds.forEach(function (c) {
    var k = norm(c); if (!k || vistos[k]) return; vistos[k] = true;
    var fila = idx[k];
    if (!fila) { out.noEncontrados.push(k); return; }
    out.encontrados++;
    var actual = String(N[fila - 1][0] == null ? '' : N[fila - 1][0]).trim();
    if (actual === '') { if (escribir) { sh.getRange(fila, cfg.colNum).setValue(valor); out.escritos++; } else out.escritos++; }
    else if (actual === numero) out.yaTenian++;
    else {
      out.conflictos.push({ ced:k, fila:fila, actual:actual, nombre: NM[fila - 1].join(' ').replace(/\s+/g, ' ').trim() });
      if (escribir && (reemplazar || aut[k])) { sh.getRange(fila, cfg.colNum).setValue(valor); out.escritos++; out.reemplazados = (out.reemplazados || 0) + 1; }
    }
  });
  if (escribir) SpreadsheetApp.flush();
  return out;
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


/* ============ OTRO SÍ ============ */
// El cliente ya tiene su contrato en la hoja Protect: no se llena nada de nuevo. Solo se busca por el N° de contrato
// (columna N) y, al aplicar, se escribe SI en la columna U (lleva RC) y/o en la columna W (lleva AP).
function otroSiFecha_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  return String(v == null ? '' : v).trim();
}
function otroSiBuscar_(p) {
  var contrato = String(p.contrato || '').trim();
  if (!contrato) return { ok:false, error:'Escribe el número de contrato.' };
  var sh = getSheet_(), fila = buscarContrato_(sh, contrato);
  if (!fila) return { ok:true, encontrado:false, contrato:contrato };
  var r = sh.getRange(fila, 1, 1, Math.max(sh.getLastColumn(), 44)).getValues()[0];
  var t = function (i) { return String(r[i] == null ? '' : r[i]).trim(); };
  return { ok:true, encontrado:true, fila:fila, datos:{
    contrato:contrato, asesor:t(1), tipoDoc:t(3), cedula:t(4), titular:t(7), fechaInicio:otroSiFecha_(r[10]), fechaFin:otroSiFecha_(r[11]),
    placa:t(12), rc:t(20).toUpperCase(), ap:t(22).toUpperCase(), estado:t(43).toUpperCase()
  } };
}
function otroSiAplicar_(p) {
  var contrato = String(p.contrato || '').trim();
  if (!contrato) return { ok:false, error:'Falta el número de contrato.' };
  var rc = p.rc === '1', ap = p.ap === '1';
  if (!rc && !ap) return { ok:false, error:'Elige RC, AP o ambas.' };
  var sh = getSheet_(), fila = buscarContrato_(sh, contrato);
  if (!fila) return { ok:false, error:'No encontré el contrato ' + contrato + ' en la hoja Protect.' };
  var antes = { rc:String(sh.getRange(fila, 21).getValue() || '').trim(), ap:String(sh.getRange(fila, 23).getValue() || '').trim() };
  if (rc) sh.getRange(fila, 21).setValue('SI');     // columna U = Lleva RC
  if (ap) sh.getRange(fila, 23).setValue('SI');     // columna W = Lleva AP
  SpreadsheetApp.flush();
  return { ok:true, fila:fila, antes:antes, rc:rc, ap:ap };
}


/* ============ RECUPERAR CONTRATO ============ */
// El contrato ya no está en pantalla, pero sí en las hojas: Protect (siempre), Responsabilidad Civil y Accidentes Personales.
// Se busca por cédula, nombre, placa o N° de contrato; al elegir uno se devuelve su fila completa para volver a llenar el formulario.
function recNorm_(t) { return String(t == null ? '' : t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function recDig_(t) { return String(t == null ? '' : t).replace(/\.0+$/, '').replace(/\D/g, '').replace(/^0+/, ''); }
function recISO_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime())) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var t = String(v == null ? '' : v).trim(), m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) { var d = +m[1], mo = +m[2]; if (mo > 12 && d <= 12) { var x = d; d = mo; mo = x; } return m[3] + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2); }
  return t;
}
function recFila_(arr) { return arr.map(function (v) { return (Object.prototype.toString.call(v) === '[object Date]') ? recISO_(v) : (v == null ? '' : v); }); }

function contratoBuscar_(p) {
  var q = String(p.q || '').trim();
  if (q.length < 3) return { ok:false, error:'Escribe al menos 3 letras o números.' };
  var sh = getSheet_(), last = sh.getLastRow();
  if (last < 2) return { ok:true, resultados:[] };
  var ncol = Math.max(46, sh.getLastColumn()), datos = sh.getRange(2, 1, last - 1, ncol).getValues();
  var qd = recDig_(q), soloNum = /^[\d\.\s]+$/.test(q), qn = recNorm_(q), palabras = qn.split(' ').filter(Boolean), res = [];
  for (var i = datos.length - 1; i >= 0; i--) {        // las más recientes primero
    var f = datos[i], titular = String(f[7] || '').trim(), contrato = String(f[13] || '').trim();
    if (!titular && !contrato) continue;
    var ok = false;
    if (soloNum && qd.length >= 5) ok = recDig_(f[4]).indexOf(qd) >= 0 || recDig_(f[13]) === qd;
    else {
      var nn = recNorm_(titular), todas = palabras.length > 0;
      palabras.forEach(function (w) { if (nn.indexOf(w) < 0) todas = false; });
      ok = todas || recNorm_(f[12]).replace(/ /g, '') === qn.replace(/ /g, '') || recNorm_(contrato) === qn;
    }
    if (!ok) continue;
    res.push({ fila: i + 2, contrato: contrato, titular: titular, tipoDoc: String(f[3] || ''), cedula: String(f[4] || '').trim(), placa: String(f[12] || '').trim(),
      fecha: recISO_(f[10]), forma: String(f[19] || '').trim(), rc: String(f[20] || '').trim().toUpperCase(), ap: String(f[22] || '').trim().toUpperCase(), estado: String(f[43] || '').trim().toUpperCase() });
    if (res.length >= 25) break;
  }
  return { ok:true, resultados:res };
}

function contratoTraer_(p) {
  var fila = Number(p.fila);
  if (!(fila >= 2)) return { ok:false, error:'Falta la fila del contrato.' };
  var sh = getSheet_(), ncol = Math.max(46, sh.getLastColumn());
  if (fila > sh.getLastRow()) return { ok:false, error:'Esa fila ya no existe en la hoja.' };
  var row = recFila_(sh.getRange(fila, 1, 1, ncol).getValues()[0]), ced = recDig_(row[4]), out = { ok:true, fila:fila, row:row, rc:null, ap:null, avisos:[] };
  function ultimaPorCedula(id, colCed, ancho) {
    var h = SpreadsheetApp.openById(id).getSheets()[0], n = h.getLastRow(); if (n < 2 || !ced) return null;
    var cs = h.getRange(1, colCed, n, 1).getValues();
    for (var r = n - 1; r >= 1; r--) if (recDig_(cs[r][0]) === ced) return recFila_(h.getRange(r + 1, 1, 1, ancho).getValues()[0]);
    return null;
  }
  try { if (String(row[20]).toUpperCase() === 'SI') out.rc = ultimaPorCedula(SHEET2_ID, 7, 27); } catch (e1) { out.avisos.push('No se pudo leer la hoja de RC: ' + e1); }
  try { if (String(row[22]).toUpperCase() === 'SI') out.ap = ultimaPorCedula(SHEET3_ID, 10, 29); } catch (e2) { out.avisos.push('No se pudo leer la hoja de AP: ' + e2); }
  return out;
}
