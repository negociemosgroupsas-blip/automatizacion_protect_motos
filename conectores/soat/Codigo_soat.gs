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
var SHEET_ID = '';                 // ID del Google Sheet «Historico Soat» (lo que está en su URL entre /d/ y /edit). Vacío = se busca por nombre en tu Drive.
var SHEET_NOMBRE = 'Historico Soat'; // nombre exacto del Google Sheet de SOAT
var HOJA_SOAT = 'Soat';
var HOJA_GESTIONES = 'Gestiones_Soat';
var FILA_ENCABEZADOS = 1;     // fila donde están los títulos de la hoja Soat

// Columnas por defecto (A..N) por si los títulos cambian. Se buscan primero por el nombre del título.
var COLS = [
  { clave: 'fecha',       pos: 1,  nombres: ['fecha', 'fecha venta', 'fecha de venta'] },
  { clave: 'num',         pos: 2,  nombres: ['#', 'n', 'no', 'numero'] },
  { clave: 'cliente',     pos: 3,  nombres: ['cliente', 'nombre', 'nombre del cliente'] },
  { clave: 'tipoDoc',     pos: 4,  nombres: ['tipo doc', 'tipo documento', 'tipo de documento'] },
  { clave: 'cedula',      pos: 5,  nombres: ['cedula', 'documento', 'cc'] },
  { clave: 'placa',       pos: 6,  nombres: ['placa'] },
  { clave: 'tipo',        pos: 7,  nombres: ['tipo vehiculo', 'tipo de vehiculo'] },
  { clave: 'cilindraje',  pos: 8,  nombres: ['cilindraje'] },
  { clave: 'inicio',      pos: 9,  nombres: ['fecha inicio', 'fecha inicial', 'inicio'] },
  { clave: 'vence',       pos: 10, nombres: ['fecha vencimiento', 'fecha venc', 'vencimiento', 'fecha vence', 'vence'] },
  { clave: 'valor',       pos: 11, nombres: ['valor soat', 'valor'] },
  { clave: 'ganancia',    pos: 12, nombres: ['ganancia'] },
  { clave: 'total',       pos: 13, nombres: ['total consignado', 'total a consignar', 'total'] },
  { clave: 'forma',       pos: 14, nombres: ['forma de pago', 'forma pago', 'pago'] },
  { clave: 'celular',     pos: 15, nombres: ['celular', 'telefono', 'cel', 'whatsapp'] },
  { clave: 'correo',      pos: 16, nombres: ['correo', 'email', 'e mail', 'correo electronico'] },
  { clave: 'direccion',   pos: 17, nombres: ['direccion'] },
  { clave: 'residencia',  pos: 18, nombres: ['lugar de residencia', 'residencia', 'ciudad'] }
];

// Consignaciones de los clientes (comprobantes). La captura se guarda en Drive dentro de «Carpeta de clientes», en la subcarpeta de la cédula.
var HOJA_COMPROBANTES = 'Comprobantes_Soat';
var ENCABEZADOS_COMPROBANTES = ['Fecha de pago', 'Clave SOAT', 'Cédula', 'Cliente', 'Placa', 'Valor consignado', 'Nota', 'Registrado por', 'Comprobante', 'Carpeta'];
var CARPETA_CLIENTES_NOMBRE = 'Carpeta de clientes';   // la que está dentro de «9.Soat-Comprobantes de pago»
var CARPETA_CLIENTES_ID = '';                          // opcional: el ID de esa carpeta (lo que va en su URL después de /folders/). Vacío = se busca sola.

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
      else if (accion === 'agregar') salida = accionAgregar(params);
      else if (accion === 'registrarComprobante') salida = accionRegistrarComprobante(params);
      else if (accion === 'ping') salida = { ok: true, mensaje: 'Conector de SOAT activo', version: 'soat-4' };
      else salida = { ok: false, error: 'Acción no disponible: ' + accion };
    }
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }
  return responder(salida, params.callback);
}

// Para subir la imagen del comprobante (no cabe en una URL de GET).
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
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// Abre el Google Sheet de SOAT: por su ID (SHEET_ID) o, si está vacío, buscándolo por nombre en tu Drive.
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

// ==================== DATOS ====================
function accionDatos() {
  var ss = abrirSS();
  var hoja = buscarHoja(ss, HOJA_SOAT);
  if (!hoja) throw new Error('No se encontró la pestaña "' + HOJA_SOAT + '". Revisa que se llame exactamente así.');
  return { ok: true, soat: leerSoat(hoja), gestiones: leerGestiones(ss.getSheetByName(HOJA_GESTIONES)), comprobantes: leerComprobantes(ss.getSheetByName(HOJA_COMPROBANTES)) };
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
    var venta = aFecha(get('fecha'));
    var inicio = aFechaCerca(get('inicio'), venta);                       // si el texto es ambiguo (05-11 / 11-05) se elige el más cercano a la venta
    var vence = aFechaCerca(get('vence'), inicio ? sumarAnio(inicio) : venta);   // ...y el vencimiento, el más cercano a «inicio + 1 año»
    out.push({
      fila: FILA_ENCABEZADOS + 1 + i,
      fecha: fmt(venta), fechaISO: iso(venta),
      num: texto(get('num')),
      cliente: cliente, cedula: texto(get('cedula')), placa: placa,
      tipo: texto(get('tipo')).toUpperCase(), cilindraje: texto(get('cilindraje')),
      inicio: fmt(inicio), inicioISO: iso(inicio),
      vence: fmt(vence), venceISO: iso(vence),
      valor: numero(get('valor')), ganancia: numero(get('ganancia')), total: numero(get('total')),
      forma: texto(get('forma')), celular: texto(get('celular')),
      tipoDoc: texto(get('tipoDoc')).toUpperCase(), correo: texto(get('correo')), direccion: texto(get('direccion')), residencia: texto(get('residencia'))
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

// ==================== CONSIGNACIONES (COMPROBANTES) ====================
function leerComprobantes(hoja) {
  if (!hoja) return [];
  var n = hoja.getLastRow();
  if (n < 2) return [];
  var d = hoja.getRange(2, 1, n - 1, 10).getValues(), out = [];
  for (var i = 0; i < d.length; i++) {
    if (!texto(d[i][1]) && !texto(d[i][2])) continue;
    out.push({ fecha: fmt(aFecha(d[i][0])), fechaISO: iso(aFecha(d[i][0])), clave: texto(d[i][1]), cedula: texto(d[i][2]), cliente: texto(d[i][3]),
      placa: texto(d[i][4]), valor: numero(d[i][5]), nota: texto(d[i][6]), registradoPor: texto(d[i][7]), comprobante: texto(d[i][8]), carpeta: texto(d[i][9]) });
  }
  return out;
}

// Registra la consignación en la pestaña «Comprobantes_Soat» (se crea sola).
function accionRegistrarComprobante(p) {
  var clave = texto(p.clave), valor = numero(p.valor);
  if (!clave) return { ok: false, error: 'Falta la clave del SOAT.' };
  var fecha = aFecha(p.fecha) || new Date();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var ss = abrirSS(), hoja = ss.getSheetByName(HOJA_COMPROBANTES);
    if (!hoja) { hoja = ss.insertSheet(HOJA_COMPROBANTES); hoja.getRange(1, 1, 1, ENCABEZADOS_COMPROBANTES.length).setValues([ENCABEZADOS_COMPROBANTES]).setFontWeight('bold'); hoja.setFrozenRows(1); }
    hoja.appendRow([fecha, clave, texto(p.cedula), texto(p.cliente), texto(p.placa), valor, texto(p.nota), texto(p.registradoPor), texto(p.comprobante), texto(p.carpeta)]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'No se pudo guardar la consignación: ' + err.message };
  } finally { lock.releaseLock(); }
}

// Guarda la imagen/PDF en Drive: «Carpeta de clientes» / subcarpeta de la cédula (si ya existe, por ejemplo «4175780-177281664», se usa; si no, se crea).
function carpetaBaseClientes_() {
  if (CARPETA_CLIENTES_ID) return DriveApp.getFolderById(CARPETA_CLIENTES_ID);
  var it = DriveApp.getFoldersByName(CARPETA_CLIENTES_NOMBRE), mejor = null, primera = null;
  while (it.hasNext()) {
    var f = it.next(); if (!primera) primera = f;
    try { var pd = f.getParents(); if (pd.hasNext() && /soat/i.test(pd.next().getName())) { mejor = f; break; } } catch (e) {}
  }
  if (mejor || primera) return mejor || primera;
  var padres = null; try { padres = DriveApp.getFileById(abrirSS().getId()).getParents(); } catch (e2) {}
  var base = (padres && padres.hasNext()) ? padres.next() : DriveApp.getRootFolder();
  return base.createFolder(CARPETA_CLIENTES_NOMBRE);
}
function carpetaDelCliente_(cedula, cliente) {
  var base = carpetaBaseClientes_(), ced = String(cedula || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!ced) ced = 'sin-cedula';
  var subs = base.getFolders();
  while (subs.hasNext()) {
    var sf = subs.next(), partes = sf.getName().split(/[^0-9A-Za-z]+/).map(function (x) { return x.replace(/^0+/, ''); });
    if (partes.indexOf(ced) >= 0) return sf;
  }
  return base.createFolder(ced);
}
function accionSubirComprobante(b) {
  var ced = texto(b.cedula), cliente = texto(b.cliente), placa = texto(b.placa);
  var nombreArchivo = texto(b.nombreArchivo) || 'comprobante', tipo = texto(b.tipoMime) || 'image/jpeg';
  if (!ced && !placa) return { ok: false, error: 'Falta la cédula del cliente.' };
  if (!b.datosBase64) return { ok: false, error: 'No se recibió ningún archivo.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var ext = (nombreArchivo.match(/\.[a-zA-Z0-9]+$/) || [''])[0];
    var f = aFecha(texto(b.fecha)) || new Date();
    var nombre = 'Consignación SOAT ' + (placa ? placa + ' ' : '') + iso(f) + ext;
    var blob = Utilities.newBlob(Utilities.base64Decode(b.datosBase64), tipo, nombre);
    var carp = carpetaDelCliente_(ced, cliente), archivo = carp.createFile(blob), ruta = '';
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    try { var pad = carp.getParents(); ruta = (pad.hasNext() ? pad.next().getName() + ' / ' : '') + carp.getName() + ' / ' + archivo.getName(); } catch (e2) { ruta = carp.getName() + ' / ' + archivo.getName(); }
    return { ok: true, url: 'https://drive.google.com/file/d/' + archivo.getId() + '/view', carpetaUrl: carp.getUrl(), ruta: ruta };
  } catch (err) {
    return { ok: false, error: 'No se pudo subir el comprobante: ' + err.message };
  } finally { lock.releaseLock(); }
}

// ==================== REGISTRAR GESTIÓN ====================
// Guarda en "Gestiones_Soat" que se le escribió al cliente, que renovó o que no renovará.
function accionRegistrarGestion(p) {
  var clave = texto(p.clave);
  if (!clave) return { ok: false, error: 'Falta la clave del SOAT.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var ss = abrirSS();
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
  var cliente = texto(d.cliente), placa = limpiarPlaca(d.placa), ini = aFecha(d.inicio), venta = aFecha(d.fecha) || new Date(), valor = numero(d.valor);
  if (!cliente) return { ok: false, error: 'Falta el nombre del cliente.' };
  if (!placa) return { ok: false, error: 'Falta la placa.' };
  if (!ini) return { ok: false, error: 'Falta la fecha de inicio.' };
  var ven = aFecha(d.vence) || sumarAnio(ini);
  if (!valor) return { ok: false, error: 'Falta el valor del SOAT.' };
  var ganancia = numero(d.ganancia), total = d.total !== undefined && d.total !== '' ? numero(d.total) : valor + ganancia;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  try {
    var hoja = buscarHoja(abrirSS(), HOJA_SOAT);
    if (!hoja) throw new Error('No se encontró la pestaña "' + HOJA_SOAT + '".');
    var ncol = hoja.getLastColumn(), enc = hoja.getRange(FILA_ENCABEZADOS, 1, 1, ncol).getDisplayValues()[0], idx = {};
    COLS.forEach(function (c) { idx[c.clave] = posicionColumna(enc, c); });
    var ult = ultimaFilaConDatos(hoja, idx.placa >= 0 ? idx.placa : idx.cliente);
    if (!d.forzar && ult > FILA_ENCABEZADOS) {
      var datos = hoja.getRange(FILA_ENCABEZADOS + 1, 1, ult - FILA_ENCABEZADOS, ncol).getValues();
      for (var i = 0; i < datos.length; i++) {
        if (limpiarPlaca(datos[i][idx.placa]) === placa && mismaFecha(aFechaCerca(datos[i][idx.inicio], aFecha(datos[i][idx.fecha])), ini))
          return { ok: false, duplicado: true, error: 'Ya hay un SOAT de la placa ' + placa + ' con esa fecha de inicio (fila ' + (FILA_ENCABEZADOS + 1 + i) + ').' };
      }
    }
    var nueva = ult + 1;
    if (ult > FILA_ENCABEZADOS) hoja.getRange(ult, 1, 1, ncol).copyTo(hoja.getRange(nueva, 1, 1, ncol), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    var val = { fecha: venta, cliente: cliente, cedula: aNumeroSiPuede(d.cedula), placa: placa, tipo: texto(d.tipo).toUpperCase(), cilindraje: numero(d.cilindraje) || texto(d.cilindraje),
      inicio: ini, vence: ven, valor: valor, ganancia: ganancia, total: total, forma: texto(d.forma), celular: aNumeroSiPuede(d.celular),
      tipoDoc: texto(d.tipoDoc).toUpperCase(), correo: texto(d.correo), direccion: texto(d.direccion), residencia: texto(d.residencia) };
    var asignada = {}, omitidos = [];
    COLS.forEach(function (c) {
      var col = idx[c.clave]; if (col < 0 || c.clave === 'num') return;
      var v = val[c.clave]; if (v === undefined || v === '' || v === null) return;
      if (!coincideNombre(enc, c)) { omitidos.push(c.nombres[0]); return; }   // no se escribe en una columna que no se reconoce por su título
      hoja.getRange(nueva, col + 1).setValue(v); asignada[col] = true;
    });
    // consecutivo (#): si la fila anterior tiene fórmula se copia; si no, máximo + 1
    if (idx.num >= 0) {
      var fnum = ult > FILA_ENCABEZADOS ? hoja.getRange(ult, idx.num + 1).getFormulaR1C1() : '';
      if (fnum) hoja.getRange(nueva, idx.num + 1).setFormulaR1C1(fnum);
      else { var nums = ult > FILA_ENCABEZADOS ? hoja.getRange(FILA_ENCABEZADOS + 1, idx.num + 1, ult - FILA_ENCABEZADOS, 1).getValues() : [], mx = 0; nums.forEach(function (r) { var n = Number(r[0]); if (n > mx) mx = n; }); hoja.getRange(nueva, idx.num + 1).setValue(mx + 1); }
      asignada[idx.num] = true;
    }
    // el resto de columnas: si la fila anterior tenía una fórmula, se copia
    if (ult > FILA_ENCABEZADOS) for (var j = 0; j < ncol; j++) {
      if (asignada[j]) continue;
      var f = hoja.getRange(ult, j + 1).getFormulaR1C1();
      if (f) hoja.getRange(nueva, j + 1).setFormulaR1C1(f);
    }
    SpreadsheetApp.flush();
    return { ok: true, mensaje: 'SOAT guardado en la hoja (fila ' + nueva + ').', fila: nueva, omitidos: omitidos };
  } catch (err) {
    return { ok: false, error: 'No se pudo guardar: ' + err.message };
  } finally { lock.releaseLock(); }
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

// ¿El título de alguna columna coincide con el nombre esperado? (sin usar la posición por defecto)
function coincideNombre(encabezados, col) {
  var norm = encabezados.map(normalizar);
  for (var n = 0; n < col.nombres.length; n++) {
    var b = normalizar(col.nombres[n]);
    for (var i = 0; i < norm.length; i++) if (norm[i] === b || (b.length >= 4 && norm[i].indexOf(b) === 0)) return true;
  }
  return false;
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
    var dd = +m[1], mm = +m[2];
    if (mm > 12 && dd <= 12) { var tmp = dd; dd = mm; mm = tmp; }   // texto tipo 9-18-2027 (mes-día-año)
    var d = new Date(a, mm - 1, dd);
    return isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}
// Igual que aFecha, pero si el texto puede leerse de dos maneras (día/mes o mes/día) elige la más cercana a la fecha de referencia.
function aFechaCerca(v, ref) {
  if (Object.prototype.toString.call(v) === '[object Date]' || !ref) return aFecha(v);
  var t = texto(v), m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (!m) return aFecha(v);
  var a = +m[3]; if (a < 100) a += 2000;
  var x = +m[1], y = +m[2];
  if (x > 12 || y > 12 || x === y) return aFecha(v);
  var c1 = new Date(a, y - 1, x), c2 = new Date(a, x - 1, y);   // día/mes  y  mes/día
  return Math.abs(c1 - ref) <= Math.abs(c2 - ref) ? c1 : c2;
}
function fmt(d) { return d ? ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear() : ''; }
function iso(d) { return d ? d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) : ''; }
