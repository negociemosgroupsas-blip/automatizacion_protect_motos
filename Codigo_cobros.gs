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
  ESTADO_CLIENTE: 44 // ACTIVO | CANCELADO | FINALIZADO
};

var FILA_INICIO_DATOS = 2; // fila 1 = encabezados

// Encabezados exactos de la hoja "Pagos" (columnas A-H)
var ENCABEZADOS_PAGOS = [
  'Fecha de pago', 'N° contrato', 'Cédula', 'Cliente',
  'N° de cuota', 'Valor pagado', 'Comprobante / nota', 'Registrado por'
];

// ==================== PUNTO DE ENTRADA ====================
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
      } else {
        salida = { ok: false, error: 'Acción desconocida: ' + accion };
      }
    }
  } catch (err) {
    salida = { ok: false, error: 'Error en el servidor: ' + err.message };
  }

  return responder(salida, callback);
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

  var contratos = leerContratos(hojaSeg);
  var pagos = leerPagos(hojaPagos);

  return { ok: true, contratos: contratos, pagos: pagos };
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
        var cuotasPagadas = contarCuotasPagadas(hojaPagos, contrato, plazo);
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
    } else if (/^\d+$/.test(parte)) {
      numeros.push(parseInt(parte, 10));
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
    return { ok: true, mensaje: 'Estado actualizado a ' + nuevoEstado + '.' };
  } catch (err) {
    return { ok: false, error: 'No se pudo cambiar el estado: ' + err.message };
  } finally {
    lock.releaseLock();
  }
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
  return fecha.getDate() + '/' + (fecha.getMonth() + 1) + '/' + fecha.getFullYear();
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
