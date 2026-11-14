/* PROTECT MOTOS — Documento de la cotización de renovación (PDF / imagen).
   Construye una hoja carta con el logo, los datos del cliente, las dos opciones (contado y financiado) y las coberturas.
   El PDF se genera con «Imprimir → Guardar como PDF» del navegador (igual que los contratos); la imagen se dibuja localmente. */
(function(w){
  'use strict';
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function cop(n){ return '$'+Math.round(Number(n)||0).toLocaleString('es-CO'); }

  /* ---- Coberturas por defecto (se pueden editar en el formulario y quedan guardadas en el navegador) ---- */
  var RC_PM = ['Daños a bienes de terceros','Lesiones o muerte a 1 persona','Lesiones o muerte a 2 o más personas','Amparo patrimonial','Muerte accidental (para el conductor)','Asistencia jurídica en proceso penal','Asistencia jurídica en proceso civil','Gastos médicos (hasta 4 eventos)'];
  var AP_PM = ['Muerte accidental: $5.000.000','Incapacidad total por accidente: $5.000.000','Auxilio por pérdida de documentos: $100.000','Grúa por accidente: $300.000','Paso de corriente: $50.000','Suministro de combustible: $50.000','Despinche (llanta sellomática): $50.000'];
  var BASE_PM = ['Pérdida total por hurto','Pérdida total por daños','Cubre el 80 % del valor de la moto'];
  var SURA = ['Responsabilidad Civil Extracontractual (límite global): $840.000.000','Deducible pérdida total por daños: 10 %, mínimo 0 SMMLV','Deducible pérdida parcial por daños: deducible único 0,5 SMMLV','Deducible pérdida total por hurto: 10 %, mínimo 0 SMMLV','Deducible pérdida parcial por hurto: deducible único 0,5 SMMLV','Deducible ante eventos de la naturaleza (temblor, terremoto): deducible único 0,5 SMMLV','Amparo patrimonial: sí cubre','Asistencia jurídica en procesos penales y civiles: sí cubre','Asistencia en viaje: asistencia de motos'];
  var DEFECTO = {
    'Protect Motos': { op1: BASE_PM, op2: BASE_PM.concat(['— Responsabilidad civil —']).concat(RC_PM).concat(['— Asistencias —']).concat(AP_PM) },
    'Sura': { op1: SURA.slice(1,5).concat([SURA[7]]), op2: SURA }
  };
  var CLAVE = 'pm_cot_cobert';
  function leerGuardadas(){ try{ return JSON.parse(localStorage.getItem(CLAVE)||'{}')||{}; }catch(e){ return {}; } }
  function coberturas(aseg, op){
    var g = leerGuardadas(), k = aseg+'|'+op;
    if(g[k] && g[k].length) return g[k];
    var d = DEFECTO[aseg] || DEFECTO['Protect Motos'];
    return (d[op]||[]).slice();
  }
  function guardarCoberturas(aseg, op, lista){ var g = leerGuardadas(); g[aseg+'|'+op] = lista; try{ localStorage.setItem(CLAVE, JSON.stringify(g)); }catch(e){} }
  function restaurarCoberturas(aseg){ var g = leerGuardadas(); delete g[aseg+'|op1']; delete g[aseg+'|op2']; try{ localStorage.setItem(CLAVE, JSON.stringify(g)); }catch(e){} }

  /* ---- Estilos del documento ---- */
  var CSS = [
    '@page{size:letter;margin:12mm}',
    '*{box-sizing:border-box} body{margin:0;background:#fff;color:#1f2430;font-family:Arial,Helvetica,sans-serif}',
    '.doc{width:794px;margin:0 auto;padding:30px 38px;background:#fff;font-size:13px;line-height:1.45}',
    '.cab{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:4px solid #d6a417;padding-bottom:12px}',
    '.cab img{height:78px;width:auto;display:block}',
    '.cab .tit{text-align:right} .cab .tit b{display:block;font-size:24px;letter-spacing:.5px;color:#13223f} .cab .tit span{display:block;color:#5f6882;font-size:12px;margin-top:2px}',
    'p{margin:10px 0}',
    'table{border-collapse:collapse;width:100%}',
    '.cli th{background:#13223f;color:#fff;font-size:11px;letter-spacing:.4px;text-transform:uppercase;padding:8px 10px;border:1px solid #fff;text-align:center}',
    '.cli td{background:#eef1f6;border:1px solid #fff;padding:9px 10px;text-align:center;font-weight:700;color:#13223f;font-size:14px}',
    '.aseg{margin:10px 0 0;display:inline-block;background:#fff3cf;border:1px solid #ecd48a;border-radius:999px;padding:4px 14px;font-weight:700;color:#7a5b00;font-size:12px}',
    '.op{margin-top:16px;border:1px solid #cfd8e8;border-radius:10px;overflow:hidden;page-break-inside:avoid}',
    '.op h3{margin:0;background:#13223f;color:#fff;padding:9px 14px;font-size:14px;letter-spacing:.3px}',
    '.op h3 small{font-weight:400;opacity:.85;margin-left:6px;font-size:12px}',
    '.pre{display:flex;border-bottom:1px solid #e3e8f2} .pre>div{flex:1;padding:10px 14px} .pre>div+div{border-left:1px solid #e3e8f2}',
    '.pre span{display:block;color:#5f6882;font-size:11px;text-transform:uppercase;letter-spacing:.4px;font-weight:700} .pre b{display:block;font-size:22px;color:#13223f;margin:2px 0} .pre small{display:block;color:#4b5563;font-size:12px}',
    '.cob{padding:10px 14px 12px;display:grid;grid-template-columns:1fr 1fr;gap:6px 18px}',
    '.cob div{display:flex;gap:8px;align-items:flex-start;font-size:12.5px} .cob i{flex:0 0 17px;height:17px;border-radius:50%;background:#1f9d55;color:#fff;font-style:normal;font-size:11px;text-align:center;line-height:17px;margin-top:1px}',
    '.cob .sec{grid-column:1/-1;font-weight:800;color:#1f4e79;font-size:12px;letter-spacing:.4px;text-transform:uppercase;border-bottom:1px solid #dbe3f1;margin-top:4px;padding-bottom:2px;display:block}',
    '.nota{margin-top:14px;font-size:11.5px;color:#4b5563}',
    '.pie{margin-top:16px;border-top:2px solid #13223f;padding-top:10px;display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#374151}',
    '.pie b{color:#13223f}'
  ].join('\n');

  function celdaFin(o, plazo){
    if(o.primera !== o.resto) return '<b>'+cop(o.primera)+'</b><small>1ª cuota · luego '+(plazo-1)+' cuotas de '+cop(o.resto)+'</small><small>Total '+cop(o.total)+'</small>';
    return '<b>'+plazo+' × '+cop(o.cuota)+'</b><small>cuotas mensuales</small><small>Total '+cop(o.total)+'</small>';
  }
  function bloqueCob(lista){
    return '<div class="cob">'+lista.map(function(t){
      if(/^—.*—$/.test(t)) return '<div class="sec">'+esc(t.replace(/—/g,'').trim())+'</div>';
      return '<div><i>✓</i><span>'+esc(t)+'</span></div>'; }).join('')+'</div>';
  }

  /* d: {fecha,id,nombre,placa,moto,aseguradora,plazo,garantizar,cubre,op1:{contado,primera,resto,cuota,total},op2:{...},cob1:[],cob2:[],nota} */
  function html(d){
    var logo = w.PM_LOGO || '';
    var fecha = d.fecha || new Date().toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'});
    var op = function(n, titulo, sub, o, cob){
      return '<div class="op"><h3>OPCIÓN '+n+' · '+esc(titulo)+'<small>'+esc(sub)+'</small></h3>'+
        '<div class="pre"><div><span>De contado</span><b>'+cop(o.contado)+'</b><small>Un solo pago</small></div>'+
        '<div><span>Financiado a '+d.plazo+' meses</span>'+celdaFin(o, d.plazo)+'</div></div>'+bloqueCob(cob)+'</div>';
    };
    return '<div class="doc">'+
      '<div class="cab">'+(logo?'<img alt="Protect Motos" src="'+logo+'">':'<b style="font-size:22px">PROTECT MOTOS</b>')+
      '<div class="tit"><b>COTIZACIÓN</b><span>Renovación de garantía · '+esc(fecha)+(d.id?' · N.º '+esc(d.id):'')+'</span></div></div>'+
      '<p><b>'+esc(d.nombre)+'</b>, le damos un cordial saludo.</p>'+
      '<p>De acuerdo con nuestra conversación, le enviamos la información de la renovación para su moto'+(d.moto?' <b>'+esc(d.moto)+'</b>':'')+'. A continuación encontrará dos opciones de cobertura, cada una con su valor de contado y financiado a '+d.plazo+' meses.</p>'+
      '<table class="cli"><thead><tr><th>Nombre del cliente</th><th>Placa</th><th>Moto</th><th>Valor garantizado</th></tr></thead><tbody><tr><td>'+esc(d.nombre)+'</td><td>'+esc(d.placa||'—')+'</td><td>'+esc(d.moto||'—')+'</td><td>'+(d.garantizar?cop(d.garantizar):'—')+'</td></tr></tbody></table>'+
      '<span class="aseg">Respaldo: '+esc(d.aseguradora)+'</span>'+
      op(1,'HURTO O PÉRDIDA TOTAL',(d.aseguradora==='Protect Motos'?'cubre el 80 %':''),d.op1,d.cob1)+
      op(2,'HURTO / PÉRDIDA TOTAL + RESPONSABILIDAD CIVIL + ASISTENCIAS','',d.op2,d.cob2)+
      '<p class="nota">'+esc(d.nota||'Valores en pesos colombianos (COP). Si desea renovar, respóndanos este mensaje y dejamos su garantía lista hoy mismo.')+'</p>'+
      '<div class="pie"><div><b>PROTECT MOTOS</b><br>Negociemos Group S.A.S. · NIT 901.715.327-0</div><div style="text-align:right">protectmotos@gmail.com<br>312 880 68 73</div></div>'+
      '</div>';
  }
  function pagina(d){
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cotización renovación - '+esc(d.nombre)+(d.placa?' - '+esc(d.placa):'')+'</title><style>'+CSS+'</style></head><body>'+html(d)+'</body></html>';
  }

  /* PDF: se abre la hoja y se lanza «Imprimir» (elija «Guardar como PDF») */
  function imprimir(d){
    var v = w.open('', '_blank');
    if(!v){ return false; }
    v.document.open(); v.document.write(pagina(d)); v.document.close();
    var lanzar = function(){ try{ v.focus(); v.print(); }catch(e){} };
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

  w.PMCotDoc = { html:html, pagina:pagina, imprimir:imprimir, png:png, coberturas:coberturas, guardarCoberturas:guardarCoberturas, restaurarCoberturas:restaurarCoberturas, DEFECTO:DEFECTO };
})(window);
