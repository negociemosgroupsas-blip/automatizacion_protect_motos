/* PROTECT MOTOS — Reglas del cotizador (fuente única para Renovaciones).
   Son EXACTAMENTE las reglas de modulos/contratos.html (función recalc):
     contado  = valor moto × 7,5 %
     financiado = valor moto × (3 meses 9 % · 6 meses 10 % · 12 meses 12 %), dividido en cuotas
     RC suma 152.857 · AP suma 47.000 (se agregan a lo que se paga en caja)
   Regla de renovación (COTIZADOR_RENOVACIONES.xlsx):
     valor a garantizar = el MENOR entre (factura anterior ÷ 1,1) y (Fasecolda actual ÷ 1,1)
   Una moto en renovación ya no es nueva: no aplican los precios especiales por referencia. */
(function(w){
  var RC_DEFECTO = 152857, AP_DEFECTO = 47000;
  function pct(p){ return p===3 ? 0.09 : p===6 ? 0.10 : 0.12; }
  function valorAGarantizar(factura, fasecolda){
    var f = Number(factura)||0, c = Number(fasecolda)||0;
    var a = f>0 ? f/1.1 : 0, b = c>0 ? c/1.1 : 0;
    if(a>0 && b>0) return Math.round(Math.min(a,b));
    return Math.round(a||b||0);
  }
  // opciones: {rc:bool, ap:bool, valorRC, valorAP}
  function cotizar(valorMoto, o){
    o = o||{};
    var m = Number(valorMoto)||0;
    var RCV = Number(o.valorRC)||RC_DEFECTO, APV = Number(o.valorAP)||AP_DEFECTO;
    var out = { valorMoto:m, rcValor:RCV, apValor:APV, contado:null, financiado:{} };
    if(!(m>0)) return out;
    var base = m*0.075;
    out.contado = { protect:Math.round(base), conRC:Math.round(base+RCV), conAP:Math.round(base+APV), conRCyAP:Math.round(base+RCV+APV) };
    [3,6,12].forEach(function(p){
      var total = m*pct(p), cuota = total/p;
      out.financiado[p] = { plazo:p, total:Math.round(total), cuota:Math.round(cuota),
        primeraConRC:Math.round(cuota+RCV), totalConRC:Math.round(total+RCV),
        cuotaConAP:Math.round(cuota+APV) };
    });
    return out;
  }
  /* Las dos opciones de la cotización de renovación (mismas reglas de Contratos):
       Opción 1 = hurto o pérdida total (cubre el 80 %): contado 7,5 % · financiado 9/10/12 % dividido en cuotas.
       Opción 2 = opción 1 + responsabilidad civil (RC) + asistencias (AP): RC y AP se suman a lo que se paga en caja
                  (contado: una sola vez · financiado: en la primera cuota, como en el cotizador de Contratos). */
  function opciones(valorMoto, plazo, o){
    o = o||{}; plazo = Number(plazo)||12;
    var cz = cotizar(valorMoto, o); if(!cz.contado) return null;
    var f = cz.financiado[plazo] || cz.financiado[12], RC = cz.rcValor, AP = cz.apValor;
    return {
      plazo: f.plazo, rc: RC, ap: AP, cubre: Math.round(cz.valorMoto*0.8), garantizar: cz.valorMoto,
      op1: { contado: cz.contado.protect, cuota: f.cuota, total: f.total, primera: f.cuota, resto: f.cuota },
      op2: { contado: cz.contado.conRCyAP, cuota: f.cuota, total: f.total + RC + AP, primera: f.cuota + RC + AP, resto: f.cuota }
    };
  }
  /* Referencias con PRECIO ESPECIAL (las mismas de Contratos; si allí se editan, quedan en el navegador como «pm_refs» y se usan esas) */
  var REFS_DEFECTO = [
    {nombre:"ADX 175",            fase:"34217031", marca:"SYM",  linea:"TEA50",              cil:"175", anio:"2027", c:890000, m3:964167, m6:1038333, m12:1112500},
    {nombre:"ADX",                fase:"34217027", marca:"SYM",  linea:"TEB40",              cil:"149", anio:"2027", c:887940, m3:961935, m6:1035930, m12:1109925},
    {nombre:"XPULSE 200 4V",      fase:"39517028", marca:"HERO", linea:"XPULSE 200 4V",      cil:"199", anio:"2027", c:743400, m3:805350, m6:867300,  m12:929250},
    {nombre:"XPULSE PRO 4V",      fase:"39517032", marca:"HERO", linea:"XPULSE 200 4V PRO",  cil:"199", anio:"2027", c:809400, m3:876850, m6:944300,  m12:1011750},
    {nombre:"XPULSE RALLY",       fase:"",         marca:"HERO", linea:"XPULSE RALLY",       cil:"199", anio:"2027", c:815400, m3:883350, m6:951300,  m12:1019250},
    {nombre:"XPULSE 200 PROV 2.0",fase:"",         marca:"HERO", linea:"XPULSE 200 PROV 2.0",cil:"199", anio:"2027", c:809400, m3:876850, m6:944300,  m12:1011750},
    {nombre:"NHR-190",            fase:"34217029", marca:"SYM",  linea:"NHR",                cil:"183", anio:"2027", c:745860, m3:808015, m6:870170,  m12:932325}
  ];
  function refs(){ try{ var a = JSON.parse(localStorage.getItem('pm_refs')||'null'); if(a && a.length) return a; }catch(e){} return JSON.parse(JSON.stringify(REFS_DEFECTO)); }
  /* Cotización de un cliente NUEVO — exactamente la regla del cotizador de Contratos (recalc):
       contado = precio especial de la referencia, o valor de la moto × 7,5 %
       financiado = total especial (3/6/12 meses), o valor × 9 / 10 / 12 %, dividido en cuotas
       las motos USADAS no tienen precio especial.
     Opción 1 = hurto o pérdida total · Opción 2 = + RC + AP (en contado una vez; en financiado, en la primera cuota). */
  function opcionesNueva(valor, plazo, o){
    o = o||{}; plazo = Number(plazo)||12; var m = Number(valor)||0;
    var RC = Number(o.valorRC)||RC_DEFECTO, AP = Number(o.valorAP)||AP_DEFECTO, esp = (o.esp && !o.usada) ? o.esp : null, r = Math.round;
    var base = esp ? Number(esp.c) : (m>0 ? m*0.075 : null); if(base==null || !(base>0)) return null;
    var total = esp ? Number(plazo===3?esp.m3:plazo===6?esp.m6:esp.m12) : m*pct(plazo), cuota = total/plazo;
    return { plazo:plazo, rc:RC, ap:AP, garantizar:m, cubre:r(m*0.8), especial:!!esp,
      op1:{ contado:r(base), cuota:r(cuota), total:r(total), primera:r(cuota), resto:r(cuota) },
      op2:{ contado:r(base+RC+AP), cuota:r(cuota), total:r(total+RC+AP), primera:r(cuota+RC+AP), resto:r(cuota) } };
  }
  w.PMCot = { opcionesNueva:opcionesNueva, refs:refs, REFS_DEFECTO:REFS_DEFECTO, opciones:opciones, cotizar:cotizar, valorAGarantizar:valorAGarantizar, pct:pct, RC_DEFECTO:RC_DEFECTO, AP_DEFECTO:AP_DEFECTO };
})(window);
