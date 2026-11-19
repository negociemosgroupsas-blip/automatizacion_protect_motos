/* PROTECT MOTOS — Imagen corporativa: cambia los emojis de títulos, botones, menú e indicadores por íconos de línea de un solo color
   y pone el logo en el encabezado de cada módulo. Solo cambia la presentación: no toca ningún dato. */
(function(w,d){
  'use strict';
  var I = {
    home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
    message:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    coins:'<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2 0 3 5 1.5 5 4.2 0 1.2-1.1 2-2.5 2-1.1 0-2.1-.5-2.6-1.4M12 6.5v1.5M12 16v1.5"/>',
    wallet:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
    table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    bank:'<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>',
    shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    moto:'<circle cx="6" cy="16" r="3"/><circle cx="18" cy="16" r="3"/><path d="M9 16h6l-3-7H9M13 9h4l1 7"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    trend:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5a3 3 0 0 1 0 6M18 14c2 .6 3 2.6 3 6"/>',
    trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4v2a3 3 0 0 0 4 2M16 6h4v2a3 3 0 0 1-4 2"/><path d="M12 13v4M8 20h8"/>',
    bars:'<path d="M5 20V11M12 20V4M19 20v-7"/><path d="M3 20h18"/>',
    flag:'<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    gift:'<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M12 9v12M3 13h18"/><path d="M12 9S9.5 9 8.5 7.5 10 4.5 12 9zm0 0s2.5 0 3.5-1.5S14 4.5 12 9z"/>',
    send:'<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
    alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
    repeat:'<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    refresh:'<path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><path d="M21 4v5h-5M3 20v-5h5"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    download:'<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/>',
    moon:'<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
    pen:'<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 17l-5-5-9 8"/>',
    folder:'<path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
    star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    broom:'<path d="M14 3l7 7"/><path d="M13 7L5 15l4 4 8-8"/><path d="M5 15l-2 6 6-2"/>'
  };
  var MAP = {'🏠':'home','📄':'file','📑':'table','📋':'file','📝':'file','💬':'message','💰':'coins','💵':'wallet','💳':'wallet','🧾':'receipt','✅':'check','☑':'check','✔':'check',
    '🏦':'bank','🛡':'shield','🏍':'moto','🛵':'moto','⚙':'gear','📈':'trend','📉':'trend','📊':'bars','🏆':'trophy','🏅':'trophy','👥':'users','👤':'users','🏁':'flag','🤝':'heart',
    '🎯':'target','📆':'calendar','📅':'calendar','🎁':'gift','📨':'send','📩':'send','✉':'send','⚠':'alert','⛔':'alert','🚫':'alert','🔁':'repeat','🔄':'refresh','⏰':'clock','🕒':'clock','⬇':'download',
    '☀':'sun','🌙':'moon','✍':'pen','🖼':'image','📂':'folder','📎':'folder','🔎':'search','🔍':'search','✨':'star','🧹':'broom','📦':'folder','💼':'bars','🔑':'gear','🔗':'send','📞':'message','🆕':'file','🚦':'flag','🛑':'alert','❌':'alert','✖':'alert','⭐':'star','📌':'flag'};
  var RE = /(?:\p{Extended_Pictographic}|⬇)️?(?:‍\p{Extended_Pictographic}️?)*/gu;
  function icono(emo){
    var k = emo.replace(/️/g,'').replace(/‍.*$/,''), n = MAP[k] || MAP[emo.charAt(0)];
    if(!n || !I[n]) return '';
    return '<svg class="pmi" viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+I[n]+'</svg>';
  }
  var SEL = 'h1,h2,h3,h4,h5,header span,header p,button,summary,.ico,.ic,.in-ki,.in-sec,.tag,.btn,.tab,label.sw,a.btn,.pmcr-b,.cn-b,.chip,.rep-m b,.in-rep button';
  function procesar(root){
    var host = root || d.body; if(!host) return;
    var els = host.querySelectorAll ? [].slice.call(host.querySelectorAll(SEL)) : [];
    if(host.matches && host.matches(SEL)) els.push(host);
    els.forEach(function(el){
      if(el.closest('svg,textarea,option,select,script,style')) return;
      var tw = d.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodos = [], n;
      while((n = tw.nextNode())){ if(n.parentNode && n.parentNode.closest && n.parentNode.closest('svg,textarea,option,script,style')) continue; RE.lastIndex = 0; if(RE.test(n.nodeValue)) nodos.push(n); }
      nodos.forEach(function(nodo){
        var txt = nodo.nodeValue, frag = d.createDocumentFragment(), last = 0, m; RE.lastIndex = 0;
        while((m = RE.exec(txt))){
          if(m.index>last) frag.appendChild(d.createTextNode(txt.slice(last, m.index)));
          var h = icono(m[0]); if(h){ var s = d.createElement('span'); s.className='pmi-w'; s.innerHTML = h; frag.appendChild(s); }
          last = m.index + m[0].length;
        }
        if(last<txt.length) frag.appendChild(d.createTextNode(txt.slice(last)));
        nodo.parentNode.replaceChild(frag, nodo);
      });
    });
  }
  function logoEnEncabezado(){
    var h = d.querySelector('body > header, header.app, header'); if(!h || h.querySelector('img') || h.dataset.pmLogo) return;
    if(d.getElementById('v-inicio')) return;                       // en el Inicio el logo ya está en el menú
    h.dataset.pmLogo = '1';
    var im = d.createElement('img'); im.className = 'pm-hlogo'; im.alt = 'Protect Motos'; im.src = (w.location.pathname.indexOf('/modulos/')>=0 ? '../' : '') + 'assets/logo_menu.png';
    im.onerror = function(){ im.style.display = 'none'; };
    h.insertBefore(im, h.firstChild);
  }
  var t = null;
  function programar(){ clearTimeout(t); t = setTimeout(function(){ procesar(); }, 120); }
  function iniciar(){
    procesar(); logoEnEncabezado();
    try{ new MutationObserver(programar).observe(d.body, {childList:true, subtree:true, characterData:true}); }catch(e){}
  }
  w.PMCorp = { procesar:procesar, iconos:I };
  if(d.readyState === 'loading') d.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})(window, document);
