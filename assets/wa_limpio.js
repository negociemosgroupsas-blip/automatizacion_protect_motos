/* PROTECT MOTOS — Mensajes de WhatsApp sin emojis.
   Los emojis se ven como «�» en algunos celulares/computadores y hacen ver feo el mensaje. Este archivo, cargado en los módulos,
   quita cualquier emoji del texto justo antes de abrir WhatsApp (wa.me), sin importar quién arme el mensaje. */
(function(w){
  var EMO = /(?:[\u2600-\u27BF\u2B50\u2764\u2B06\u2194-\u21AA\u231A-\u23FF\u24C2\u25AA-\u25FE\u2934\u2935\u3030\u303D\u3297\u3299]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])[\uFE0F\u200D]*/g;
  function limpiar(t){
    return String(t==null?'':t).replace(EMO,'').replace(/[\uFE0F\u200D\uFFFD]/g,'').replace(/[ \t]+\n/g,'\n').replace(/[ \t]{2,}/g,' ').replace(/ +([!?.,;:])/g,'$1').trim();
  }
  var abrir = w.open;
  w.open = function(url){
    try{
      if(typeof url==='string' && /^https:\/\/wa\.me\//.test(url) && url.indexOf('?text=')>-1){
        var i = url.indexOf('?text='), txt = decodeURIComponent(url.slice(i+6));
        url = url.slice(0,i)+'?text='+encodeURIComponent(limpiar(txt));
      }
    }catch(e){}
    return abrir.apply(w, [url].concat([].slice.call(arguments,1)));
  };
  w.PMWaLimpio = limpiar;
})(window);
