/**
 * PROTECT MOTOS — Conector SOAT  (hoja "Historico Soat")
 * Implementar > Nueva implementación > Aplicación web
 *   Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario
 * Pega la URL /exec en el CRM donde va el conector de SOAT.
 *
 * Columnas de la hoja (fila 1):
 * Fecha | # | cliente | cedula | placa | Tipo vehículo | Cilindraje | Fecha inicio |
 * Fecha vencin | Valor SOAT | Ganancia | Total consignado | Forma de pago | Celular
 */

// ==================== CONFIGURACIÓN ====================
// ID del Sheet: es el texto largo de la URL, entre /d/ y /edit. Cópialo y pégalo desde tu navegador.
var SHEET_ID = '1wHUsGVjzOljHgsTsi1Nj1z_EQlLyR3evXwFduVv0viU';
var HOJA_GID = 2060611047;       // número después de "gid=" en la URL de la pestaña
var HOJA_NOMBRE = '';            // opcional: nombre de la pestaña (se usa si el gid no se encuentra)
var FILA_ENCABEZADOS = 1;

// Nombres que el CRM puede mandar para cada columna (sin tildes ni espacios, en minúscula).
var GRUPOS = [
  ['fecha', 'fechaventa', 'fechaventa'],
  ['numero', 'num', 'consecutivo', 'n', 'id'],
  ['cliente', 'nombre', 'nombrecliente'],
  ['cedula', 'documento', 'cc', 'identificacion', 'nit'],
  ['placa'],
  ['tipovehiculo', 'tipo', 'vehiculo', 'clase'],
  ['cilindraje', 'cc2'],
  ['fechainicio', 'inicio', 'iniciosoat', 'desde'],
  ['fechavencin', 'fechavencimiento', 'vencimiento', 'vence', 'fin', 'fechafin', 'hasta'],
  ['valorsoat', 'valor', 'soat', 'preciosoat'],
  ['ganancia', 'utilidad', 'comision'],
  ['totalconsignado', 'totalconsignar', 'total', 'consignar', 'consignado'],
  ['formapago', 'pago', 'metodopago', 'medio'],
  ['celular', 'telefono', 'tel', 'whatsapp', 'movil']
];

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
    } catch (x) { /* venía como formulario: ya está en e.parameter */ }
  }
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

// ==================== HOJA ====================
function obtenerHoja() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var hojas = ss.getSheets();
  for (var i = 0; i < hojas.length; i++) if (hojas[i].getSheetId() === HOJA_GID) return hojas[i];
  if (HOJA_NOMBRE) {
    var h = ss.getSheetByName(HOJA_NOMBRE);
    if (h) return h;
  }
  throw new Error('No encontré la pestaña (gid ' + HOJA_GID + '). Revisa HOJA_GID u HOJA_NOMBRE.');
}

// ==================== AGREGAR ====================
function accionAgregar(params) {
  var hoja = obtenerHoja();
  var encabezados = hoja.getRange(FILA_ENCABEZADOS, 1, 1, hoja.getLastColumn()).getValues()[0];
  var claveCol = encabezados.map(claveGrupo);

  // Datos recibidos, indexados por su "clave de grupo"
  var recibidos = {}, sinColumna = [];
  for (var k in params) {
    if (['action', 'accion', 'op', 'callback', 'token'].indexOf(k) !== -1) continue;
    var c = claveGrupo(k);
    if (claveCol.indexOf(c) === -1) sinColumna.push(k); else recibidos[c] = params[k];
  }

  // Valores por defecto: fecha de hoy, # consecutivo, total = valor + ganancia
  var cFecha = claveGrupo('fecha'), cNum = claveGrupo('numero'), cTotal = claveGrupo('total');
  var cValor = claveGrupo('valorsoat'), cGan = claveGrupo('ganancia');
  if (blanco(recibidos[cFecha])) recibidos[cFecha] = new Date();
  if (blanco(recibidos[cNum])) recibidos[cNum] = siguienteNumero(hoja, claveCol.indexOf(cNum));
  if (blanco(recibidos[cTotal]) && !blanco(recibidos[cValor])) {
    recibidos[cTotal] = aNumero(recibidos[cValor]) + aNumero(recibidos[cGan]);
  }

  var fila = claveCol.map(function (c) {
    return (c && recibidos.hasOwnProperty(c)) ? recibidos[c] : '';
  });
  hoja.appendRow(fila);
  return { ok: true, fila: hoja.getLastRow(), sinColumna: sinColumna };
}

function siguienteNumero(hoja, idx) {
  if (idx < 0) return '';
  var ultima = hoja.getLastRow();
  if (ultima <= FILA_ENCABEZADOS) return 1;
  var valores = hoja.getRange(FILA_ENCABEZADOS + 1, idx + 1, ultima - FILA_ENCABEZADOS, 1).getValues();
  var max = 0;
  valores.forEach(function (f) { var n = Number(f[0]); if (n > max) max = n; });
  return max + 1;
}

// ==================== LISTAR ====================
function accionListar() {
  var valores = obtenerHoja().getDataRange().getDisplayValues();
  var enc = valores[FILA_ENCABEZADOS - 1];
  var filas = [];
  for (var i = FILA_ENCABEZADOS; i < valores.length; i++) {
    var o = {};
    for (var j = 0; j < enc.length; j++) if (enc[j]) o[enc[j]] = valores[i][j];
    filas.push(o);
  }
  return { ok: true, datos: filas };
}

// ==================== UTILIDADES ====================
function normalizar(t) {
  return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Devuelve la clave del grupo al que pertenece un encabezado o un nombre de campo
function claveGrupo(nombre) {
  var n = normalizar(nombre);
  if (!n) return '';
  for (var i = 0; i < GRUPOS.length; i++) {
    if (GRUPOS[i].indexOf(n) !== -1) return GRUPOS[i][0];
  }
  // "Fecha vencin" cortado, "Fecha vencimiento", etc.: coincide por el inicio
  for (var j = 0; j < GRUPOS.length; j++) {
    if (n.length >= 6 && GRUPOS[j][0].indexOf(n) === 0) return GRUPOS[j][0];
    if (n.length >= 6 && n.indexOf(GRUPOS[j][0]) === 0) return GRUPOS[j][0];
  }
  return n;
}
function blanco(v) { return v === undefined || v === null || v === ''; }
function aNumero(v) { var n = Number(String(v || 0).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
