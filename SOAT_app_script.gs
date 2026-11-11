/**
 * PROTECT MOTOS — Conector SOAT
 * Implementar > Nueva implementación > Aplicación web
 *   Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario
 * Pega la URL /exec en el CRM donde va el conector de SOAT.
 */

// ==================== CONFIGURACIÓN ====================
var SHEET_ID = '1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04'; // Tu Google Sheet (cámbialo si SOAT está en otro archivo)
var HOJA_SOAT = 'SOAT';                                          // Nombre EXACTO de la pestaña de SOAT
var FILA_ENCABEZADOS = 1;

// ==================== ENTRADA ====================
function doGet(e)  { return atender(e); }
function doPost(e) { return atender(e); }

function atender(e) {
  var params = juntarParametros(e);
  var salida;
  try {
    var accion = String(params.action || params.accion || params.op || 'listar').toLowerCase();
    if (accion === 'agregar' || accion === 'add' || accion === 'crear' || accion === 'guardar') {
      salida = accionAgregar(params);
    } else if (accion === 'listar' || accion === 'datos' || accion === 'list') {
      salida = accionListar();
    } else {
      salida = { ok: false, error: 'Acción desconocida: ' + accion };
    }
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }
  return responder(salida, params.callback);
}

function juntarParametros(e) {
  var p = {};
  if (e && e.parameter) for (var k in e.parameter) p[k] = e.parameter[k];
  if (e && e.postData && e.postData.contents) {
    try {
      var cuerpo = JSON.parse(e.postData.contents);
      var datos = cuerpo.datos || cuerpo.data || cuerpo;
      for (var k2 in cuerpo) p[k2] = cuerpo[k2];
      for (var k3 in datos) p[k3] = datos[k3];
    } catch (x) { /* el cuerpo venía como formulario, ya está en e.parameter */ }
  }
  // Si los datos vienen como un solo parámetro JSON (datos / data / fila)
  ['datos', 'data', 'fila', 'registro'].forEach(function (n) {
    if (typeof p[n] === 'string') {
      try { var o = JSON.parse(p[n]); for (var k4 in o) p[k4] = o[k4]; } catch (x) {}
    }
  });
  return p;
}

function responder(objeto, callback) {
  var json = JSON.stringify(objeto);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ==================== AGREGAR ====================
// Cada dato recibido se coloca en la columna cuyo encabezado se llame igual
// (sin importar mayúsculas, tildes, espacios ni guiones: "Fecha de inicio" = fechaInicio).
function accionAgregar(params) {
  var hoja = SpreadsheetApp.openById(SHEET_ID).getSheetByName(HOJA_SOAT);
  if (!hoja) throw new Error('No existe la pestaña "' + HOJA_SOAT + '" en el Sheet.');

  var ultimaCol = hoja.getLastColumn();
  var encabezados = hoja.getRange(FILA_ENCABEZADOS, 1, 1, ultimaCol).getValues()[0];
  var claves = encabezados.map(normalizar);

  var recibidos = {};
  for (var k in params) {
    if (['action', 'accion', 'op', 'callback', 'token'].indexOf(k) === -1) recibidos[normalizar(k)] = params[k];
  }

  var fila = [], usados = {};
  for (var i = 0; i < claves.length; i++) {
    var v = (claves[i] && recibidos.hasOwnProperty(claves[i])) ? recibidos[claves[i]] : '';
    if (claves[i] && recibidos.hasOwnProperty(claves[i])) usados[claves[i]] = true;
    fila.push(v);
  }

  var sinColumna = [];
  for (var r in recibidos) if (!usados[r]) sinColumna.push(r);

  hoja.appendRow(fila);
  return { ok: true, fila: hoja.getLastRow(), sinColumna: sinColumna };
}

// ==================== LISTAR ====================
function accionListar() {
  var hoja = SpreadsheetApp.openById(SHEET_ID).getSheetByName(HOJA_SOAT);
  if (!hoja) throw new Error('No existe la pestaña "' + HOJA_SOAT + '" en el Sheet.');
  var valores = hoja.getDataRange().getDisplayValues();
  var enc = valores[FILA_ENCABEZADOS - 1];
  var filas = [];
  for (var i = FILA_ENCABEZADOS; i < valores.length; i++) {
    var o = {};
    for (var j = 0; j < enc.length; j++) if (enc[j]) o[enc[j]] = valores[i][j];
    filas.push(o);
  }
  return { ok: true, datos: filas };
}

function normalizar(t) {
  return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/del/g, '').replace(/de/g, '');
}
