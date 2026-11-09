/**
 * PROTECT MOTOS — Conector de Clientes OMS (igual que el de Cobros, pero para el Google Sheet «Historico polizas»)
 *
 * CÓMO CREARLO (una sola vez):
 *   1) Abre el Google Sheet de clientes OMS ("Historico polizas").
 *   2) Menú Extensiones > Apps Script. Borra lo que haya y pega TODO este archivo. Guarda.
 *      (Si el Sheet se llama distinto a «Historico polizas», cambia SHEET_NOMBRE o pega su ID en SHEET_ID.)
 *   3) Implementar > Nueva implementación > Aplicación web.  Ejecutar como: Yo.  Quién tiene acceso: Cualquier usuario.
 *   4) Copia la URL que termina en /exec y pégala en el botón «Clientes OMS» del CRM.
 *
 * Pagos y comprobantes: se guardan en la pestaña «Pagos_OMS» (se crea sola) y las imágenes en la carpeta «Comprobantes de pago OMS» de su Drive.
 *
 * Lee la hoja de clientes (columnas: Nombre completo, Cedula, Vehiculo, Valor a pagar, Celular, Compra, Fecha inicio,
 * Fecha fin, Estado). NO cobra: sirve para avisar la renovación al año. Guarda los avisos (mensaje enviado, renovó,
 * no renovará) en la pestaña «Gestiones_OMS» (se crea sola). No toca ninguna otra hoja.
 */

// ==================== CONFIGURACIÓN ====================
var TOKEN = 'PM-OMS-2026';
var SHEET_ID = '';                 // ID del Google Sheet (lo que está en su URL entre /d/ y /edit). Si lo dejas vacío, se busca por nombre (SHEET_NOMBRE).
var SHEET_NOMBRE = 'Historico polizas'; // nombre exacto del Google Sheet de clientes OMS
var HOJA_CLIENTES = 'Clientes OMS'; // nombre de la pestaña de clientes; si no existe se usa la que tenga las columnas Cedula y Fecha fin (o la primera)
var HOJA_GESTIONES = 'Gestiones_OMS';
var FILA_ENCABEZADOS = 1;          // fila donde están los títulos
var PLAZO_POR_DEFECTO = 12;        // cuotas de un cliente FINANCIADO si la hoja no trae plazo (se calcula con Fecha inicio y Fecha fin)

// Columnas: se buscan por el NOMBRE del título (sin importar mayúsculas ni tildes). pos = columna por defecto (A=1).
var COLS = [
  { clave: 'cliente',  pos: 1, nombres: ['nombre completo', 'nombre', 'cliente'] },
  { clave: 'cedula',   pos: 2, nombres: ['cedula', 'documento', 'cc'] },
  { clave: 'vehiculo', pos: 3, nombres: ['vehiculo', 'moto', 'placa'] },
  { clave: 'valor',    pos: 4, nombres: ['valor a pagar', 'valor cuota', 'valor'] },
  { clave: 'celular',  pos: 5, nombres: ['celular', 'telefono', 'whatsapp'] },
  { clave: 'forma',    pos: 6, nombres: ['compra', 'forma de pago', 'forma'] },
  { clave: 'inicio',   pos: 7, nombres: ['fecha inicio', 'fecha inicial', 'inicio'] },
  { clave: 'fin',      pos: 8, nombres: ['fecha fin', 'fecha final', 'fecha vencimiento', 'vencimiento', 'fin'] },
  { clave: 'estado',   pos: 9, nombres: ['estado', 'estado del cliente'] }
];
// Columnas opcionales (si algún día las agregas, se leen solas): no hay posición por defecto.
var COLS_OPC = [
  { clave: 'contrato', nombres: ['contrato', 'n contrato', 'numero de contrato'] },
  { clave: 'plazo',    nombres: ['plazo', 'cuotas', 'numero de cuotas'] },
  { clave: 'correo',   nombres: ['correo', 'email', 'correo electronico'] },
  { clave: 'asesor',   nombres: ['asesor'] },
  { clave: 'marca',    nombres: ['marca', 'marca de la moto'] },
  { clave: 'aseguradora', nombres: ['aseguradora', 'compania de seguros', 'compania aseguradora', 'seguro'] },
  { clave: 'direccion',nombres: ['direccion'] }
];

var ENCABEZADOS_GESTIONES = ['Fecha de gestión', 'Referencia', 'Cédula', 'Cliente', 'Acción', 'Registrado por'];
var HOJA_PAGOS = 'Pagos_OMS';
var ENCABEZADOS_PAGOS = ['Fecha de pago', 'Referencia', 'Cédula', 'Cliente', 'Concepto', 'Valor pagado', 'Nota', 'Registrado por', 'Comprobante', 'Carpeta'];
var CARPETA_COMPROBANTES = 'Comprobantes de pago OMS';   // solo se usa si no se puede encontrar la carpeta donde está la hoja
// Los comprobantes se guardan en la MISMA carpeta donde está la hoja «Historico polizas» (por ejemplo ...\11.Polizas OMS sura\SURA),
// dentro de una subcarpeta con la cédula del cliente (se usa la que ya exista; si no, se crea).
// Si quiere otra carpeta, pegue aquí su ID (lo que va después de /folders/ en la URL de la carpeta). Déjelo vacío para usar la de la hoja.
var CARPETA_DESTINO_ID = '';

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
      else if (accion === 'estado') salida = accionCambiarEstado(params);
      else if (accion === 'registrarGestion') salida = accionRegistrarGestion(params);
      else if (accion === 'agregar') salida = accionAgregar(params);
      else if (accion === 'registrarPago') salida = accionRegistrarPago(params);
      else if (accion === 'ping') salida = { ok: true, mensaje: 'Conector de Clientes OMS activo', version: 'oms-7' };
      else salida = { ok: false, error: 'Acción desconocida: ' + accion };
    }
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }
  return responder(salida, params.callback);
}

// Solo para subir la imagen del comprobante (no cabe en una URL de GET).
function doPost(e) {
  var salida;
  try {
    var body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    if (body.token !== TOKEN) salida = { ok: false, error: 'Token inválido.' };
    else if (body.action === 'subirComprobante') salida = accionSubirComprobante(body);
    else salida = { ok: false, error: 'Acción desconocida: ' + body.action };
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }
  return responder(salida, null);
}

function responder(objeto, callback) {
  var json = JSON.stringify(objeto);
  if (callback) return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ==================== DATOS ====================
// Abre el Google Sheet de clientes OMS. Una aplicación web NO puede usar "la hoja activa", así que se busca de este orden:
//   1) por el ID de SHEET_ID (lo más seguro);  2) por el nombre SHEET_NOMBRE en tu Drive (el más reciente).
function abrirSS() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (ss) return ss;
  var archivos = DriveApp.getFilesByName(SHEET_NOMBRE), mejor = null;
  while (archivos.hasNext()) {
    var f = archivos.next();
    if (f.getMimeType() !== MimeType.GOOGLE_SHEETS) continue;
    if (!mejor || f.getLastUpdated() > mejor.getLastUpdated()) mejor = f;
  }
  if (!mejor) throw new Error('No encontré el Google Sheet "' + SHEET_NOMBRE + '". Pega su ID en SHEET_ID (está en la URL del Sheet, entre /d/ y /edit).');
  return SpreadsheetApp.openById(mejor.getId());
}

function accionDatos() {
  var ss = abrirSS();
  var hoja = hojaClientes(ss);
  return { ok: true, contratos: leerClientes(hoja).lista, pagos: leerPagos(ss.getSheetByName(HOJA_PAGOS)), gestiones: leerGestiones(ss.getSheetByName(HOJA_GESTIONES)) };
}

// Devuelve cada cliente con el mismo formato que usa el módulo de Cobros.
function leerClientes(hoja) {
  var ultimaFila = hoja.getLastRow(), ultimaCol = hoja.getLastColumn();
  if (ultimaFila <= FILA_ENCABEZADOS || ultimaCol < 1) return { lista: [], mapa: {} };
  var enc = hoja.getRange(FILA_ENCABEZADOS, 1, 1, ultimaCol).getDisplayValues()[0];
  var idx = indicesColumnas(enc);
  var datos = hoja.getRange(FILA_ENCABEZADOS + 1, 1, ultimaFila - FILA_ENCABEZADOS, ultimaCol).getValues();
  var lista = [], mapa = {}, usados = {};
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    var g = function (k) { return idx[k] >= 0 ? f[idx[k]] : ''; };
    var cliente = texto(g('cliente')), cedula = texto(g('cedula'));
    if (!cliente && !cedula) continue;
    var inicio = aFecha(g('inicio')), fin = aFecha(g('fin'));
    var forma = normalizarForma(g('forma'));
    var valor = moneda(g('valor'));
    var plazo = Number(numero(g('plazo'))) || 0;
    if (forma === 'FINANCIADO' && !plazo) plazo = plazoPorFechas(inicio, fin);
    // Referencia única del cliente (equivale al "N° de contrato" de Cobros): la columna Contrato si existe; si no, cédula + fecha de inicio
    var ref = texto(g('contrato'));
    if (!ref) ref = (cedula || 'SIN-CEDULA') + '-' + (inicio ? iso(inicio).replace(/-/g, '') : 'F' + (FILA_ENCABEZADOS + 1 + i));
    if (usados[ref]) { usados[ref]++; ref = ref + '-' + usados[ref]; } else { usados[ref] = 1; }
    var reg = {
      asesor: texto(g('asesor')), marca: texto(g('marca')), aseguradora: texto(g('aseguradora')),
      cedula: cedula, cliente: cliente,
      fechaFirma: fmt(inicio), fechaFirmaISO: iso(inicio),
      fin: fmt(fin), finISO: iso(fin),
      placa: texto(g('vehiculo')),
      contrato: ref,
      valorProtect: forma === 'FINANCIADO' ? valor * (plazo || 1) : valor,
      valorCuota: forma === 'FINANCIADO' ? valor : 0,
      plazo: forma === 'FINANCIADO' ? plazo : 0,
      forma: forma,
      celular: texto(g('celular')), correo: texto(g('correo')), direccion: texto(g('direccion')),
      estado: texto(g('estado')).toUpperCase(),
      fila: FILA_ENCABEZADOS + 1 + i
    };
    lista.push(reg); mapa[ref] = reg;
  }
  return { lista: lista, mapa: mapa, idx: idx };
}

function leerGestiones(hoja) {
  if (!hoja) return [];
  var n = hoja.getLastRow();
  if (n < 2) return [];
  var d = hoja.getRange(2, 1, n - 1, 6).getValues(), out = [];
  for (var i = 0; i < d.length; i++) {
    var ref = texto(d[i][1]);
    if (!ref) continue;
    out.push({ fechaGestion: fmt(aFecha(d[i][0])), fechaGestionISO: iso(aFecha(d[i][0])), contrato: ref, cedula: texto(d[i][2]), cliente: texto(d[i][3]),
      accion: texto(d[i][4]), registradoPor: texto(d[i][5]) });
  }
  return out;
}

// ==================== GESTIÓN DE COBRO ====================
function accionRegistrarGestion(p) {
  var ref = texto(p.contrato);
  if (!ref) return { ok: false, error: 'Falta la referencia del cliente.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var ss = abrirSS();
    var hoja = ss.getSheetByName(HOJA_GESTIONES);
    if (!hoja) { hoja = ss.insertSheet(HOJA_GESTIONES); hoja.appendRow(ENCABEZADOS_GESTIONES); hoja.getRange(1, 1, 1, ENCABEZADOS_GESTIONES.length).setFontWeight('bold'); }
    hoja.appendRow([new Date(), ref, texto(p.cedula), texto(p.cliente), texto(p.accion) || 'Cobro realizado', texto(p.registradoPor)]);
    return { ok: true, mensaje: 'Gestión registrada correctamente.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo registrar la gestión: ' + err.message };
  } finally { lock.releaseLock(); }
}


// ==================== AGREGAR UNA FILA NUEVA DESDE EL CRM ====================
// Escribe al final de la hoja, copia el formato de la última fila y, si una columna tiene fórmula en la fila anterior
// (por ejemplo el consecutivo o un total), copia esa fórmula en la fila nueva.
function ultimaFilaConDatos(hoja, col0) {
  var n = hoja.getLastRow();
  if (n <= FILA_ENCABEZADOS) return FILA_ENCABEZADOS;
  var v = hoja.getRange(FILA_ENCABEZADOS + 1, col0 + 1, n - FILA_ENCABEZADOS, 1).getValues();
  for (var i = v.length - 1; i >= 0; i--) if (texto(v[i][0]) !== '') return FILA_ENCABEZADOS + 1 + i;
  return FILA_ENCABEZADOS;
}
function mismaFecha(a, b) { return a && b && iso(a) === iso(b); }
function sumarAnio(d) { return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()); }
function aNumeroSiPuede(v) { var t = texto(v).replace(/[^0-9]/g, ''); return t && t.length <= 15 ? Number(t) : texto(v); }

function accionAgregar(p) {
  var d;
  try { d = JSON.parse(p.fila || '{}'); } catch (e) { return { ok: false, error: 'No se pudieron leer los datos del formulario.' }; }
  var cliente = texto(d.cliente), ced = texto(d.cedula), veh = texto(d.vehiculo), ini = aFecha(d.inicio), valor = numero(d.valor);
  if (!cliente) return { ok: false, error: 'Falta el nombre del cliente.' };
  if (!ced) return { ok: false, error: 'Falta la cédula.' };
  if (!veh) return { ok: false, error: 'Falta el vehículo.' };
  if (!ini) return { ok: false, error: 'Falta la fecha de inicio.' };
  if (!valor) return { ok: false, error: 'Falta el valor a pagar.' };
  var fin = aFecha(d.fin) || sumarAnio(ini), compra = /financ/i.test(texto(d.compra)) ? 'FINANCIADO' : 'Contado', estadoTxt = texto(d.estado) || 'Activo';
  estadoTxt = estadoTxt.charAt(0).toUpperCase() + estadoTxt.slice(1).toLowerCase();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var hoja = hojaClientes(abrirSS());
    var ncol = hoja.getLastColumn(), enc = hoja.getRange(FILA_ENCABEZADOS, 1, 1, ncol).getDisplayValues()[0], idx = indicesColumnas(enc);
    var ult = ultimaFilaConDatos(hoja, idx.cliente);
    if (!d.forzar && ult > FILA_ENCABEZADOS) {
      var datos = hoja.getRange(FILA_ENCABEZADOS + 1, 1, ult - FILA_ENCABEZADOS, ncol).getValues(), kc = String(ced).replace(/\D/g, ''), kv = normalizar(veh);
      for (var i = 0; i < datos.length; i++) {
        if (String(datos[i][idx.cedula]).replace(/\D/g, '') === kc && normalizar(datos[i][idx.vehiculo]) === kv && mismaFecha(aFecha(datos[i][idx.inicio]), ini))
          return { ok: false, duplicado: true, error: 'Ya hay un cliente con esa cédula, ese vehículo y esa fecha de inicio (fila ' + (FILA_ENCABEZADOS + 1 + i) + ').' };
      }
    }
    var nueva = ult + 1;
    if (ult > FILA_ENCABEZADOS) hoja.getRange(ult, 1, 1, ncol).copyTo(hoja.getRange(nueva, 1, 1, ncol), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    var val = { cliente: cliente, cedula: aNumeroSiPuede(ced), vehiculo: veh, valor: valor, celular: aNumeroSiPuede(d.celular), forma: compra, inicio: ini, fin: fin, estado: estadoTxt, asesor: texto(d.asesor), aseguradora: texto(d.aseguradora) };
    var asignada = {}, omitidos = [];
    ['cliente', 'cedula', 'vehiculo', 'valor', 'celular', 'forma', 'inicio', 'fin', 'estado', 'asesor', 'aseguradora'].forEach(function (k) {
      var col = idx[k]; if (col === undefined || col < 0) return;
      var v = val[k]; if (v === undefined || v === '' || v === null) return;
      if (!coincideNombre(enc, [k])) { omitidos.push(k); return; }   // no se escribe en una columna que no se reconoce por su título
      hoja.getRange(nueva, col + 1).setValue(v); asignada[col] = true;
    });
    if (ult > FILA_ENCABEZADOS) for (var j = 0; j < ncol; j++) {
      if (asignada[j]) continue;
      var f = hoja.getRange(ult, j + 1).getFormulaR1C1();
      if (f) hoja.getRange(nueva, j + 1).setFormulaR1C1(f);
    }
    SpreadsheetApp.flush();
    return { ok: true, mensaje: 'Cliente guardado en la hoja (fila ' + nueva + ').', fila: nueva, omitidos: omitidos };
  } catch (err) {
    return { ok: false, error: 'No se pudo guardar: ' + err.message };
  } finally { lock.releaseLock(); }
}

// ==================== ESTADO ====================
function accionCambiarEstado(p) {
  var ref = texto(p.contrato), nuevo = texto(p.nuevoEstado).toUpperCase();
  if (!ref) return { ok: false, error: 'Falta la referencia del cliente.' };
  if (['ACTIVO', 'CANCELADO', 'FINALIZADO'].indexOf(nuevo) === -1) return { ok: false, error: 'Estado inválido: ' + nuevo };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var hoja = hojaClientes(abrirSS()), info = leerClientes(hoja), c = info.mapa[ref];
    if (!c) return { ok: false, error: 'No se encontró el cliente ' + ref };
    escribirEstado(hoja, info.idx, c.fila, nuevo);
    return { ok: true, mensaje: 'Estado actualizado a ' + nuevo + '.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo cambiar el estado: ' + err.message };
  } finally { lock.releaseLock(); }
}

function escribirEstado(hoja, idx, fila, estado) {
  var col = idx.estado >= 0 ? idx.estado + 1 : 9;
  hoja.getRange(fila, col).setValue(estado.charAt(0) + estado.slice(1).toLowerCase());   // Activo / Cancelado / Finalizado, como lo escribes en la hoja
}

// ==================== UTILIDADES ====================
function hojaClientes(ss) {
  var h = ss.getSheetByName(HOJA_CLIENTES);
  if (h) return h;
  var clave = function (t) { return String(t).toLowerCase().replace(/[^a-z0-9]/g, ''); }, hojas = ss.getSheets(), i;
  for (i = 0; i < hojas.length; i++) if (clave(hojas[i].getName()) === clave(HOJA_CLIENTES)) return hojas[i];
  for (i = 0; i < hojas.length; i++) {
    if (hojas[i].getName() === HOJA_GESTIONES || hojas[i].getLastColumn() < 3) continue;
    var enc = hojas[i].getRange(FILA_ENCABEZADOS, 1, 1, hojas[i].getLastColumn()).getDisplayValues()[0].map(normalizar);
    if (enc.indexOf('cedula') >= 0 && (enc.indexOf('fecha fin') >= 0 || enc.indexOf('fecha final') >= 0)) return hojas[i];
  }
  return hojas[0];
}

function normalizar(t) { return String(t === null || t === undefined ? '' : t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }

function coincideNombre(enc, claves) {
  var norm = enc.map(normalizar), todos = COLS.concat(COLS_OPC).filter(function (c) { return claves.indexOf(c.clave) >= 0; })[0];
  if (!todos) return false;
  for (var n = 0; n < todos.nombres.length; n++) { var b = normalizar(todos.nombres[n]); for (var i = 0; i < norm.length; i++) if (norm[i] === b) return true; }
  return false;
}

function indicesColumnas(enc) {
  var norm = enc.map(normalizar), idx = {};
  var buscar = function (c, porDefecto) {
    for (var n = 0; n < c.nombres.length; n++) { var b = normalizar(c.nombres[n]); for (var i = 0; i < norm.length; i++) if (norm[i] === b) return i; }
    for (var n2 = 0; n2 < c.nombres.length; n2++) { var b2 = normalizar(c.nombres[n2]); if (b2.length < 5) continue; for (var j = 0; j < norm.length; j++) if (norm[j].indexOf(b2) === 0) return j; }   // «Aseguradora SOAT», «Asesor comercial»…
    return porDefecto;
  };
  COLS.forEach(function (c) { idx[c.clave] = buscar(c, c.pos - 1); });
  COLS_OPC.forEach(function (c) { idx[c.clave] = buscar(c, -1); });
  return idx;
}

function normalizarForma(v) { var t = normalizar(v); return /financ|credito|cuota/.test(t) ? 'FINANCIADO' : (/contado/.test(t) ? 'CONTADO' : texto(v).toUpperCase()); }
function plazoPorFechas(ini, fin) { if (!ini || !fin) return PLAZO_POR_DEFECTO; var m = (fin.getFullYear() - ini.getFullYear()) * 12 + (fin.getMonth() - ini.getMonth()); return m >= 1 && m <= 60 ? m : PLAZO_POR_DEFECTO; }
// Un valor como 865.765 (con punto de miles que Sheets leyó como decimal) se corrige a 865765
function moneda(v) {
  var n = numero(v);
  if (typeof v === 'number' && n > 0 && n < 5000 && n !== Math.round(n) && Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6) return Math.round(n * 1000);
  return n;
}
function texto(v) { return String(v === null || v === undefined ? '' : v).trim(); }
function numero(v) {
  if (typeof v === 'number') return v;
  var t = texto(v).replace(/[^0-9,.-]/g, '');
  if (!t) return 0;
  if (t.indexOf(',') > -1 && t.indexOf('.') > -1) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t) || /^-?\d{1,3}(,\d{3})+$/.test(t)) t = t.replace(/[.,]/g, '');
  else t = t.replace(',', '.');
  var n = parseFloat(t); return isNaN(n) ? 0 : n;
}
function aFecha(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v;
  var t = texto(v), m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) { var a = +m[3]; if (a < 100) a += 2000; var dd = +m[1], mm = +m[2]; if (mm > 12 && dd <= 12) { var tmp = dd; dd = mm; mm = tmp; } var d = new Date(a, mm - 1, dd); return isNaN(d.getTime()) ? null : d; }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function fmt(d) { return d ? d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() : ''; }
function iso(d) { return d ? d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) : ''; }
function parsearFecha(t) { return aFecha(t) || (function () { var f = new Date(t); return isNaN(f.getTime()) ? null : f; })(); }
function fechaParaNombre(t) { var f = parsearFecha(t); return f ? ('0' + f.getDate()).slice(-2) + '-' + ('0' + (f.getMonth() + 1)).slice(-2) + '-' + f.getFullYear() : ''; }


// ==================== PAGOS Y COMPROBANTES ====================
function leerPagos(hoja) {
  if (!hoja || hoja.getLastRow() < 2) return [];
  var d = hoja.getRange(2, 1, hoja.getLastRow() - 1, 10).getValues(), out = [];
  for (var i = 0; i < d.length; i++) {
    var ref = texto(d[i][1]);
    if (!ref) continue;
    out.push({ fechaPago: fmt(aFecha(d[i][0])), fechaPagoISO: iso(aFecha(d[i][0])), contrato: ref, cedula: texto(d[i][2]), cliente: texto(d[i][3]),
      concepto: texto(d[i][4]), valorPagado: Number(d[i][5]) || 0, nota: texto(d[i][6]), registradoPor: texto(d[i][7]), comprobante: texto(d[i][8]), carpeta: texto(d[i][9]) });
  }
  return out;
}

function accionRegistrarPago(p) {
  var ref = texto(p.contrato), valor = Number(p.valor) || 0;
  if (!ref) return { ok: false, error: 'Falta la referencia del cliente.' };
  if (valor <= 0) return { ok: false, error: 'El valor pagado debe ser mayor a 0.' };
  var fecha = parsearFecha(texto(p.fecha)) || new Date();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var ss = abrirSS(), hoja = ss.getSheetByName(HOJA_PAGOS);
    if (!hoja) { hoja = ss.insertSheet(HOJA_PAGOS); hoja.getRange(1, 1, 1, ENCABEZADOS_PAGOS.length).setValues([ENCABEZADOS_PAGOS]).setFontWeight('bold'); hoja.setFrozenRows(1); }
    if (!texto(hoja.getRange(1, 10).getValue())) hoja.getRange(1, 10).setValue('Carpeta').setFontWeight('bold');
    hoja.appendRow([fecha, ref, texto(p.cedula), texto(p.cliente), texto(p.concepto), valor, texto(p.nota), texto(p.registradoPor), texto(p.comprobante), texto(p.carpeta)]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'No se pudo guardar el pago: ' + err.message };
  } finally { lock.releaseLock(); }
}

function accionSubirComprobante(b) {
  var ref = texto(b.contrato), ced = texto(b.cedula), cliente = texto(b.cliente), concepto = texto(b.concepto);
  var nombreArchivo = texto(b.nombreArchivo) || 'comprobante', tipo = texto(b.tipoMime) || 'image/jpeg';
  if (!ref) return { ok: false, error: 'Falta la referencia del cliente.' };
  if (!b.datosBase64) return { ok: false, error: 'No se recibió ningún archivo.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var ext = (nombreArchivo.match(/\.[a-zA-Z0-9]+$/) || [''])[0];
    var partes = []; if (concepto) partes.push(concepto); var f = fechaParaNombre(texto(b.fecha)); if (f) partes.push(f);
    var nombre = (partes.length ? partes.join(' - ') : 'comprobante') + ext;
    var blob = Utilities.newBlob(Utilities.base64Decode(b.datosBase64), tipo, nombre);
    var carp = carpetaCliente(ced || ref, cliente), archivo = carp.createFile(blob), ruta = '';
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    try { var pad = carp.getParents(); ruta = (pad.hasNext() ? pad.next().getName() + ' / ' : '') + carp.getName() + ' / ' + archivo.getName(); } catch (e2) { ruta = carp.getName() + ' / ' + archivo.getName(); }
    return { ok: true, url: 'https://drive.google.com/file/d/' + archivo.getId() + '/view', carpetaUrl: carp.getUrl(), ruta: ruta };
  } catch (err) {
    return { ok: false, error: 'No se pudo subir el comprobante: ' + err.message };
  } finally { lock.releaseLock(); }
}

function carpetaBase() {
  if (CARPETA_DESTINO_ID) return DriveApp.getFolderById(CARPETA_DESTINO_ID);
  try {
    var padres = DriveApp.getFileById(abrirSS().getId()).getParents();
    if (padres.hasNext()) return padres.next();           // la carpeta donde está la hoja (SURA)
  } catch (e) {}
  var raiz = DriveApp.getFoldersByName(CARPETA_COMPROBANTES);
  return raiz.hasNext() ? raiz.next() : DriveApp.createFolder(CARPETA_COMPROBANTES);
}

function carpetaCliente(clave, nombre) {
  var base = carpetaBase(), nom = String(clave).replace(/[\\\/:*?"<>|]/g, ' ').trim();
  var existentes = base.getFoldersByName(nom);
  if (existentes.hasNext()) return existentes.next();     // la carpeta de la cédula que ya tiene
  return base.createFolder(nom);
}

// Ejecútela UNA vez desde el editor (▶) para aceptar los permisos de Drive y Sheets que necesitan los comprobantes.
function autorizarPermisos() {
  abrirSS();
  DriveApp.getRootFolder();
  LockService.getScriptLock();
  return 'Permisos listos';
}
