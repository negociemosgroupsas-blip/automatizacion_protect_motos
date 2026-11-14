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
  w.PMCot = { opciones:opciones, cotizar:cotizar, valorAGarantizar:valorAGarantizar, pct:pct, RC_DEFECTO:RC_DEFECTO, AP_DEFECTO:AP_DEFECTO };
})(window);
