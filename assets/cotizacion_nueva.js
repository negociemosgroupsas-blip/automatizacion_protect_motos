/* PROTECT MOTOS — Cotizador para CLIENTES NUEVOS (no renovaciones).
   Usa las mismas reglas del cotizador de Contratos (assets/cotizador_core.js → opcionesNueva), el mismo documento PDF/imagen
   (assets/cotizacion_doc.js) y guarda en la hoja «Cotizaciones Clientes Nuevos». Nada se envía solo. */
(function(w){
  'use strict';
  var d = document;
  var LS = function(k){ try{ return localStorage.getItem(k)||''; }catch(e){ return ''; } };
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function cop(n){ return '$'+Math.round(Number(n)||0).toLocaleString('es-CO'); }
  function num(v){ return Number(String(v||'').replace(/[^0-9]/g,''))||0; }
  function $(id){ return d.getElementById(id); }
  function numWA(c){ var x=String(c||'').replace(/\D/g,''); return (x.indexOf('57')===0 && x.length>10) ? x : '57'+x; }

  var cnt = 0, guardada = null, editado = false, REFS = [];
  function llamar(params){
    return new Promise(function(ok, mal){
      var url = LS('pm_crm_url'), tok = LS('pm_crm_token')||'PM-CRM-2026';
      if(!url){ mal(new Error('Falta la URL del conector (pestaña Conexiones → Conector único).')); return; }
      cnt++;
      var cb = 'pm_cn_'+Date.now()+'_'+cnt, s = d.createElement('script'), fin = false;
      var t = setTimeout(function(){ if(fin) return; fin=true; limpiar(); mal(new Error('El conector no respondió a tiempo.')); }, 25000);
      function limpiar(){ clearTimeout(t); try{ delete w[cb]; }catch(e){ w[cb]=undefined; } if(s.parentNode) s.parentNode.removeChild(s); }
      w[cb] = function(r){ if(fin) return; fin=true; limpiar(); ok(r); };
      s.onerror = function(){ if(fin) return; fin=true; limpiar(); mal(new Error('No se pudo contactar el conector.')); };
      var q = 'token='+encodeURIComponent(tok)+'&callback='+cb;
      Object.keys(params).forEach(function(k){ q += '&'+encodeURIComponent(k)+'='+encodeURIComponent(params[k]); });
      s.src = url + (url.indexOf('?')<0?'?':'&') + q;
      d.body.appendChild(s);
    }).then(function(r){
      if(!r || r.ok===false){ var m=(r&&r.error)||'Respuesta inválida.'; if(/Acción no disponible/.test(m)) m='El conector todavía no es la versión crm-7: pega el código nuevo (Codigo_UNICO.gs) y publica «Nueva versión».'; throw new Error(m); }
      return r; });
  }
  function setSt(t,k){ var e=$('cn_st'); if(e){ e.textContent=t; e.className='cn-st '+(k||''); } }

  function aseguradora(){ var a=$('cn_ase').value; return a==='Otra' ? ($('cn_otra').value.trim()||'Otra') : a; }
  function lineasCob(id){ return $(id).value.split('\n').map(function(t){return t.trim();}).filter(Boolean); }
  function cargarCob(){
    $('cn_otral').style.display = $('cn_ase').value==='Otra' ? '' : 'none';
    $('cn_man').style.display = $('cn_ase').value==='Protect Motos' ? 'none' : '';
    var a = aseguradora();
    $('cn_cb1').value = PMCotDoc.coberturas(a,'op1').join('\n');
    $('cn_cb2').value = PMCotDoc.coberturas(a,'op2').join('\n');
    recalcular();
  }

  function refActual(){ var n=$('cn_ref').value; for(var i=0;i<REFS.length;i++) if(REFS[i].nombre===n) return REFS[i]; return null; }
  function leer(){
    var plz = Number($('cn_plz').value), usada = $('cn_estado').value==='USADA', ref = refActual(), propia = $('cn_ase').value==='Protect Motos';
    var valor = num($('cn_valor').value), O = PMCot.opcionesNueva(valor, plz, {esp:ref, usada:usada}), op1, op2;
    if(propia){ var cero = {contado:0,cuota:0,total:0,primera:0,resto:0}; op1 = O?O.op1:cero; op2 = O?O.op2:cero; }
    else{
      var m = function(a,b){ var c=num($(a).value), q=num($(b).value); return {contado:c, cuota:q, total:q*plz, primera:q, resto:q}; };
      op1 = m('cn_m1c','cn_m1q'); op2 = m('cn_m2c','cn_m2q');
    }
    return { nombre:$('cn_nom').value.trim(), celular:$('cn_cel').value.trim(), cedula:$('cn_ced').value.trim(), placa:$('cn_pla').value.trim(), moto:$('cn_moto').value.trim(),
      valor:valor, plazo:plz, usada:usada, ref:(ref&&!usada)?ref:null, aseguradora:aseguradora(), propia:propia, op1:op1, op2:op2, cubre:O?O.cubre:0,
      rc:O?O.rc:PMCot.RC_DEFECTO, ap:O?O.ap:PMCot.AP_DEFECTO, listo:propia ? !!O : (op1.contado>0 && op2.contado>0) };
  }
  function lineaFin(o, plazo){ return o.primera!==o.resto ? ('1ª cuota '+cop(o.primera)+' y '+(plazo-1)+' cuotas de '+cop(o.resto)+' (total '+cop(o.total)+')') : (plazo+' cuotas de '+cop(o.cuota)+' (total '+cop(o.total)+')'); }
  function mensaje(q){
    return '¡Hola, '+q.nombre+'! 😊\nTe escribimos de Protect Motos.\n\n'+
      'Te compartimos la cotización de la garantía para tu moto'+(q.moto?' '+q.moto:'')+(q.placa?' de placa '+q.placa:'')+(q.aseguradora!=='Protect Motos'?' con '+q.aseguradora:'')+'.\n\n'+
      '💛 *Opción 1 · Hurto o pérdida total'+(q.propia?' (cubre el 80 %)':'')+'*\n• De contado: '+cop(q.op1.contado)+'\n• Financiado a '+q.plazo+' meses: '+lineaFin(q.op1,q.plazo)+'\n\n'+
      '💙 *Opción 2 · Hurto / pérdida total + responsabilidad civil + asistencias*\n• De contado: '+cop(q.op2.contado)+'\n• Financiado a '+q.plazo+' meses: '+lineaFin(q.op2,q.plazo)+'\n\n'+
      'Te adjuntamos la cotización con todas las coberturas. ¿Te gustaría que avancemos? Respóndenos y lo dejamos listo 💙';
  }
  function resumenOp(o, plz){ return 'contado <b>'+cop(o.contado)+'</b> · '+plz+' cuotas'+(o.primera!==o.resto?' (1ª de <b>'+cop(o.primera)+'</b>, luego <b>'+cop(o.resto)+'</b>)':' de <b>'+cop(o.cuota)+'</b>')+' · total <b>'+cop(o.total)+'</b>'; }
  function recalcular(){
    guardada = null;
    var ref = refActual(), usada = $('cn_estado').value==='USADA';
    $('cn_refaviso').textContent = ref ? (usada ? 'La moto es USADA: no aplica el precio especial, se cotiza por el valor de la moto.' : 'Precio especial de la referencia '+ref.nombre+': no hace falta el valor de la moto.') : '';
    var q = leer();
    if(!q.listo){ $('cn_res').innerHTML = q.propia ? 'Escribe el <b>valor de la moto</b> (o elige una referencia con precio especial) para calcular.' : 'Escribe los valores de la aseguradora.'; return; }
    $('cn_res').innerHTML = (q.propia ? (q.ref ? 'Precio especial <b>'+esc(q.ref.nombre)+'</b>' : 'Valor de la moto <b>'+cop(q.valor)+'</b> · contado 7,5 % · financiado '+(q.plazo===3?9:q.plazo===6?10:12)+' %')+'<br>' : '')+
      '<b>Opción 1</b> (hurto o pérdida total): '+resumenOp(q.op1,q.plazo)+'<br><b>Opción 2</b> (+ RC + asistencias): '+resumenOp(q.op2,q.plazo)+(q.propia?'':'<br><i>Valores escritos a mano para '+esc(q.aseguradora)+'.</i>');
    if(!editado) $('cn_txt').value = mensaje(q);
  }
  function datosDoc(q){ return { tipo:'nueva', id:guardada||'', nombre:q.nombre, placa:q.placa, moto:q.moto, aseguradora:q.aseguradora, plazo:q.plazo, op1:q.op1, op2:q.op2, cubre:q.cubre, rc:q.rc, ap:q.ap, cob1:lineasCob('cn_cb1'), cob2:lineasCob('cn_cb2') }; }
  function validar(q, conCel){
    if(!q.nombre){ setSt('Falta el nombre del cliente.','mal'); return false; }
    if(!q.listo){ setSt('Faltan los valores para calcular la cotización.','mal'); return false; }
    if(conCel && num(q.celular)<7){ setSt('Falta el celular del cliente para abrir WhatsApp.','mal'); return false; }
    return true;
  }
  function hacerDoc(tipo){
    var q = leer(); if(!validar(q,false)) return; var dd = datosDoc(q);
    if(tipo==='pdf'){ if(!PMCotDoc.imprimir(dd)) setSt('El navegador bloqueó la ventana. Permite las ventanas emergentes de este sistema y vuelve a pulsar.','mal'); else setSt('Se abrió la cotización: elige «Guardar como PDF» como impresora y guarda el archivo.','bien'); return; }
    setSt('Creando la imagen…');
    PMCotDoc.png(dd).then(function(blob){ var a=d.createElement('a'); a.href=URL.createObjectURL(blob); a.download='Cotizacion_'+(q.placa||q.nombre.split(' ')[0])+'.png'; d.body.appendChild(a); a.click(); a.remove(); setSt('Imagen descargada. Adjúntala en el chat de WhatsApp.','bien'); })
      .catch(function(e){ setSt('No se pudo crear la imagen ('+e.message+'). Usa el PDF.','mal'); });
  }
  function guardar(){
    var q = leer(); if(!validar(q,false)) return Promise.reject();
    if(guardada){ setSt('Esta cotización ya quedó guardada ('+guardada+').','bien'); return Promise.resolve(guardada); }
    setSt('Guardando…'); $('cn_gua').disabled = true;
    var obs = 'Cotizado con '+q.aseguradora+(q.ref?' · precio especial '+q.ref.nombre:'')+' · Op.1 hurto/pérdida total: contado '+cop(q.op1.contado)+' / '+q.plazo+' cuotas, total '+cop(q.op1.total)+' · Op.2 (+RC +asistencias): contado '+cop(q.op2.contado)+' / '+q.plazo+' cuotas, total '+cop(q.op2.total);
    return llamar({action:'cotRen_guardar', tipo:'nueva', nombre:q.nombre, cedula:q.cedula, placa:q.placa, moto:q.moto, factura:q.valor, estadoMoto:q.usada?'USADA':'NUEVA',
      contado:q.op1.contado, financiado:q.op1.total, plazo:q.plazo, contrato:q.celular, obs:obs}).then(function(r){
      guardada = r.id; setSt('Cotización guardada: '+r.id+' (estado Pendiente).','bien'); $('cn_gua').disabled = false;
      if(w.PMCotRen && w.PMCotRen.panelRefrescar) w.PMCotRen.panelRefrescar(); return r.id;
    }).catch(function(e){ setSt(e.message,'mal'); $('cn_gua').disabled=false; throw e; });
  }
  function copiar(){
    var t = $('cn_txt').value; function ok(){ setSt('Mensaje copiado. Pégalo en WhatsApp.','bien'); }
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(ok, function(){ $('cn_txt').select(); d.execCommand('copy'); ok(); }); } else { $('cn_txt').select(); d.execCommand('copy'); ok(); }
  }
  function abrirWA(){
    var q = leer(); if(!validar(q,true)) return;
    if(!w.confirm('¿Abrir WhatsApp con el mensaje para '+q.nombre+'?\n\nEl mensaje NO se envía solo: tú lo revisas, adjuntas el PDF o la imagen y le das enviar. Si la cotización no está guardada, se guardará ahora como Pendiente.')) return;
    var ir = function(){ w.open('https://wa.me/'+numWA(q.celular)+'?text='+encodeURIComponent($('cn_txt').value), '_blank'); };
    if(guardada){ ir(); return; } guardar().then(ir, function(){});
  }
  function limpiar(){
    ['cn_nom','cn_cel','cn_ced','cn_pla','cn_moto','cn_valor','cn_m1c','cn_m1q','cn_m2c','cn_m2q'].forEach(function(i){ $(i).value=''; });
    $('cn_estado').value='NUEVA'; $('cn_ref').value=''; $('cn_plz').value='12'; editado=false; guardada=null; setSt(''); recalcular(); $('cn_nom').focus();
  }

  function iniciar(cont){
    REFS = PMCot.refs();
    cont.innerHTML =
      '<div class="cn-g">'+
      '<label>Nombre del cliente *<input id="cn_nom" autocomplete="off"></label>'+
      '<label>Celular (WhatsApp) *<input id="cn_cel" inputmode="tel" autocomplete="off" placeholder="3001234567"></label>'+
      '<label>Cédula (opcional)<input id="cn_ced" autocomplete="off"></label>'+
      '<label>Placa (opcional)<input id="cn_pla" autocomplete="off"></label>'+
      '<label>Estado de la moto<select id="cn_estado"><option>NUEVA</option><option>USADA</option></select></label>'+
      '<label>Referencia con precio especial<select id="cn_ref"><option value="">— Ninguna: cotizar por el valor de la moto —</option>'+REFS.map(function(r){ return '<option value="'+esc(r.nombre)+'">'+esc(r.nombre)+(r.marca?' ('+esc(r.marca)+')':'')+'</option>'; }).join('')+'</select></label>'+
      '<label>Marca / referencia de la moto<input id="cn_moto" autocomplete="off" placeholder="Ej.: YAMAHA FZ 150"></label>'+
      '<label>Valor de la moto<input id="cn_valor" inputmode="numeric" autocomplete="off" placeholder="$ 11.499.000"></label>'+
      '<label>Plazo financiado<select id="cn_plz"><option value="3">3 meses</option><option value="6">6 meses</option><option value="12" selected>12 meses</option></select></label>'+
      '<label>¿Con qué aseguradora va?<select id="cn_ase"><option>Protect Motos</option><option>Sura</option><option>Otra</option></select></label>'+
      '<label id="cn_otral" style="display:none">Nombre de la aseguradora<input id="cn_otra" placeholder="Ej.: Mundial"></label>'+
      '</div>'+
      '<p class="cn-nota" id="cn_refaviso"></p>'+
      '<div id="cn_man" style="display:none"><p class="cn-nota"><b>Valores de la aseguradora</b> (escríbelos como te los dio la aseguradora)</p><div class="cn-g">'+
      '<label>Opción 1 · valor de contado<input id="cn_m1c" inputmode="numeric" placeholder="$"></label><label>Opción 1 · valor de cada cuota<input id="cn_m1q" inputmode="numeric" placeholder="$"></label>'+
      '<label>Opción 2 · valor de contado<input id="cn_m2c" inputmode="numeric" placeholder="$"></label><label>Opción 2 · valor de cada cuota<input id="cn_m2q" inputmode="numeric" placeholder="$"></label></div></div>'+
      '<div class="cn-cuadro" id="cn_res">Escribe el valor de la moto (o elige una referencia con precio especial) para calcular.</div>'+
      '<details style="margin:6px 0 10px"><summary style="cursor:pointer;font-weight:700">Coberturas que salen en el PDF (puedes editarlas)</summary>'+
      '<div class="cn-g" style="margin-top:8px"><label>Opción 1 · una cobertura por línea<textarea id="cn_cb1" rows="6"></textarea></label><label>Opción 2 · una cobertura por línea<textarea id="cn_cb2" rows="6"></textarea></label></div>'+
      '<p class="cn-nota">Se guardan para la próxima cotización con esta aseguradora. <a href="#" id="cn_rest">Restaurar las originales</a></p></details>'+
      '<label class="cn-lbl">Mensaje de WhatsApp (puedes editarlo)</label><textarea class="cn-msg" id="cn_txt"></textarea>'+
      '<div class="cn-st" id="cn_st"></div>'+
      '<div class="cn-bar"><button class="cn-b o" id="cn_pdf" type="button">📄 Cotización en PDF</button><button class="cn-b o" id="cn_img" type="button">🖼️ Cotización en imagen</button>'+
      '<button class="cn-b" id="cn_gua" type="button">Guardar cotización</button><button class="cn-b g" id="cn_cop" type="button">Copiar mensaje</button><button class="cn-b v" id="cn_wa" type="button">Abrir WhatsApp</button><button class="cn-b g" id="cn_new" type="button">🆕 Nueva cotización</button></div>'+
      '<p class="cn-nota">Para enviarla: descarga el PDF o la imagen, abre WhatsApp con el botón verde y adjunta el archivo. Nada se envía solo.</p>';
    ['cn_nom','cn_cel','cn_ced','cn_pla','cn_moto','cn_valor','cn_plz','cn_estado','cn_ref','cn_ase','cn_otra','cn_m1c','cn_m1q','cn_m2c','cn_m2q'].forEach(function(id){ $(id).addEventListener('input', recalcular); $(id).addEventListener('change', recalcular); });
    $('cn_ref').addEventListener('change', function(){ var r=refActual(); if(r){ $('cn_moto').value=[r.marca, r.nombre].filter(Boolean).join(' '); } recalcular(); });
    $('cn_ase').addEventListener('change', cargarCob); $('cn_otra').addEventListener('change', cargarCob);
    ['cn_cb1','cn_cb2'].forEach(function(id){ $(id).addEventListener('change', function(){ var a=aseguradora(); if($('cn_ase').value==='Otra' && !$('cn_otra').value.trim()) return; PMCotDoc.guardarCoberturas(a, id==='cn_cb1'?'op1':'op2', lineasCob(id)); }); });
    $('cn_rest').onclick = function(e){ e.preventDefault(); PMCotDoc.restaurarCoberturas(aseguradora()); cargarCob(); };
    $('cn_txt').addEventListener('input', function(){ editado = true; });
    $('cn_pdf').onclick = function(){ hacerDoc('pdf'); }; $('cn_img').onclick = function(){ hacerDoc('img'); };
    $('cn_gua').onclick = function(){ guardar().catch(function(){}); }; $('cn_cop').onclick = copiar; $('cn_wa').onclick = abrirWA; $('cn_new').onclick = limpiar;
    cargarCob();
  }
  w.PMCotNueva = { iniciar:iniciar, _mensaje:mensaje };
})(window);
