/* PROTECT MOTOS — Informe de ventas de SOAT para el jefe: texto (WhatsApp), imagen PNG y PDF.
   Dos formas: «venta» (un cliente) y «resumen» (un día, un mes, un año o todo). La letra Lato va incrustada (viene de informe_diario.js). */
(function(w){
  var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function cop(n){return '$'+Math.round(Number(n)||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
  function fechaLarga(iso){if(!iso)return '';var p=iso.split('-');return +p[2]+' de '+MESES[+p[1]-1]+' de '+p[0];}
  function fechaCorta(iso){if(!iso)return '';var p=iso.split('-');return p[2]+'/'+p[1]+'/'+p[0];}
  var CSS="\
.is{width:760px;background:#fff;color:#13223f;font-family:'LatoInf','Lato',Arial,sans-serif;font-weight:400}\
.is *{box-sizing:border-box;font-family:inherit}\
.is .cab{background:#021346;color:#fff;padding:22px 30px;display:flex;align-items:center;gap:18px;border-bottom:5px solid #fdc33e}\
.is .cab img{height:62px;background:#fff;border-radius:10px;padding:5px}\
.is .cab h1{margin:0;font-size:23px;font-weight:700;line-height:1.2} .is .cab p{margin:3px 0 0;color:#c9d6f6;font-size:15px}\
.is .cuerpo{padding:24px 30px 8px}\
.is .sec{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#6b7a99;font-weight:700;margin:0 0 10px;display:flex;align-items:center;gap:10px}\
.is .sec:after{content:'';flex:1;height:1px;background:#dfe5f1}\
.is .gran{display:flex;gap:12px;margin-bottom:22px}\
.is .k{border-radius:12px;padding:16px 18px;color:#fff;flex:1}\
.is .k span{display:block;font-size:12px;text-transform:uppercase;font-weight:700;letter-spacing:.03em}\
.is .k b{display:block;font-size:30px;line-height:1.1;margin:4px 0 2px;font-weight:700} .is .k small{font-size:14px}\
.is .k.a{background:#1e3a8a} .is .k.b{background:#f0b429;color:#04202e} .is .k.c{background:#5069b8}\
.is .lista{border:1px solid #dfe5f1;border-radius:12px;margin-bottom:22px;overflow:hidden}\
.is .fila{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 18px;border-bottom:1px solid #eef1f7;font-size:16px}\
.is .fila:last-child{border-bottom:0} .is .fila:nth-child(even){background:#f8f9fc}\
.is .fila span{color:#6b7a99;font-size:14px} .is .fila b{font-size:17px;font-weight:700;text-align:right}\
.is table{width:100%;border-collapse:collapse;margin-bottom:22px;font-size:13.5px}\
.is th{background:#021346;color:#fff;text-align:left;padding:8px 10px;font-size:11.5px;text-transform:uppercase;letter-spacing:.03em}\
.is td{padding:8px 10px;border-bottom:1px solid #eef1f7} .is tr:nth-child(even) td{background:#f8f9fc} .is td.n,.is th.n{text-align:right}\
.is tfoot td{background:#eaf1fb;font-weight:700;border-top:2px solid #021346}\
.is .nota{font-size:13px;color:#6b7a99;border-top:1px solid #dfe5f1;padding:14px 30px 20px;line-height:1.45}";
  function envoltura(titulo,sub,cuerpo){
    var logo=w.PM_LOGO||'';
    return '<div class="is"><div class="cab">'+(logo?'<img alt="Protect Motos" src="'+logo+'">':'')+'<div><h1>'+esc(titulo)+'</h1><p>'+esc(sub)+'</p></div></div>'+
      '<div class="cuerpo">'+cuerpo+'</div><div class="nota">Protect Motos · Negociemos Group S.A.S. · Documento de uso interno</div></div>';
  }
  function fila(k,v){return '<div class="fila"><span>'+esc(k)+'</span><b>'+esc(v||'—')+'</b></div>';}
  /* d.tipo==='venta': {s:{…}}   d.tipo==='resumen': {titulo, sub, n, valor, ganancia, total, formas:[[nombre,n,valor]], motos, carros, filas:[s…], mas} */
  function html(d){
    if(d.tipo==='venta'){
      var s=d.s;
      return envoltura('Informe de venta de SOAT','Venta del '+(fechaLarga(s.fechaISO)||'—'),
        '<div class="gran"><div class="k a"><span>Valor del SOAT</span><b>'+cop(s.valor)+'</b></div><div class="k b"><span>Ganancia</span><b>'+cop(s.ganancia)+'</b></div><div class="k c"><span>Total consignado</span><b>'+cop(s.total||((+s.valor||0)+(+s.ganancia||0)))+'</b></div></div>'+
        '<p class="sec">Cliente y vehículo</p><div class="lista">'+
        fila('Cliente',s.cliente)+fila('Documento',((s.tipoDoc||'')+' '+(s.cedula||'')).trim())+fila('Celular',s.celular)+
        fila('Placa',s.placa)+fila('Vehículo',((s.tipo||'')+(s.cilindraje?' · '+s.cilindraje+' cc':'')).trim())+
        fila('Vigencia',(s.inicio&&s.vence)?(s.inicio+'  al  '+s.vence):'')+fila('Forma de pago',s.forma)+'</div>');
    }
    var f=d.formas.map(function(x){return fila(x[0]+' · '+x[1]+' SOAT',cop(x[2]));}).join('');
    var tr=d.filas.map(function(s){return '<tr><td>'+esc(fechaCorta(s.fechaISO))+'</td><td>'+esc(s.cliente)+'</td><td>'+esc(s.placa)+'</td><td class="n">'+cop(s.valor)+'</td><td class="n">'+cop(s.ganancia)+'</td></tr>';}).join('');
    return envoltura('Informe de ventas de SOAT',d.sub,
      '<div class="gran"><div class="k a"><span>SOAT vendidos</span><b>'+d.n+'</b><small>'+d.motos+' motos · '+d.carros+' carros</small></div><div class="k b"><span>Ganancia</span><b>'+cop(d.ganancia)+'</b></div><div class="k c"><span>Total consignado</span><b>'+cop(d.total)+'</b><small>Valor SOAT '+cop(d.valor)+'</small></div></div>'+
      (f?'<p class="sec">Por forma de pago</p><div class="lista">'+f+'</div>':'')+
      '<p class="sec">Ventas del período</p><table><thead><tr><th>Fecha</th><th>Cliente</th><th>Placa</th><th class="n">Valor</th><th class="n">Ganancia</th></tr></thead><tbody>'+tr+'</tbody>'+
      '<tfoot><tr><td colspan="3">Total'+(d.mas?' (incluye '+d.mas+' ventas más no listadas)':'')+'</td><td class="n">'+cop(d.valor)+'</td><td class="n">'+cop(d.ganancia)+'</td></tr></tfoot></table>');
  }
  /* texto listo para pegar en WhatsApp */
  function texto(d){
    var T=['Buenas tardes, Don Camilo.'];
    if(d.tipo==='venta'){
      var s=d.s;
      T.push('Le comparto el informe de la venta de SOAT del '+fechaCorta(s.fechaISO)+':','',
        '* Cliente: '+(s.cliente||'—'),'* Documento: '+(((s.tipoDoc||'')+' '+(s.cedula||'')).trim()||'—'),'* Celular: '+(s.celular||'—'),
        '* Placa: '+(s.placa||'—')+' ('+(((s.tipo||'')+(s.cilindraje?' '+s.cilindraje+' cc':'')).trim()||'—')+')',
        '* Vigencia: '+((s.inicio&&s.vence)?(s.inicio+' al '+s.vence):'—'),
        '* Valor del SOAT: '+cop(s.valor),'* Ganancia: '+cop(s.ganancia),'* Total consignado: '+cop(s.total||((+s.valor||0)+(+s.ganancia||0))),'* Forma de pago: '+(s.forma||'—'));
    }else{
      T.push('Le comparto el informe de ventas de SOAT · '+d.sub+':','',
        '* SOAT vendidos: '+d.n+' ('+d.motos+' motos, '+d.carros+' carros)','* Valor de los SOAT: '+cop(d.valor),'* Ganancia: '+cop(d.ganancia),'* Total consignado: '+cop(d.total));
      d.formas.forEach(function(x){T.push('   - '+x[0]+': '+x[1]+' SOAT · '+cop(x[2]));});
      T.push('','Detalle:');
      d.filas.forEach(function(s){T.push('- '+fechaCorta(s.fechaISO)+' · '+s.cliente+' · '+s.placa+' · '+cop(s.valor)+' · ganancia '+cop(s.ganancia));});
      if(d.mas)T.push('- … y '+d.mas+' ventas más');
    }
    T.push('','Feliz tarde.');return T.join('\n');
  }
  function css(){return ((w.PMInforme&&w.PMInforme.FUENTE)||'')+CSS;}
  function pagina(d,titulo){return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>'+esc(titulo||'Informe SOAT')+'</title><style>@page{size:A4;margin:12mm}body{margin:0;display:flex;justify-content:center;background:#fff}'+css()+'</style></head><body>'+html(d)+'</body></html>';}
  function imprimir(d,titulo){
    var v=w.open('','_blank');if(!v)return false;
    v.document.open();v.document.write(pagina(d,titulo));v.document.close();
    var lanzar=function(){try{v.focus();v.print();}catch(e){}};
    if(v.document.readyState==='complete')setTimeout(lanzar,500);else v.onload=function(){setTimeout(lanzar,500);};
    return true;
  }
  function png(d){
    return new Promise(function(ok,mal){
      var host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;';
      host.innerHTML='<style>'+css()+'</style>'+html(d);document.body.appendChild(host);
      var nodo=host.querySelector('.is'),W=760,H=nodo.offsetHeight+2,xml=new XMLSerializer().serializeToString(nodo);
      document.body.removeChild(host);
      var svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>'+css()+'</style>'+xml+'</div></foreignObject></svg>';
      var img=new Image();
      img.onload=function(){try{var c=document.createElement('canvas');c.width=W*2;c.height=H*2;var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.scale(2,2);x.drawImage(img,0,0);c.toBlob(function(b){b?ok(b):mal(new Error('No se pudo crear la imagen.'));},'image/png');}catch(e){mal(e);}};
      img.onerror=function(){mal(new Error('No se pudo dibujar la imagen.'));};
      img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    });
  }
  w.PMInformeSoat={html:html,texto:texto,imprimir:imprimir,png:png,css:css,pagina:pagina};
})(window);
