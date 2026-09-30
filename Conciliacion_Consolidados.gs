/**
 * PROTECT MOTOS — Conciliación de pagos contra "Consolidados"
 *
 * Archivo INDEPENDIENTE: no modifica ni depende de Codigo_cobros.gs.
 * Todas las funciones y constantes llevan el prefijo CONC_ para no chocar con las existentes.
 * No crea triggers. Se ejecuta a mano: elegir CONC_conciliar y pulsar "Ejecutar".
 *
 * Solo LEE las hojas "Protect" y "Consolidados".
 * Solo ESCRIBE en la hoja "Conciliacion" (la crea si no existe y la reescribe en cada corrida).
 *
 * Regla: Protect!P (valor pagado a Dugo Motos) se compara por separado con
 * Consolidados!C y Consolidados!D. Nunca se suman. Si alguna concuerda => Conciliado.
 * La columna O de Protect NO se usa.
 */

// ==================== CONFIGURACIÓN ====================
var CONC_SHEET_ID = '1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04';
var CONC_HOJA_PROTECT = 'Protect';
var CONC_HOJA_CONSOLIDADOS = 'Consolidados';
var CONC_HOJA_RESULTADO = 'Conciliacion';

var CONC_TOLERANCIA = 0; // pesos de diferencia aceptados para considerar "Conciliado"

// Protect: fila 1 = encabezados. Columnas (base 1): E, H, M, N, P
var CONC_PROTECT_FILA_INICIO = 2;
var CONC_P = { CEDULA: 5, CLIENTE: 8, PLACA: 13, CONTRATO: 14, PAGADO_DUGO: 16 };

// Consolidados: fila 1 = fórmulas (se ignora), fila 2 = encabezados, datos desde la 3. A, B, C, D
var CONC_CONS_FILA_INICIO = 3;

var CONC_ESTADO = {
  CONCILIADO: 'Conciliado',
  MAS: 'Pagó de más',
  MENOS: 'Pagó de menos',
  SIN_VALOR_CONT: 'Sin valor de contabilidad',
  SIN_VALOR_PROTECT: 'Sin valor en Protect!P',
  SIN_CONS: 'Sin registro en Consolidados',
  SIN_PROTECT: 'Sin registro en Protect',
  AMBIGUO: 'Ambiguo (revisar)'
};

var CONC_COLORES = {
  'Conciliado': '#d9ead3',
  'Pagó de más': '#fff2cc',
  'Pagó de menos': '#f4cccc',
  'Sin valor de contabilidad': '#e6e6e6',
  'Sin valor en Protect!P': '#e6e6e6',
  'Sin registro en Consolidados': '#fce5cd',
  'Sin registro en Protect': '#fce5cd',
  'Ambiguo (revisar)': '#d9d2e9'
};

var CONC_ENCABEZADOS = [
  'Estado', 'Cédula', 'Cliente (Consolidados)', 'Cliente (Protect)', 'Placa', 'Contrato',
  'Protect!P (pagado a Dugo Motos)', 'Consolidados C', 'Consolidados D',
  'Concordó con', 'Diferencia (valor usado − P)', 'Diferencia C − P', 'Diferencia D − P',
  'Cruce', 'Fila Consolidados', 'Fila Protect', 'Observación'
];

// ==================== PUNTO DE ENTRADA ====================
function CONC_conciliar() {
  var ss = SpreadsheetApp.openById(CONC_SHEET_ID);
  var hojaProtect = ss.getSheetByName(CONC_HOJA_PROTECT);
  var hojaCons = ss.getSheetByName(CONC_HOJA_CONSOLIDADOS);
  if (!hojaProtect) throw new Error('No se encontró la hoja "' + CONC_HOJA_PROTECT + '".');
  if (!hojaCons) throw new Error('No se encontró la hoja "' + CONC_HOJA_CONSOLIDADOS + '".');

  var protect = CONC_leerProtect(hojaProtect);
  var cons = CONC_leerConsolidados(hojaCons);
  var res = CONC_calcular(protect, cons, CONC_TOLERANCIA);

  CONC_escribirResultado(ss, res);
  Logger.log('Conciliación lista: ' + JSON.stringify(res.resumen));
}

// ==================== LECTURA (solo lectura) ====================
function CONC_leerProtect(hoja) {
  var ultima = hoja.getLastRow();
  if (ultima < CONC_PROTECT_FILA_INICIO) return [];
  var n = ultima - CONC_PROTECT_FILA_INICIO + 1;
  var datos = hoja.getRange(CONC_PROTECT_FILA_INICIO, 1, n, CONC_P.PAGADO_DUGO).getValues();
  var filas = [];
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    var cedula = f[CONC_P.CEDULA - 1];
    var cliente = f[CONC_P.CLIENTE - 1];
    var placa = f[CONC_P.PLACA - 1];
    var contrato = f[CONC_P.CONTRATO - 1];
    var pagado = f[CONC_P.PAGADO_DUGO - 1];
    if (CONC_vacio(cedula) && CONC_vacio(cliente) && CONC_vacio(contrato) && CONC_vacio(placa)) continue;
    filas.push({
      fila: CONC_PROTECT_FILA_INICIO + i,
      cedula: cedula, cliente: cliente, placa: placa, contrato: contrato,
      pagado: CONC_aNumero(pagado)
    });
  }
  return filas;
}

function CONC_leerConsolidados(hoja) {
  var ultima = hoja.getLastRow();
  if (ultima < CONC_CONS_FILA_INICIO) return [];
  var n = ultima - CONC_CONS_FILA_INICIO + 1;
  var datos = hoja.getRange(CONC_CONS_FILA_INICIO, 1, n, 4).getValues();
  var filas = [];
  for (var i = 0; i < datos.length; i++) {
    var f = datos[i];
    if (CONC_vacio(f[0]) && CONC_vacio(f[1]) && CONC_vacio(f[2]) && CONC_vacio(f[3])) continue;
    filas.push({
      fila: CONC_CONS_FILA_INICIO + i,
      cedula: f[0], cliente: f[1],
      c: CONC_aNumero(f[2]), d: CONC_aNumero(f[3])
    });
  }
  return filas;
}

// ==================== LÓGICA (pura, sin acceso a hojas) ====================
function CONC_calcular(protect, cons, tol) {
  var porCedula = {};
  var porNombre = {};
  protect.forEach(function (p) {
    p.kCed = CONC_normCedula(p.cedula);
    p.kNom = CONC_normNombre(p.cliente);
    p.usada = false;
    if (p.kCed) (porCedula[p.kCed] = porCedula[p.kCed] || []).push(p);
    if (p.kNom) (porNombre[p.kNom] = porNombre[p.kNom] || []).push(p);
  });

  var salida = [];

  cons.forEach(function (r) {
    var kCed = CONC_normCedula(r.cedula);
    var cruce = 'Cédula';
    var cands = kCed ? (porCedula[kCed] || []) : [];
    if (!cands.length) {
      var kNom = CONC_normNombre(r.cliente);
      cands = kNom ? (porNombre[kNom] || []) : [];
      cruce = 'Nombre (revisar)';
    }

    if (!cands.length) {
      salida.push(CONC_filaSalida(CONC_ESTADO.SIN_PROTECT, r, null, null, cruce === 'Nombre (revisar)' ? 'Sin cruce' : cruce,
        'No aparece en Protect por cédula ni por nombre.'));
      return;
    }

    if (cands.length === 1) {
      var unico = cands[0];
      unico.usada = true;
      salida.push(CONC_evaluar(r, unico, tol, cruce, ''));
      return;
    }

    // Varias motos con la misma cédula/nombre: solo se asigna si C o D concuerda con UNA sola
    var coinciden = cands.filter(function (p) {
      return p.pagado !== null && (CONC_iguales(r.c, p.pagado, tol) || CONC_iguales(r.d, p.pagado, tol));
    });
    cands.forEach(function (p) { p.usada = true; });
    if (coinciden.length === 1) {
      salida.push(CONC_evaluar(r, coinciden[0], tol, cruce, 'Varias motos con este cliente; asignado por coincidencia exacta de valor.'));
    } else {
      var lista = cands.map(function (p) {
        return 'placa ' + (p.placa || '?') + ' / contrato ' + (p.contrato || '?') + ' / P=' + (p.pagado === null ? 'vacío' : p.pagado) + ' (fila ' + p.fila + ')';
      }).join(' | ');
      salida.push(CONC_filaSalida(CONC_ESTADO.AMBIGUO, r, null, null, cruce,
        (coinciden.length > 1 ? 'Varias motos con el mismo valor. ' : 'Ninguna moto concuerda con C ni D. ') + 'Candidatas: ' + lista));
    }
  });

  // Filas de Protect que nadie reclamó
  protect.forEach(function (p) {
    if (p.usada) return;
    salida.push({
      estado: CONC_ESTADO.SIN_CONS, cedula: p.cedula, clienteCons: '', clienteProtect: p.cliente,
      placa: p.placa, contrato: p.contrato, pagado: p.pagado, c: null, d: null,
      concordo: '', dif: null, difC: null, difD: null, cruce: '', filaCons: '', filaProtect: p.fila,
      obs: 'Está en Protect pero no en Consolidados.'
    });
  });

  var resumen = {};
  salida.forEach(function (s) { resumen[s.estado] = (resumen[s.estado] || 0) + 1; });
  return { filas: salida, resumen: resumen };
}

function CONC_evaluar(r, p, tol, cruce, obs) {
  if (p.pagado === null) {
    return CONC_filaSalida(CONC_ESTADO.SIN_VALOR_PROTECT, r, p, null, cruce, obs || 'Protect!P está vacío o no es numérico.');
  }
  if (r.c === null && r.d === null) {
    return CONC_filaSalida(CONC_ESTADO.SIN_VALOR_CONT, r, p, null, cruce, obs || 'C y D vacías en Consolidados.');
  }
  var difC = r.c === null ? null : r.c - p.pagado;
  var difD = r.d === null ? null : r.d - p.pagado;
  var okC = difC !== null && Math.abs(difC) <= tol;
  var okD = difD !== null && Math.abs(difD) <= tol;

  var estado, concordo, dif;
  if (okC || okD) {
    estado = CONC_ESTADO.CONCILIADO;
    concordo = okC && okD ? 'C y D' : (okC ? 'C' : 'D');
    dif = okC ? difC : difD;
  } else {
    // Ninguna concuerda: se usa la más cercana (empate => C)
    var usarC = difD === null || (difC !== null && Math.abs(difC) <= Math.abs(difD));
    dif = usarC ? difC : difD;
    concordo = usarC ? 'Ninguna (más cercana: C)' : 'Ninguna (más cercana: D)';
    estado = dif > 0 ? CONC_ESTADO.MAS : CONC_ESTADO.MENOS;
  }
  var fila = CONC_filaSalida(estado, r, p, null, cruce, obs);
  fila.concordo = concordo;
  fila.dif = dif;
  fila.difC = difC;
  fila.difD = difD;
  return fila;
}

function CONC_filaSalida(estado, r, p, _reservado, cruce, obs) {
  return {
    estado: estado,
    cedula: r.cedula,
    clienteCons: r.cliente,
    clienteProtect: p ? p.cliente : '',
    placa: p ? p.placa : '',
    contrato: p ? p.contrato : '',
    pagado: p ? p.pagado : null,
    c: r.c, d: r.d,
    concordo: '', dif: null, difC: null, difD: null,
    cruce: cruce,
    filaCons: r.fila,
    filaProtect: p ? p.fila : '',
    obs: obs || ''
  };
}

// ==================== ESCRITURA (solo en la hoja "Conciliacion") ====================
function CONC_escribirResultado(ss, res) {
  var hoja = ss.getSheetByName(CONC_HOJA_RESULTADO);
  if (!hoja) hoja = ss.insertSheet(CONC_HOJA_RESULTADO);
  hoja.clear();
  if (hoja.getFilter()) hoja.getFilter().remove();

  var filas = res.filas.map(function (s) {
    return [s.estado, s.cedula, s.clienteCons, s.clienteProtect, s.placa, s.contrato,
      CONC_celda(s.pagado), CONC_celda(s.c), CONC_celda(s.d),
      s.concordo, CONC_celda(s.dif), CONC_celda(s.difC), CONC_celda(s.difD),
      s.cruce, s.filaCons, s.filaProtect, s.obs];
  });

  hoja.getRange(1, 1, 1, CONC_ENCABEZADOS.length).setValues([CONC_ENCABEZADOS])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff').setWrap(true);
  hoja.setFrozenRows(1);

  if (filas.length) {
    var rango = hoja.getRange(2, 1, filas.length, CONC_ENCABEZADOS.length);
    // Cédula, placa y contrato como texto para no perder ceros ni formato
    hoja.getRange(2, 2, filas.length, 1).setNumberFormat('@');
    hoja.getRange(2, 5, filas.length, 2).setNumberFormat('@');
    rango.setValues(filas);
    hoja.getRange(2, 7, filas.length, 3).setNumberFormat('#,##0');
    hoja.getRange(2, 11, filas.length, 3).setNumberFormat('#,##0;-#,##0;0');
    var colores = filas.map(function (f) { return [CONC_COLORES[f[0]] || '#ffffff']; });
    hoja.getRange(2, 1, filas.length, 1).setBackgrounds(colores);
    hoja.getRange(1, 1, filas.length + 1, CONC_ENCABEZADOS.length).createFilter();
  }

  // Resumen a la derecha
  var colResumen = CONC_ENCABEZADOS.length + 2;
  var resumen = [['Resumen', 'Cantidad']];
  Object.keys(CONC_ESTADO).forEach(function (k) {
    resumen.push([CONC_ESTADO[k], res.resumen[CONC_ESTADO[k]] || 0]);
  });
  resumen.push(['Generado', new Date()]);
  hoja.getRange(1, colResumen, resumen.length, 2).setValues(resumen);
  hoja.getRange(1, colResumen, 1, 2).setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff');
  hoja.getRange(resumen.length, colResumen + 1).setNumberFormat('dd/mm/yyyy hh:mm');

  hoja.autoResizeColumns(1, CONC_ENCABEZADOS.length);
  hoja.setColumnWidth(CONC_ENCABEZADOS.length, 420);
}

function CONC_celda(v) { return v === null || v === undefined ? '' : v; }

// ==================== UTILIDADES ====================
function CONC_vacio(v) { return v === '' || v === null || v === undefined; }

function CONC_iguales(a, b, tol) {
  return a !== null && b !== null && Math.abs(a - b) <= tol;
}

// Convierte números y textos tipo "$ 1.234.567", "1,234,567", "1234567,50" a número. Vacío/no numérico => null
function CONC_aNumero(v) {
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (CONC_vacio(v)) return null;
  var s = String(v).replace(/[^\d.,\-]/g, '');
  if (!s || s === '-' || !/\d/.test(s)) return null;
  var neg = s.charAt(0) === '-';
  s = s.replace(/-/g, '');
  var punto = s.lastIndexOf('.');
  var coma = s.lastIndexOf(',');
  if (punto !== -1 && coma !== -1) {
    // El último separador es el decimal
    if (coma > punto) { s = s.replace(/\./g, '').replace(',', '.'); }
    else { s = s.replace(/,/g, ''); }
  } else if (punto !== -1 || coma !== -1) {
    var sep = punto !== -1 ? '.' : ',';
    var partes = s.split(sep);
    var miles = partes.length > 2 || partes[partes.length - 1].length === 3;
    s = miles ? partes.join('') : partes.join('.');
  }
  var n = parseFloat(s);
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

function CONC_normCedula(v) {
  if (CONC_vacio(v)) return '';
  var s = String(v).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return s.replace(/^0+(?=\d)/, '');
}

function CONC_normNombre(v) {
  if (CONC_vacio(v)) return '';
  var s = String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');
  var t = s.split(/\s+/).filter(function (x) { return x; });
  return t.sort().join(' ');
}
