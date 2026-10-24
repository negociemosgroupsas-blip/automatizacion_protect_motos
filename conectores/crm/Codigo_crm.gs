/**
 * PROTECT MOTOS — Conector del CRM (SOLO LECTURA)
 *
 * Proyecto de Apps Script NUEVO e independiente: no modifica ni reemplaza el conector de Cobros,
 * ni el de Conciliación, ni el de Contratos. Solo LEE la hoja y entrega los datos al Inicio del CRM
 * (gráficas, alertas y buscador). No escribe nada en el Sheet.
 *
 * Publicar como Aplicación web:  Ejecutar como: Yo  ·  Quién tiene acceso: Cualquier usuario.
 */

// ==================== CONFIGURACIÓN ====================
var TOKEN = 'PM-CRM-2026';   // si lo cambias, cámbialo igual en la pestaña «Conexiones» del CRM (se pega junto a la URL)
var SHEET_ID = '1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04';
var HOJA_SEGUIMIENTO = 'Protect';
var HOJA_PAGOS = 'Pagos';
var FILA_INICIO_DATOS = 2; // fila 1 = encabezados

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
  FECHA_NAC: 6,      // Fecha de nacimiento del cliente (columna F)
  EDAD: 7,           // Edad del cliente al firmar (columna G)
  MES: 9,            // Mes del contrato (columna I)
  ANIO: 10,          // Año del contrato (columna J)
  RC: 21,            // Responsabilidad Civil: SI | NO (columna U)
  AP: 23,            // Asistencias: SI | NO (columna W)
  CELULAR: 31,
  CORREO: 32,
  DIRECCION: 33,
  ESTADO_CLIENTE: 44 // ACTIVO | CANCELADO | FINALIZADO (columna AR)
};

// ==================== PUNTO DE ENTRADA ====================
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var salida;
  try {
    if (params.token !== TOKEN) {
      salida = { ok: false, error: 'Token inválido.' };
    } else {
      var accion = params.action || 'datos';
      if (accion === 'datos') {
        salida = accionDatos();
      } else if (accion === 'ping') {
        salida = { ok: true, mensaje: 'Conector del CRM activo (solo lectura)', version: 'crm-1' };
      } else {
        salida = { ok: false, error: 'Este conector es solo de lectura. Acción no disponible: ' + accion };
      }
    }
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }
  return responder(salida, params.callback);
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
  return { ok: true, contratos: leerContratos(hojaSeg), pagos: leerPagos(hojaPagos), gestiones: [] };
}

function leerContratos(hoja) {
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < FILA_INICIO_DATOS) return [];

  var ultimaCol = hoja.getLastColumn();
  var datos = hoja.getRange(FILA_INICIO_DATOS, 1, ultimaFila - FILA_INICIO_DATOS + 1, ultimaCol).getValues();

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
      edad: Number(fila[COL.EDAD - 1]) || 0,
      fechaNacISO: formatoISO(fila[COL.FECHA_NAC - 1]),
      mes: valorMesAnio(fila[COL.MES - 1], 'mes'),
      anio: valorMesAnio(fila[COL.ANIO - 1], 'anio'),
      rc: String(fila[COL.RC - 1] || '').trim().toUpperCase(),
      ap: String(fila[COL.AP - 1] || '').trim().toUpperCase(),
      estado: String(fila[COL.ESTADO_CLIENTE - 1] || '').trim().toUpperCase()
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

function hojaSeguimiento(ss) {
  var hoja = ss.getSheetByName(HOJA_SEGUIMIENTO);
  if (!hoja) {
    throw new Error('No se encontró la pestaña "' + HOJA_SEGUIMIENTO + '". Revisa que se llame exactamente así.');
  }
  return hoja;
}

function formatoFecha(valor) {
  if (!valor) return '';
  var fecha = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(fecha.getTime())) return '';
  return fecha.getDate() + '/' + (fecha.getMonth() + 1) + '/' + fecha.getFullYear();
}

// Mes/año tal como están en la hoja; si la celda es una fecha, se devuelve su mes (1-12) o su año.

function valorMesAnio(valor, tipo) {
  if (valor instanceof Date) return String(tipo === 'mes' ? valor.getMonth() + 1 : valor.getFullYear());
  return String(valor === null || valor === undefined ? '' : valor).trim();
}

function formatoISO(valor) {
  if (!valor) return '';
  var fecha = (valor instanceof Date) ? valor : new Date(valor);
  if (isNaN(fecha.getTime())) return '';
  var mes = ('0' + (fecha.getMonth() + 1)).slice(-2);
  var dia = ('0' + fecha.getDate()).slice(-2);
  return fecha.getFullYear() + '-' + mes + '-' + dia;
}
