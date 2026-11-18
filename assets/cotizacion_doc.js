/* PROTECT MOTOS — Documento de la cotización de renovación (PDF / imagen).
   Construye una hoja carta con el logo, los datos del cliente, las dos opciones (contado y financiado) y las coberturas.
   El PDF se genera con «Imprimir → Guardar como PDF» del navegador (igual que los contratos); la imagen se dibuja localmente. */
(function(w){
  'use strict';
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function cop(n){ return '$'+Math.round(Number(n)||0).toLocaleString('es-CO'); }

  /* ---- Coberturas por defecto (se pueden editar en el formulario y quedan guardadas en el navegador) ---- */
  /* Formato de cada línea: «Texto» = una cobertura simple · «Texto | valor» = cobertura con su valor ·
     «Texto | límite | deducible % | deducible SMMLV» = fila de la tabla de condiciones · «— Título —» = nuevo bloque.
     Marcas: {V80} = lo que cubre el 80 %, {RC} = valor de la RC, {AP} = valor de las asistencias. */
  var BASE_PM = ['Pérdida total por hurto','Pérdida total por daños','Cubre el 80 % del valor de la moto'];
  var RC_PM = ['— Responsabilidad civil · Condiciones de cobertura —',
    'Amparo patrimonial | Incluido | Sin deducible | Sin deducible',
    'Daños a bienes de terceros | $100.000.000 | 10 % | 1,0 SMMLV',
    'Lesiones o muerte a una persona | $100.000.000 | 10 % | 1,0 SMMLV',
    'Lesiones o muerte a dos o más personas | $200.000.000 | 10 % | 1,0 SMMLV',
    'Gastos médicos | $200.000 | Sin deducible | Sin deducible',
    'Asistencia jurídica en proceso penal | $10.348.632 | Sin deducible | Sin deducible',
    'Asistencia jurídica en proceso civil | $5.338.580 | Sin deducible | Sin deducible',
    'Muerte accidente de tránsito | $5.000.000 | Sin deducible | Sin deducible'];
  var AP_PM = ['— AP · Accidentes personales —',
    'Muerte accidental | $5.000.000','Incapacidad total por accidente | $5.000.000','Auxilio por pérdida de documentos | $100.000',
    '— Carro taller: todos los servicios · 1 vez cada uno al año —',
    'Grúa por accidente | $300.000','Paso de corriente | $50.000','Suministro de combustible | $50.000','Despinche (llanta sellomática) | $50.000'];
  var SURA = ['Responsabilidad Civil Extracontractual (límite global): $840.000.000','Deducible pérdida total por daños: 10 %, mínimo 0 SMMLV','Deducible pérdida parcial por daños: deducible único 0,5 SMMLV','Deducible pérdida total por hurto: 10 %, mínimo 0 SMMLV','Deducible pérdida parcial por hurto: deducible único 0,5 SMMLV','Deducible ante eventos de la naturaleza (temblor, terremoto): deducible único 0,5 SMMLV','Amparo patrimonial: sí cubre','Asistencia jurídica en procesos penales y civiles: sí cubre','Asistencia en viaje: asistencia de motos'];
  var DEFECTO = {
    'Protect Motos': { op1: BASE_PM, op2: ['Todo lo de la Opción 1','Responsabilidad civil','Asistencias y Carro taller'].concat(RC_PM).concat(AP_PM) },
    'Sura': { op1: SURA.slice(1,5).concat([SURA[7]]), op2: SURA }
  };
  var CLAVE = 'pm_cot_cobert3';
  function leerGuardadas(){ try{ return JSON.parse(localStorage.getItem(CLAVE)||'{}')||{}; }catch(e){ return {}; } }
  function coberturas(aseg, op){
    var g = leerGuardadas(), k = aseg+'|'+op;
    if(g[k] && g[k].length) return g[k];
    var d = DEFECTO[aseg] || DEFECTO['Protect Motos'];
    return (d[op]||[]).slice();
  }
  function guardarCoberturas(aseg, op, lista){ var g = leerGuardadas(); g[aseg+'|'+op] = lista; try{ localStorage.setItem(CLAVE, JSON.stringify(g)); }catch(e){} }
  function restaurarCoberturas(aseg){ var g = leerGuardadas(); delete g[aseg+'|op1']; delete g[aseg+'|op2']; try{ localStorage.setItem(CLAVE, JSON.stringify(g)); }catch(e){} }

  /* ---- Plan de salud (regalo por llevar la Opción 2): una línea por beneficio; se guarda en el navegador ---- */
  var CLAVE_PLAN = 'pm_cot_plansalud';
  function planSalud(){ try{ var g = JSON.parse(localStorage.getItem(CLAVE_PLAN)||'null'); if(g && g.length) return g; }catch(e){} return []; }
  function guardarPlanSalud(lista){ try{ localStorage.setItem(CLAVE_PLAN, JSON.stringify((lista||[]).filter(Boolean))); }catch(e){} }

  /* ---- Estilos del documento (limpio: lo esencial arriba, el detalle de coberturas en la segunda hoja) ---- */
  var CSS = [
    '@page{size:letter;margin:6mm}',
    '*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    'body{margin:0;background:#fff;color:#13223f;font-family:Arial,Helvetica,sans-serif}',
    '.doc{font-family:Arial,Helvetica,sans-serif;width:794px;margin:0 auto;padding:16px 22px 14px;font-size:12px;line-height:1.3;color:#fff;border-radius:22px;position:relative;overflow:hidden;',
      'background:radial-gradient(circle at 92% 3%,rgba(255,255,255,.26),rgba(255,255,255,0) 32%),radial-gradient(circle at 3% 60%,rgba(255,255,255,.14),rgba(255,255,255,0) 30%),linear-gradient(165deg,#0b63c9 0%,#1596e0 52%,#0a4fae 100%)}',
    '.sup{display:flex;justify-content:space-between;align-items:center;gap:12px}',
    '.logo{background:#fff;border-radius:999px;padding:5px 16px;display:flex;align-items:center;box-shadow:0 3px 10px rgba(0,0,0,.18)} .logo img{height:44px;width:auto;display:block}',
    '.fecha{font-size:12px;text-align:right;line-height:1.4} .fecha b{display:block;font-size:12.5px}',
    '.titulo{margin-top:10px;background:#0b2a6b;border-radius:18px 18px 18px 4px;padding:10px 20px;box-shadow:0 4px 12px rgba(0,0,0,.22);display:flex;justify-content:space-between;align-items:center;gap:12px}',
    '.titulo small{display:block;font-size:11px;letter-spacing:.3em;opacity:.85;font-weight:700} .titulo b{display:block;font-size:25px;line-height:1.1;font-weight:900;margin:1px 0 0}',
    '.titulo .der{text-align:right} .titulo .cl{font-size:16px;font-weight:800;color:#ffd54a} .titulo .mt{font-size:12.5px;opacity:.95;margin-top:1px}',
    '.hola{margin:8px 6px 0;font-size:13px}',
    '.op{margin-top:9px;background:#fff;color:#13223f;border-radius:18px;overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,.2);page-break-inside:avoid}',
    '.op h3{margin:0;background:#0b2a6b;color:#fff;padding:7px 16px;font-size:13.5px;letter-spacing:.3px;border-radius:0 0 16px 0;display:inline-block;max-width:96%}',
    '.op h3 small{font-weight:400;color:#ffd54a;margin-left:8px;font-size:12px}',
    '.pre{display:grid;grid-template-columns:1fr 1.15fr;gap:8px;padding:8px 12px 6px}',
    '.pre>div{border-radius:14px;padding:8px 14px}',
    '.pre>div:first-child{background:#ffc928;color:#0b2a6b} .pre>div:last-child{background:#e3f2fd;color:#0b2a6b}',
    '.pre span{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;font-weight:800;opacity:.85} .pre b{display:block;font-size:23px;line-height:1.1;margin:2px 0 0;font-weight:900} .pre small{display:block;font-size:11px;opacity:.9}',
    '.chips{padding:0 12px 9px;display:flex;flex-wrap:wrap;gap:4px 6px}',
    '.chips div{display:flex;gap:6px;align-items:center;font-size:11px;background:#eef6ff;border-radius:999px;padding:2px 10px 2px 4px;color:#0b2a6b} .chips i{flex:0 0 15px;height:15px;border-radius:50%;background:#0b63c9;color:#fff;font-style:normal;font-size:10px;text-align:center;line-height:15px}',
    /* coberturas dentro de la opción 2 (en la misma hoja) */
    '.rg{margin-top:9px;background:linear-gradient(135deg,#fff3c4,#ffd04d);color:#0b2a6b;border-radius:18px;padding:9px 16px 10px;box-shadow:0 4px 12px rgba(0,0,0,.2)}',
    '.rg .rt{display:flex;align-items:center;gap:10px} .rg .ic{font-size:24px;line-height:1} .rg b{font-size:14.5px;letter-spacing:.3px} .rg small{display:block;font-size:11.5px;font-weight:700;opacity:.8}',
    '.rg .ri{display:flex;flex-wrap:wrap;gap:4px 6px;margin-top:6px} .rg .ri div{display:flex;gap:6px;align-items:center;font-size:11.5px;background:rgba(255,255,255,.75);border-radius:999px;padding:2px 11px 2px 5px} .rg .ri i{flex:0 0 15px;height:15px;border-radius:50%;background:#0b2a6b;color:#ffd04d;font-style:normal;font-size:10px;text-align:center;line-height:15px}',
    '.cob{display:grid;grid-template-columns:1.55fr 1fr;gap:8px;padding:0 12px 10px;align-items:start}',
    '.cob .dc{background:#f5f9ff;color:#0b2a6b;border-radius:14px;overflow:hidden;padding-bottom:6px;border:1px solid #dbe8f8}',
    '.cob .dc h4{margin:0 0 4px;background:#0b63c9;color:#fff;padding:5px 12px;font-size:11px;letter-spacing:.4px;text-transform:uppercase}',
    '.dc .f3{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:3px;margin:0 8px 2px;font-size:10.5px} .dc .f3 span{background:#fff;border-radius:999px;padding:2px 8px;line-height:1.2;display:flex;align-items:center} .dc .f3 span+span{justify-content:center;text-align:center;font-weight:700}',
    '.dc .f3.h span{background:none;color:#0b63c9;font-weight:800;font-size:10px;justify-content:center;padding:1px 0} .dc .f3.h span:first-child{justify-content:flex-start}',
    '.dc .f2{display:flex;justify-content:space-between;gap:6px;margin:0 8px 2px;background:#fff;border-radius:999px;padding:2px 10px;font-size:10.5px} .dc .f2 b{white-space:nowrap}',
    '.dc .tl{margin:4px 8px 4px;background:#fff6d6;border:1px solid #f0cf6a;color:#7a4b00;border-radius:10px;padding:3px 10px;font-size:10.5px} .dc .tl b{color:#b45309;display:block;font-size:11px}',
    '.cta{margin-top:9px;display:flex;align-items:center;justify-content:space-between;gap:12px;background:#0b2a6b;border-radius:18px;padding:8px 18px;box-shadow:0 4px 12px rgba(0,0,0,.22)}',
    '.cta b{font-size:16px;letter-spacing:.3px} .cta .ph{background:#fff;color:#0b2a6b;border-radius:999px;padding:5px 16px;font-weight:900;font-size:15px;white-space:nowrap}',
    '.pie{margin-top:8px;display:flex;justify-content:space-between;align-items:center;gap:12px;background:#fff;color:#13223f;border-radius:999px;padding:4px 20px;font-size:11px}',
    '.pie img{height:30px;width:auto;display:block}'
  ].join('');

  function celdaFin(o, plazo){
    if(o.primera !== o.resto) return '<b>'+cop(o.primera)+'</b><small>1ª cuota y luego '+(plazo-1)+' de '+cop(o.resto)+'</small>';
    return '<b>'+plazo+' × '+cop(o.cuota)+'</b><small>Total '+cop(o.total)+'</small>';
  }
  function conValores(t, d){ return String(t).replace(/\{V80\}/g, d.cubre?cop(d.cubre):'').replace(/\{RC\}/g, cop(d.rc||152857)).replace(/\{AP\}/g, cop(d.ap||47000)); }
  /* separa una lista de coberturas: las líneas simples (van en la tarjeta) y los bloques con detalle (van en la segunda hoja) */
  function partes(lista, d){
    var chips = [], secs = [], cur = null;
    (lista||[]).forEach(function(t0){
      var t = conValores(t0, d).trim(); if(!t) return;
      if(/^—.*—$/.test(t)){ cur = { titulo:t.replace(/—/g,'').trim(), filas:[] }; secs.push(cur); return; }
      var c = t.split('|').map(function(x){ return x.trim(); });
      if(!cur) chips.push(c[0].replace(/:\s*$/,'')); else cur.filas.push(c);
    });
    return { chips:chips, secs:secs };
  }
  function ded(c){ var a = c[2]||'', b = c[3]||''; if(/^sin deducible$/i.test(a) && /^sin deducible$/i.test(b)) return 'Sin deducible'; return [a,b].filter(Boolean).join(' · '); }
  function seccion(sc){
    if(/^carro taller/i.test(sc.titulo)) return '<div class="tl"><b>🛵 Carro taller</b>'+esc(sc.titulo.replace(/^carro taller:?\s*/i,''))+'</div>'+filasHtml(sc.filas);
    var tabla = sc.filas.some(function(c){ return c.length>=3; });
    return '<h4>'+esc(sc.titulo)+'</h4>'+(tabla?'<div class="f3 h"><span>Cobertura</span><span>Límite asegurado</span><span>Deducible</span></div>':'')+filasHtml(sc.filas);
  }
  function filasHtml(filas){
    return filas.filter(function(c){ return !/^valor total/i.test(c[0]); }).map(function(c){
      if(c.length>=3) return '<div class="f3"><span>'+esc(c[0])+'</span><span>'+esc(c[1])+'</span><span>'+esc(ded(c))+'</span></div>';
      if(c.length===2) return '<div class="f2"><span>'+esc(c[0])+'</span><b>'+esc(c[1])+'</b></div>';
      return '<div class="f2"><span>'+esc(c[0])+'</span></div>';
    }).join('');
  }

  /* d: {fecha,id,nombre,placa,moto,aseguradora,plazo,op1:{contado,primera,resto,cuota,total},op2:{...},cob1:[],cob2:[]} */
  function html(d){
    var logo = w.PM_LOGO || '';
    var fecha = d.fecha || new Date().toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'});
    var p1 = partes(d.cob1, d), p2 = partes(d.cob2, d);
    var chips = function(a){ return a.length ? '<div class="chips">'+a.map(function(t){ return '<div><i>✓</i><span>'+esc(t)+'</span></div>'; }).join('')+'</div>' : ''; };
    var op = function(n, titulo, sub, o, pp, conCob){
      var cob = '';
      if(conCob && pp.secs.length){
        var rc = pp.secs.filter(function(x){ return !/^(ap|carro)/i.test(x.titulo); }), ot = pp.secs.filter(function(x){ return /^(ap|carro)/i.test(x.titulo); });
        cob = '<div class="cob"><div class="dc">'+rc.map(seccion).join('')+'</div>'+(ot.length?'<div class="dc">'+ot.map(seccion).join('')+'</div>':'')+'</div>';
        if(!ot.length) cob = cob.replace('grid-template-columns','grid-template-columns');
      }
      var regalo = '';
      return '<div class="op"><h3>OPCIÓN '+n+' · '+esc(titulo)+(sub?'<small>'+esc(sub)+'</small>':'')+'</h3>'+
        '<div class="pre"><div><span>De contado</span><b>'+cop(o.contado)+'</b></div>'+
        '<div><span>Financiado a '+d.plazo+' meses</span>'+celdaFin(o, d.plazo)+'</div></div>'+chips(pp.chips)+regalo+cob+'</div>';
    };
    var primer = String(d.nombre||'').split(' ')[0];
    return '<div class="doc">'+
      '<div class="sup"><div class="logo">'+(logo?'<img alt="Protect Motos" src="'+logo+'">':'<b style="color:#0b2a6b;font-size:20px">PROTECT MOTOS</b>')+'</div>'+
      '<div class="fecha"><b>'+esc(fecha)+'</b>'+(d.id?'N.º '+esc(d.id):'')+'</div></div>'+
      '<div class="titulo"><div><small>'+(d.tipo==='nueva'?'GARANTÍA':'RENOVACIÓN')+'</small><b>COTIZACIÓN</b></div><div class="der"><div class="cl">'+esc(d.nombre)+'</div><div class="mt">'+esc([d.moto,d.placa].filter(Boolean).join(' · '))+' · Respaldo: '+esc(d.aseguradora)+'</div></div></div>'+
      '<p class="hola">Hola, '+esc(primer)+'. Estas son tus opciones'+(d.tipo==='nueva'?' de protección:':' para renovar:')+'</p>'+
      op(1,'Hurto o pérdida total',(d.aseguradora==='Protect Motos'?'cubre el 80 %':''),d.op1,p1,false)+
      op(2,'Hurto o pérdida total + RC + Asistencias','',d.op2,p2,true)+
      regaloHtml(d)+
      '<div class="cta"><b>¡CONTÁCTANOS HOY!</b><div class="ph">📞 312 880 68 73</div></div>'+
      '<div class="pie">'+(logo?'<img alt="Protect Motos" src="'+logo+'">':'<b>PROTECT MOTOS</b>')+'<div>protectmotos@gmail.com</div></div>'+
      '</div>';
  }
  function regaloHtml(d){
    var L = d.salud || [];
    return '<div class="rg"><div class="rt"><span class="ic">🎁</span><div><b>¡DE REGALO POR LLEVAR LA OPCIÓN 2! · PLAN DE SALUD</b><small>'+(L.length?'Incluye:':'Pregunta a tu asesor por todos sus beneficios.')+'</small></div></div>'+
      (L.length?'<div class="ri">'+L.map(function(t){ return '<div><i>✓</i><span>'+esc(t)+'</span></div>'; }).join('')+'</div>':'')+'</div>';
  }
  function pagina(d){
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cotización - '+esc(d.nombre)+(d.placa?' - '+esc(d.placa):'')+'</title><style>'+CSS+'</style></head><body>'+html(d)+'</body></html>';
  }

  /* PDF: se abre la hoja y se lanza «Imprimir» (elija «Guardar como PDF») */
  function imprimir(d){
    var v = w.open('', '_blank');
    if(!v){ return false; }
    v.document.open(); v.document.write(pagina(d)); v.document.close();
    var lanzar = function(){ try{
      /* una sola hoja carta: si el documento es más alto o ancho que la hoja, se reduce para que quepa */
      var doc = v.document.querySelector('.doc'); if(doc){ var h = doc.offsetHeight, z = Math.min(1, 1000/h, 765/794); if(z<1) doc.style.zoom = String(Math.round(z*1000)/1000); }
      v.focus(); v.print(); }catch(e){} };
    if(v.document.readyState === 'complete') setTimeout(lanzar, 400); else v.onload = function(){ setTimeout(lanzar, 400); };
    return true;
  }

  /* Imagen PNG (para enviar por WhatsApp como foto) */
  function png(d){
    return new Promise(function(ok, mal){
      var host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-10000px;top:0;';
      host.innerHTML = '<style>'+CSS+'</style>'+html(d);
      document.body.appendChild(host);
      var nodo = host.querySelector('.doc'), W = 794, H = nodo.offsetHeight + 4;
      var xml = new XMLSerializer().serializeToString(nodo);
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>'+CSS+'</style>'+xml+'</div></foreignObject></svg>';
      document.body.removeChild(host);
      var img = new Image();
      img.onload = function(){
        try{
          var c = document.createElement('canvas'); c.width = W*2; c.height = H*2;
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0,0,c.width,c.height); x.scale(2,2); x.drawImage(img,0,0);
          c.toBlob(function(b){ b ? ok(b) : mal(new Error('No se pudo crear la imagen.')); }, 'image/png');
        }catch(e){ mal(e); }
      };
      img.onerror = function(){ mal(new Error('No se pudo dibujar la imagen.')); };
      img.src = 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    });
  }

  w.PMCotDoc = { planSalud:planSalud, guardarPlanSalud:guardarPlanSalud, html:html, pagina:pagina, imprimir:imprimir, png:png, coberturas:coberturas, guardarCoberturas:guardarCoberturas, restaurarCoberturas:restaurarCoberturas, DEFECTO:DEFECTO };
})(window);
