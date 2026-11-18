/**
 * PROTECT MOTOS — Conector de Cobros
 * Publicar como Aplicación web (Implementar > Nueva implementación > Aplicación web).
 * Acceso: "Cualquier usuario" (para que el HTML por file:// pueda llamarlo por JSONP).
 * Ejecutar como: "Yo" (el dueño de la hoja).
 */

// ==================== CONFIGURACIÓN ====================
var TOKEN = 'PM-COBROS-2026';
var SHEET_ID = '1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04';
var HOJA_SEGUIMIENTO = 'Protect';
var HOJA_PAGOS = 'Pagos';
var HOJA_GESTIONES = 'Gestiones';

var COL = {
  ASESOR: 2,
  CEDULA: 5,
  CLIENTE: 8,
  FECHA: 11,        // Fecha de firma
  FIN: 12,           // Fecha de vencimiento de la póliza
  PLACA: 13,
  CONTRATO: 14,      // N° de contrato (clave única)
  VALOR_PROTECT: 15, // Valor total financiado
  VALOR_CUOTA: 17,
  PLAZO: 18,
  FORMA: 20,         // CONTADO | FINANCIADO
  CELULAR: 31,
  CORREO: 32,
  DIRECCION: 33,
  ESTADO_CLIENTE: 44 // ACTIVO | CANCELADO | FINALIZADO (columna AR)
};

var FILA_INICIO_DATOS = 2; // fila 1 = encabezados

// Hojas de Google de las pólizas: Responsabilidad Civil (RC) y Accidentes Personales (AP)
var SHEET_RC_ID = '1x8yZENs-5gGhT64CPStTuBa_YHQtCM89W5o7t0hSNB8';
var SHEET_AP_ID = '1RopIZryAegrNvSdLQK5KdLjDA_sqvme4SMG11g8b4ck';
// RC: cédula G (7), número B (2), nombre E (5), fecha fin J (10) «Fecha_Fin»
// AP: cédula J (10), número A (1), nombre D (4), fecha fin L (12) «Fecha Fin Vigencia»
var VIG_CFG = {
  RC: { id: SHEET_RC_ID, colCed: 7, colNum: 2, colNom: 5, nNom: 1, colFin: 10, nombre: 'Responsabilidad Civil' },
  AP: { id: SHEET_AP_ID, colCed: 10, colNum: 1, colNom: 4, nNom: 3, colFin: 12, nombre: 'Accidentes Personales' }
};

// Columnas que se agregan solas al final de la hoja Protect la primera vez que se cancela un cliente
var ENC_FECHA_CANCELACION = 'Fecha de cancelación';
var ENC_MOTIVO_CANCELACION = 'Motivo de cancelación';   // Solicitud del cliente | Dejó de pagar | Venció sin renovar

// Devuelve el número de columna (1, 2, 3…) que tiene ese título en la fila 1; si no existe y crear=true, la crea al final.
function columnaPorEncabezado(hoja, titulo, crear) {
  var ult = Math.max(hoja.getLastColumn(), 1);
  var enc = hoja.getRange(1, 1, 1, ult).getValues()[0];
  var buscado = String(titulo).trim().toLowerCase();
  for (var i = 0; i < enc.length; i++) {
    if (String(enc[i] || '').trim().toLowerCase() === buscado) return i + 1;
  }
  if (!crear) return 0;
  var col = ult + 1;
  hoja.getRange(1, col).setValue(titulo);
  return col;
}

// Encabezados exactos de la hoja "Pagos" (columnas A-H)
var ENCABEZADOS_PAGOS = [
  'Fecha de pago', 'N° contrato', 'Cédula', 'Cliente',
  'N° de cuota', 'Valor pagado', 'Comprobante / nota', 'Registrado por'
];

// Encabezados exactos de la hoja "Gestiones" (columnas A-F)
var ENCABEZADOS_GESTIONES = [
  'Fecha de gestión', 'N° contrato', 'Cédula', 'Cliente', 'Acción', 'Registrado por'
];

// Carpeta de Drive donde se guardan las capturas de los comprobantes de
// pago. Se crea sola la primera vez que se sube un comprobante.
var CARPETA_COMPROBANTES = 'Comprobantes de pago';

// ==================== PUNTO DE ENTRADA (GET) ====================
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var callback = params.callback;
  var salida;

  try {
    if (params.token !== TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else {
      var accion = params.action || 'datos';
      if (accion === 'datos') {
        salida = accionDatos();
      } else if (accion === 'registrarPago') {
        salida = accionRegistrarPago(params);
      } else if (accion === 'estado') {
        salida = accionCambiarEstado(params);
      } else if (accion === 'registrarGestion') {
        salida = accionRegistrarGestion(params);
      } else if (accion === 'vigencias') {
        salida = accionVigencias();
      } else {
        salida = { ok: false, error: 'Acción desconocida: ' + accion };
      }
    }
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }

  return responder(salida, callback);
}

// ==================== PUNTO DE ENTRADA (POST) ====================
// Solo se usa para subir la imagen del comprobante de pago: por su tamaño
// no cabe en una URL de GET/JSONP como las demás acciones.
function doPost(e) {
  var salida;
  try {
    var body = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    if (body.token !== TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else if (body.action === 'subirComprobante') {
      salida = accionSubirComprobante(body);
    } else {
      salida = { ok: false, error: 'Acción desconocida: ' + body.action };
    }
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }
  return responder(salida, null);
}

function responder(objeto, callback) {
  var json = JSON.stringify(objeto);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== ACCIÓN: DATOS ====================
function accionDatos() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var hojaSeg = hojaSeguimiento(ss);
  var hojaPagos = ss.getSheetByName(HOJA_PAGOS);
  var hojaGestiones = ss.getSheetByName(HOJA_GESTIONES);

  var contratos = leerContratos(hojaSeg);
  var pagos = leerPagos(hojaPagos);
  var gestiones = leerGestiones(hojaGestiones);

  return { ok: true, contratos: contratos, pagos: pagos, gestiones: gestiones };
}

function leerContratos(hoja) {
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < FILA_INICIO_DATOS) return [];

  var ultimaCol = hoja.getLastColumn();
  var datos = hoja.getRange(FILA_INICIO_DATOS, 1, ultimaFila - FILA_INICIO_DATOS + 1, ultimaCol).getValues();
  var colFC = columnaPorEncabezado(hoja, ENC_FECHA_CANCELACION, false);
  var colMC = columnaPorEncabezado(hoja, ENC_MOTIVO_CANCELACION, false);

  var resultado = [];
  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];
    var contrato = String(fila[COL.CONTRATO - 1] || '').trim();
    var cliente = String(fila[COL.CLIENTE - 1] || '').trim();
    if (!contrato && !cliente) continue; // fila vacía

    resultado.push({
      asesor: String(fila[COL.ASESOR - 1] || ''),
      cedula: String(fila[COL.CEDULA - 1] || ''),
      cliente: cliente,
      fechaFirma: formatoFecha(fila[COL.FECHA - 1]),
      fechaFirmaISO: formatoISO(fila[COL.FECHA - 1]),
      fin: formatoFecha(fila[COL.FIN - 1]),
      finISO: formatoISO(fila[COL.FIN - 1]),
      placa: String(fila[COL.PLACA - 1] || ''),
      contrato: contrato,
      valorProtect: Number(fila[COL.VALOR_PROTECT - 1] || 0),
      valorCuota: Number(fila[COL.VALOR_CUOTA - 1] || 0),
      plazo: Number(fila[COL.PLAZO - 1] || 0),
      forma: String(fila[COL.FORMA - 1] || '').trim().toUpperCase(),
      celular: String(fila[COL.CELULAR - 1] || ''),
      correo: String(fila[COL.CORREO - 1] || ''),
      direccion: String(fila[COL.DIRECCION - 1] || ''),
      estado: String(fila[COL.ESTADO_CLIENTE - 1] || '').trim().toUpperCase(),
      fechaCancelacion: colFC ? formatoFecha(fila[colFC - 1]) : '',
      fechaCancelacionISO: colFC ? formatoISO(fila[colFC - 1]) : '',
      motivoCancelacion: colMC ? String(fila[colMC - 1] || '').trim() : ''
    });
  }
  return resultado;
}

function leerPagos(hoja) {
  if (!hoja) return [];
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return [];

  var datos = hoja.getRange(2, 1, ultimaFila - 1, 8).getValues();
  var resultado = [];
  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];
    var contrato = String(fila[1] || '').trim();
    if (!contrato) continue;
    resultado.push({
      fechaPago: formatoFecha(fila[0]),
      fechaPagoISO: formatoISO(fila[0]),
      contrato: contrato,
      cedula: String(fila[2] || ''),
      cliente: String(fila[3] || ''),
      cuota: String(fila[4] || ''),
      valorPagado: Number(fila[5] || 0),
      nota: String(fila[6] || ''),
      registradoPor: String(fila[7] || '')
    });
  }
  return resultado;
}

function leerGestiones(hoja) {
  if (!hoja) return [];
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return [];

  var datos = hoja.getRange(2, 1, ultimaFila - 1, 6).getValues();
  var resultado = [];
  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];
    var contrato = String(fila[1] || '').trim();
    if (!contrato) continue;
    resultado.push({
      fechaGestion: formatoFecha(fila[0]),
      fechaGestionISO: formatoISO(fila[0]),
      contrato: contrato,
      cedula: String(fila[2] || ''),
      cliente: String(fila[3] || ''),
      accion: String(fila[4] || ''),
      registradoPor: String(fila[5] || '')
    });
  }
  return resultado;
}

// ==================== ACCIÓN: REGISTRAR GESTIÓN DE COBRO ====================
// Marca que hoy ya se contactó al cliente ("YA COBRÉ HOY"). No cambia el
// estado del cliente ni registra ningún pago — solo queda el registro de
// que se hizo la gestión, para que no vuelva a salir en la lista de hoy.
function accionRegistrarGestion(params) {
  var contrato = String(params.contrato || '').trim();
  var cedula = String(params.cedula || '').trim();
  var cliente = String(params.cliente || '').trim();
  var registradoPor = String(params.registradoPor || '').trim();
  var accion = String(params.accion || '').trim() || 'Cobro realizado';

  if (!contrato) return { ok: false, error: 'Falta el número de contrato.' };

  var lock = LockService.getScriptLock();
  var exito = lock.tryLock(15000);
  if (!exito) {
    return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  }

  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var hojaGestiones = ss.getSheetByName(HOJA_GESTIONES);
    if (!hojaGestiones) {
      hojaGestiones = ss.insertSheet(HOJA_GESTIONES);
      hojaGestiones.appendRow(ENCABEZADOS_GESTIONES);
    }

    hojaGestiones.appendRow([new Date(), contrato, cedula, cliente, accion, registradoPor]);

    return { ok: true, mensaje: 'Gestión registrada correctamente.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo registrar la gestión: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

// ==================== ACCIÓN: REGISTRAR PAGO ====================
function accionRegistrarPago(params) {
  var contrato = String(params.contrato || '').trim();
  var cedula = String(params.cedula || '').trim();
  var cliente = String(params.cliente || '').trim();
  var cuota = String(params.cuota || '').trim();
  var valor = Number(params.valor || 0);
  var nota = String(params.nota || '').trim();
  var registradoPor = String(params.registradoPor || '').trim();
  var fechaTexto = String(params.fecha || '').trim(); // esperado d/m/aaaa o yyyy-mm-dd

  if (!contrato) return { ok: false, error: 'Falta el número de contrato.' };
  if (!cuota) return { ok: false, error: 'Falta el número de cuota.' };
  if (!valor || valor <= 0) return { ok: false, error: 'El valor pagado debe ser mayor a 0.' };

  var fechaPago = parsearFecha(fechaTexto) || new Date();

  var lock = LockService.getScriptLock();
  var exito = lock.tryLock(15000);
  if (!exito) {
    return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  }

  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var hojaPagos = ss.getSheetByName(HOJA_PAGOS);
    if (!hojaPagos) {
      hojaPagos = ss.insertSheet(HOJA_PAGOS);
      hojaPagos.appendRow(ENCABEZADOS_PAGOS);
    }

    hojaPagos.appendRow([fechaPago, contrato, cedula, cliente, cuota, valor, nota, registradoPor]);

    // Si con este pago el cliente financiado completó todas las cuotas, marcar FINALIZADO.
    var finalizado = false;
    var hojaSeg = hojaSeguimiento(ss);
    var infoContrato = buscarFilaContrato(hojaSeg, contrato);
    if (infoContrato) {
      var forma = String(infoContrato.fila[COL.FORMA - 1] || '').trim().toUpperCase();
      var plazo = Number(infoContrato.fila[COL.PLAZO - 1] || 0);
      var estadoActual = String(infoContrato.fila[COL.ESTADO_CLIENTE - 1] || '').trim().toUpperCase();

      if (forma === 'FINANCIADO' && estadoActual === 'ACTIVO' && plazo > 0) {
        // La cuota 1 se paga al firmar y nunca queda registrada en "Pagos",
        // así que se suma como ya pagada al comparar contra el plazo.
        var cuotasPagadas = contarCuotasPagadas(hojaPagos, contrato, plazo) + 1;
        if (cuotasPagadas >= plazo) {
          hojaSeg.getRange(infoContrato.numeroFila, COL.ESTADO_CLIENTE).setValue('FINALIZADO');
          finalizado = true;
        }
      }
    }

    return { ok: true, mensaje: 'Pago registrado correctamente.', finalizado: finalizado };
  } catch (err) {
    return { ok: false, error: 'No se pudo registrar el pago: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

function contarCuotasPagadas(hojaPagos, contrato, plazo) {
  var ultimaFila = hojaPagos.getLastRow();
  if (ultimaFila < 2) return 0;
  var datos = hojaPagos.getRange(2, 1, ultimaFila - 1, 8).getValues();
  var pagadas = {};
  for (var i = 0; i < datos.length; i++) {
    if (String(datos[i][1] || '').trim() !== contrato) continue;
    var numeros = extraerNumerosCuota(String(datos[i][4] || ''));
    for (var j = 0; j < numeros.length; j++) {
      if (numeros[j] >= 1 && numeros[j] <= plazo) pagadas[numeros[j]] = true;
    }
  }
  return Object.keys(pagadas).length;
}

function extraerNumerosCuota(texto) {
  var numeros = [];
  texto = texto.replace(/,/g, ' ');
  var partes = texto.split(/\s+/).filter(function (p) { return p !== ''; });
  for (var i = 0; i < partes.length; i++) {
    var parte = partes[i];
    var rango = parte.match(/^(\d+)-(\d+)$/);
    if (rango) {
      var a = parseInt(rango[1], 10), b = parseInt(rango[2], 10);
      for (var n = a; n <= b; n++) numeros.push(n);
    } else {
      // Cualquier otro separador que haya quedado (punto, guiones
      // encadenados, punto y coma...) — ej. si Sheets convirtió "3,4" en
      // el número 3.4 — se toma cada número que aparezca como una cuota
      // individual, sin importar qué caracter quedó entre ellos.
      var sueltos = parte.match(/\d+/g);
      if (sueltos) sueltos.forEach(function (s) { numeros.push(parseInt(s, 10)); });
    }
  }
  // soporte para "4 a 6"
  var rangoTexto = texto.match(/^(\d+)\s*a\s*(\d+)$/i);
  if (rangoTexto) {
    var x = parseInt(rangoTexto[1], 10), y = parseInt(rangoTexto[2], 10);
    numeros = [];
    for (var k = x; k <= y; k++) numeros.push(k);
  }
  return numeros;
}

// ==================== ACCIÓN: SUBIR COMPROBANTE ====================
// Recibe la imagen en base64, la guarda en Drive (carpeta "Comprobantes de
// pago", se crea sola la primera vez) y devuelve el enlace. No toca la hoja
// "Pagos" — el enlace se agrega después, al registrar el pago.
function accionSubirComprobante(body) {
  var contrato = String(body.contrato || '').trim();
  var cedula = String(body.cedula || '').trim();
  var cliente = String(body.cliente || '').trim();
  var cuota = String(body.cuota || '').trim();
  var fecha = String(body.fecha || '').trim(); // d/m/aaaa o yyyy-mm-dd, como la escribió el usuario
  var nombreArchivo = String(body.nombreArchivo || '').trim() || 'comprobante';
  var tipoMime = String(body.tipoMime || '').trim() || 'image/jpeg';
  var datosBase64 = body.datosBase64;

  if (!contrato) return { ok: false, error: 'Falta el número de contrato.' };
  if (!datosBase64) return { ok: false, error: 'No se recibió ninguna imagen.' };

  var lock = LockService.getScriptLock();
  var exito = lock.tryLock(15000);
  if (!exito) {
    return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  }

  try {
    var bytes = Utilities.base64Decode(datosBase64);
    // Dentro de la carpeta del cliente ya no hace falta repetir la cédula
    // en cada archivo: con la cuota y la fecha basta.
    var extension = (nombreArchivo.match(/\.[a-zA-Z0-9]+$/) || [''])[0];
    var partesNombre = [];
    if (cuota) partesNombre.push('Cuota ' + cuota);
    var fechaFormateada = formatoFechaParaNombre(fecha);
    if (fechaFormateada) partesNombre.push(fechaFormateada);
    if (partesNombre.length === 0) partesNombre.push('comprobante');
    var nombreFinal = partesNombre.join(' - ') + extension;
    var blob = Utilities.newBlob(bytes, tipoMime, nombreFinal);

    var carpetaCliente = obtenerCarpetaCliente(cedula || contrato, cliente);
    var archivo = carpetaCliente.createFile(blob);
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return { ok: true, url: 'https://drive.google.com/file/d/' + archivo.getId() + '/view' };
  } catch (err) {
    return { ok: false, error: 'No se pudo subir el comprobante: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

function obtenerCarpetaComprobantes() {
  var carpetas = DriveApp.getFoldersByName(CARPETA_COMPROBANTES);
  if (carpetas.hasNext()) return carpetas.next();
  return DriveApp.createFolder(CARPETA_COMPROBANTES);
}

// Subcarpeta de un cliente dentro de "Comprobantes de pago", identificada
// por su cédula (o el contrato si no hay cédula). Se busca por el prefijo
// "clave - " para que, aunque el nombre del cliente cambie o esté escrito
// distinto, siga cayendo en la misma carpeta ya creada.
function obtenerCarpetaCliente(clave, cliente) {
  var carpetaRaiz = obtenerCarpetaComprobantes();
  var prefijo = clave + ' - ';
  var subcarpetas = carpetaRaiz.getFolders();
  while (subcarpetas.hasNext()) {
    var sub = subcarpetas.next();
    if (sub.getName().indexOf(prefijo) === 0) return sub;
  }
  var nombreCarpeta = clave + ' - ' + (cliente || 'Cliente');
  return carpetaRaiz.createFolder(nombreCarpeta);
}

// Función de prueba: selecciónala en el desplegable de funciones del editor
// y dale "Ejecutar" para forzar que Google pida el permiso de Drive la
// primera vez (crea un archivo de prueba en la carpeta "Comprobantes de
// pago", que puedes borrar después). No la usa el panel ni se ejecuta sola.
function pruebaDrive() {
  var resultado = accionSubirComprobante({
    contrato: 'PRUEBA',
    nombreArchivo: 'prueba.txt',
    tipoMime: 'text/plain',
    datosBase64: Utilities.base64Encode('contenido de prueba')
  });
  Logger.log(resultado);
}

// ==================== ACCIÓN: CAMBIAR ESTADO ====================
function accionCambiarEstado(params) {
  var contrato = String(params.contrato || '').trim();
  var nuevoEstado = String(params.nuevoEstado || '').trim().toUpperCase();

  if (!contrato) return { ok: false, error: 'Falta el número de contrato.' };
  var estadosValidos = ['ACTIVO', 'CANCELADO', 'FINALIZADO'];
  if (estadosValidos.indexOf(nuevoEstado) === -1) {
    return { ok: false, error: 'Estado inválido: ' + nuevoEstado };
  }

  var lock = LockService.getScriptLock();
  var exito = lock.tryLock(15000);
  if (!exito) {
    return { ok: false, error: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
  }

  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var hojaSeg = hojaSeguimiento(ss);
    var info = buscarFilaContrato(hojaSeg, contrato);
    if (!info) {
      return { ok: false, error: 'No se encontró el contrato ' + contrato };
    }
    hojaSeg.getRange(info.numeroFila, COL.ESTADO_CLIENTE).setValue(nuevoEstado);
    // Fecha y motivo de la cancelación (columnas nuevas al final de la hoja Protect)
    if (nuevoEstado === 'CANCELADO') {
      var fISO = String(params.fechaCancelacion || '').trim();
      var fecha = /^\d{4}-\d{2}-\d{2}$/.test(fISO)
        ? new Date(Number(fISO.slice(0, 4)), Number(fISO.slice(5, 7)) - 1, Number(fISO.slice(8, 10)))
        : new Date();
      var cF = columnaPorEncabezado(hojaSeg, ENC_FECHA_CANCELACION, true);
      var cM = columnaPorEncabezado(hojaSeg, ENC_MOTIVO_CANCELACION, true);
      hojaSeg.getRange(info.numeroFila, cF).setValue(fecha).setNumberFormat('dd/mm/yyyy');
      hojaSeg.getRange(info.numeroFila, cM).setValue(String(params.motivo || '').trim());
    } else {
      var cF0 = columnaPorEncabezado(hojaSeg, ENC_FECHA_CANCELACION, false);
      var cM0 = columnaPorEncabezado(hojaSeg, ENC_MOTIVO_CANCELACION, false);
      if (cF0) hojaSeg.getRange(info.numeroFila, cF0).clearContent();
      if (cM0) hojaSeg.getRange(info.numeroFila, cM0).clearContent();
    }
    return { ok: true, mensaje: 'Estado actualizado a ' + nuevoEstado + '.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo cambiar el estado: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

// ==================== ACCIÓN: VIGENCIAS DE RC Y AP ====================
// Lee la fecha de fin de vigencia de las hojas de RC (columna J «Fecha_Fin») y de AP (columna L «Fecha Fin Vigencia»).
// Solo lee: no escribe nada. Si una cédula aparece varias veces (renovaciones) se queda con la vigencia más reciente.
function accionVigencias() {
  var salida = [], avisos = [], enc = {};
  ['RC', 'AP'].forEach(function (tipo) {
    var cfg = VIG_CFG[tipo];
    try {
      var sh = SpreadsheetApp.openById(cfg.id).getSheets()[0], ult = sh.getLastRow();
      enc[tipo] = String(sh.getRange(1, cfg.colFin).getValue() || '').trim();
      if (ult < 2) return;
      var ancho = Math.max(cfg.colCed, cfg.colNum, cfg.colNom + cfg.nNom - 1, cfg.colFin);
      var datos = sh.getRange(2, 1, ult - 1, ancho).getValues(), mejor = {};
      for (var i = 0; i < datos.length; i++) {
        var f = datos[i];
        var ced = String(f[cfg.colCed - 1] == null ? '' : f[cfg.colCed - 1]).replace(/\.0+$/, '').replace(/\D/g, '').replace(/^0+/, '');
        if (!ced) continue;
        var v = f[cfg.colFin - 1], fecha = null;
        if (v instanceof Date) fecha = v; else if (v) fecha = parsearFecha(String(v).trim());
        if (!fecha || isNaN(fecha.getTime())) continue;
        var iso = formatoISO(fecha);
        if (mejor[ced] && mejor[ced].finISO >= iso) continue;
        var nom = []; for (var k = 0; k < cfg.nNom; k++) nom.push(String(f[cfg.colNom - 1 + k] || '').trim());
        mejor[ced] = { tipo: tipo, cedula: ced, numero: String(f[cfg.colNum - 1] == null ? '' : f[cfg.colNum - 1]).trim(), nombre: nom.join(' ').replace(/\s+/g, ' ').trim(), finISO: iso, fin: formatoFecha(fecha), fila: i + 2 };
      }
      Object.keys(mejor).forEach(function (c) { salida.push(mejor[c]); });
    } catch (e) {
      avisos.push('No pude leer la hoja de ' + cfg.nombre + ': ' + e.message);
    }
  });
  return { ok: true, vigencias: salida, avisos: avisos, encabezados: enc };
}

// ==================== UTILIDADES ====================
function hojaSeguimiento(ss) {
  var hoja = ss.getSheetByName(HOJA_SEGUIMIENTO);
  if (!hoja) {
    throw new Error('No se encontró la pestaña "' + HOJA_SEGUIMIENTO + '". Revisa que se llame exactamente así.');
  }
  return hoja;
}

function buscarFilaContrato(hoja, contrato) {
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < FILA_INICIO_DATOS) return null;
  var valores = hoja.getRange(FILA_INICIO_DATOS, COL.CONTRATO, ultimaFila - FILA_INICIO_DATOS + 1, 1).getValues();
  for (var i = 0; i < valores.length; i++) {
    if (String(valores[i][0] || '').trim() === contrato) {
      var numeroFila = FILA_INICIO_DATOS + i;
      var filaCompleta = hoja.getRange(numeroFila, 1, 1, hoja.getLastColumn()).getValues()[0];
      return { numeroFila: numeroFila, fila: filaCompleta };
    }
  }
  return null;
}

function formatoFecha(valor) {
  if (!valor) return '';
  var fecha = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(fecha.getTime())) return '';
  return ('0' + fecha.getDate()).slice(-2) + '/' + ('0' + (fecha.getMonth() + 1)).slice(-2) + '/' + fecha.getFullYear();
}

function formatoISO(valor) {
  if (!valor) return '';
  var fecha = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(fecha.getTime())) return '';
  var mes = ('0' + (fecha.getMonth() + 1)).slice(-2);
  var dia = ('0' + fecha.getDate()).slice(-2);
  return fecha.getFullYear() + '-' + mes + '-' + dia;
}

function parsearFecha(texto) {
  if (!texto) return null;
  // yyyy-mm-dd
  var isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }
  // d/m/aaaa
  var esMatch = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (esMatch) {
    return new Date(Number(esMatch[3]), Number(esMatch[2]) - 1, Number(esMatch[1]));
  }
  var fecha = new Date(texto);
  return isNaN(fecha.getTime()) ? null : fecha;
}

// dd-mm-aaaa, para usar en nombres de archivo (sin "/" que no es válido ahí).
function formatoFechaParaNombre(texto) {
  var fecha = parsearFecha(texto);
  if (!fecha) return '';
  var dia = ('0' + fecha.getDate()).slice(-2);
  var mes = ('0' + (fecha.getMonth() + 1)).slice(-2);
  return dia + '-' + mes + '-' + fecha.getFullYear();
}
