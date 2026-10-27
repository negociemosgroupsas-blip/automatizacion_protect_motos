/**
 * PROTECT MOTOS — Conector de SOAT
 *
 * Proyecto de Apps Script NUEVO e independiente (no toca Cobros, Conciliación, Contratos ni el CRM).
 * Lee la hoja "Soat" del mismo Google Sheet y guarda las gestiones de renovación en una hoja propia
 * llamada "Gestiones_Soat" (la crea sola la primera vez). No modifica la hoja "Soat".
 *
 * Publicar como Aplicación web:  Ejecutar como: Yo  ·  Quién tiene acceso: Cualquier usuario.
 */

// ==================== CONFIGURACIÓN ====================
var TOKEN = 'PM-SOAT-2026';   // si lo cambias, cámbialo igual en el módulo SOAT del CRM
var SHEET_ID = '1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04';
var HOJA_SOAT = 'Soat';
var HOJA_GESTIONES = 'Gestiones_Soat';
var FILA_ENCABEZADOS = 1;     // fila donde están los títulos de la hoja Soat

// Columnas por defecto (A..N) por si los títulos cambian. Se buscan primero por el nombre del título.
var COLS = [
  { clave: 'fecha',       pos: 1,  nombres: ['fecha', 'fecha venta', 'fecha de venta'] },
  { clave: 'num',         pos: 2,  nombres: ['#', 'n', 'no', 'numero'] },
  { clave: 'cliente',     pos: 3,  nombres: ['cliente', 'nombre', 'nombre del cliente'] },
  { clave: 'cedula',      pos: 4,  nombres: ['cedula', 'documento', 'cc'] },
  { clave: 'placa',       pos: 5,  nombres: ['placa'] },
  { clave: 'tipo',        pos: 6,  nombres: ['tipo vehiculo', 'tipo de vehiculo', 'tipo'] },
  { clave: 'cilindraje',  pos: 7,  nombres: ['cilindraje'] },
  { clave: 'inicio',      pos: 8,  nombres: ['fecha inicio', 'fecha inicial', 'inicio'] },
  { clave: 'vence',       pos: 9,  nombres: ['fecha vencimiento', 'fecha venc', 'vencimiento', 'fecha vence', 'vence'] },
  { clave: 'valor',       pos: 10, nombres: ['valor soat', 'valor'] },
  { clave: 'ganancia',    pos: 11, nombres: ['ganancia'] },
  { clave: 'total',       pos: 12, nombres: ['total consignado', 'total a consignar', 'total'] },
  { clave: 'forma',       pos: 13, nombres: ['forma de pago', 'forma pago', 'pago'] },
  { clave: 'celular',     pos: 14, nombres: ['celular', 'telefono', 'cel', 'whatsapp'] }
];

var ENCABEZADOS_GESTIONES = ['Fecha de gestión', 'Clave SOAT', 'Cédula', 'Cliente', 'Placa', 'Acción', 'Registrado por'];

// ==================== PUNTO DE ENTRADA ====================
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var salida;
  try {
    if (params.token !== TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else {
      var accion = params.action || 'datos';
      if (accion === 'datos') salida = accionDatos();
      else if (accion === 'registrarGestion') salida = accionRegistrarGestion(params);
      else if (accion === 'ping') salida = { ok: true, mensaje: 'Conector de SOAT activo', version: 'soat-1' };
      else salida = { ok: false, error: 'Acción no disponible: ' + accion };
    }
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }
  return responder(salida, params.callback);
}

function responder(objeto, callback) {
  var json = JSON.stringify(objeto);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ==================== DATOS ====================
function accionDatos() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var hoja = buscarHoja(ss, HOJA_SOAT);
  if (!hoja) throw new Error('No se encontró la pestaña "' + HOJA_SOAT + '". Revisa que se llame exactamente así.');
  return { ok: true, soat: leerSoat(hoja), gestiones: leerGestiones(ss.getSheetByName(HOJA_GESTIONES)) };
}

function leerSoat(hoja) {
  var ultimaFila = hoja.getLastRow(), ultimaCol = hoja.getLastColumn();
  if (ultimaFila <= FILA_ENCABEZADOS || ultimaCol < 1) return [];
  var encabezados = hoja.getRange(FILA_ENCABEZADOS, 1, 1, ultimaCol).getDisplayValues()[0];
  var idx = {};
  COLS.forEach(function (c) { idx[c.clave] = posicionColumna(encabezados, c); });
  var datos = hoja.getRange(FILA_ENCABEZADOS + 1, 1, ultimaFila - FILA_ENCABEZADOS, ultimaCol).getValues();
  var out = [];
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    var get = function (k) { return idx[k] >= 0 ? f[idx[k]] : ''; };
    var placa = limpiarPlaca(get('placa')), cliente = texto(get('cliente'));
    if (!placa && !cliente) continue;
    var vence = aFecha(get('vence')), inicio = aFecha(get('inicio'));
    out.push({
      fila: FILA_ENCABEZADOS + 1 + i,
      fecha: fmt(aFecha(get('fecha'))), fechaISO: iso(aFecha(get('fecha'))),
      num: texto(get('num')),
      cliente: cliente, cedula: texto(get('cedula')), placa: placa,
      tipo: texto(get('tipo')).toUpperCase(), cilindraje: texto(get('cilindraje')),
      inicio: fmt(inicio), inicioISO: iso(inicio),
      vence: fmt(vence), venceISO: iso(vence),
      valor: numero(get('valor')), ganancia: numero(get('ganancia')), total: numero(get('total')),
      forma: texto(get('forma')), celular: texto(get('celular'))
    });
  }
  return out;
}

function leerGestiones(hoja) {
  if (!hoja) return [];
  var n = hoja.getLastRow();
  if (n < 2) return [];
  var d = hoja.getRange(2, 1, n - 1, 7).getValues(), out = [];
  for (var i = 0; i < d.length; i++) {
    var clave = texto(d[i][1]);
    if (!clave) continue;
    out.push({ fecha: fmt(aFecha(d[i][0])), fechaISO: iso(aFecha(d[i][0])), clave: clave, cedula: texto(d[i][2]),
      cliente: texto(d[i][3]), placa: texto(d[i][4]), accion: texto(d[i][5]), registradoPor: texto(d[i][6]) });
  }
  return out;
}

// ==================== REGISTRAR GESTIÓN ====================
// Guarda en "Gestiones_Soat" que se le escribió al cliente, que renovó o que no renovará.
function accionRegistrarGestion(p) {
  var clave = texto(p.clave);
  if (!clave) return { ok: false, error: 'Falta la clave del SOAT.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var hoja = ss.getSheetByName(HOJA_GESTIONES);
    if (!hoja) {
      hoja = ss.insertSheet(HOJA_GESTIONES);
      hoja.appendRow(ENCABEZADOS_GESTIONES);
      hoja.getRange(1, 1, 1, ENCABEZADOS_GESTIONES.length).setFontWeight('bold');
    }
    hoja.appendRow([new Date(), clave, texto(p.cedula), texto(p.cliente), texto(p.placa), texto(p.accion) || 'Mensaje de renovación enviado', texto(p.registradoPor)]);
    return { ok: true, mensaje: 'Gestión registrada.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo registrar: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

// ==================== UTILIDADES ====================
function buscarHoja(ss, nombre) {
  var exacta = ss.getSheetByName(nombre);
  if (exacta) return exacta;
  var clave = function (t) { return String(t).toLowerCase().replace(/[^a-z0-9]/g, ''); };
  var hojas = ss.getSheets();
  for (var i = 0; i < hojas.length; i++) if (clave(hojas[i].getName()) === clave(nombre)) return hojas[i];
  return null;
}

function normalizar(t) {
  return String(t === null || t === undefined ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9#]+/g, ' ').trim();
}

function posicionColumna(encabezados, col) {
  var norm = encabezados.map(normalizar);
  for (var n = 0; n < col.nombres.length; n++) {
    var buscado = normalizar(col.nombres[n]);
    for (var i = 0; i < norm.length; i++) if (norm[i] === buscado) return i;
  }
  for (var n2 = 0; n2 < col.nombres.length; n2++) {
    var b = normalizar(col.nombres[n2]);
    if (b.length < 4) continue;
    for (var j = 0; j < norm.length; j++) if (norm[j].indexOf(b) === 0) return j;
  }
  return col.pos - 1;
}

function texto(v) { return String(v === null || v === undefined ? '' : v).trim(); }
function limpiarPlaca(v) { return texto(v).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function numero(v) {
  if (typeof v === 'number') return v;
  var t = texto(v).replace(/[^0-9,.-]/g, '');
  if (!t) return 0;
  if (t.indexOf(',') > -1 && t.indexOf('.') > -1) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  else t = t.replace(',', '.');
  var n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}

// Acepta fechas de Google Sheets o textos dd/mm/aaaa (formato Colombia)
function aFecha(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v;
  var t = texto(v), m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    var a = +m[3]; if (a < 100) a += 2000;
    var d = new Date(a, +m[2] - 1, +m[1]);
    return isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
function fmt(d) { return d ? d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() : ''; }
function iso(d) { return d ? d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) : ''; }
