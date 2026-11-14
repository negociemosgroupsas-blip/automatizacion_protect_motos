/* PROTECT MOTOS — Modo oscuro / modo día para los módulos (SOAT y Clientes OMS).
   Un botón flotante cambia el tema y se acuerda de la elección (también entre los dos módulos). Solo cambia colores. */
(function(){
  var K='pm_tema_modulo', body=document.body;
  function leer(){ try{ return localStorage.getItem(K)!=='dia'; }catch(e){ return true; } }   // por defecto oscuro, igual que el Inicio; «dia» solo si la persona lo eligió
  var css=document.createElement('style');
  css.textContent=[
    'body.pm-oscuro{--suave:#a3b4d8;--azul2:#2a3b70;--fondo:#0a1124;--tarjeta:#131d38;--texto:#e8eefc;--texto-suave:#a3b4d8;--borde:#2a3b70;--azul:#aebff0;--azul-claro:#2a3b70;--verde-bg:#0f3d33;--rojo-bg:#4a1d24;--naranja-bg:#4a3510;--azulinfo-bg:#16264f;--azulinfo:#8fb0ff;color-scheme:dark}',
    'body.pm-oscuro header,body.pm-oscuro .barra-sup,body.pm-oscuro .cabecera-app{background:#0e1632!important;border-bottom:1px solid #1f2e5b}',
    'body.pm-oscuro .btn-azul{background:#2f4690;color:#fff} body.pm-oscuro .btn-gris{background:#1b2850;color:#e8eefc}',
    'body.pm-oscuro .btn-oro{color:#1a1200}',
    'body.pm-oscuro input,body.pm-oscuro select,body.pm-oscuro textarea{background:#0d1530;color:#e8eefc;border-color:#2f4284}',
    'body.pm-oscuro select option{background:#0f1830;color:#e8eefc}',
    'body.pm-oscuro th{background:#1b2850;color:#dbe5ff} body.pm-oscuro tbody tr:hover{background:#1b2850} body.pm-oscuro td{border-color:#25376b}',
    'body.pm-oscuro .chips button{background:#0d1530;color:#e8eefc;border-color:#2f4284} body.pm-oscuro .chips button.act{background:#2f4690;color:#fff}',
    'body.pm-oscuro .tarjeta-contador,body.pm-oscuro .panel,body.pm-oscuro .dcard,body.pm-oscuro .acciones-top,body.pm-oscuro .modal{background:#131d38;border-color:#25376b}',
    'body.pm-oscuro .tarjeta-contador .valor,body.pm-oscuro .dcard h3,body.pm-oscuro .dash-top h2,body.pm-oscuro h2,body.pm-oscuro h3{color:#fff}',
    'body.pm-oscuro .d-sub,body.pm-oscuro .sub,body.pm-oscuro .etiqueta{color:#a3b4d8}',
    'body.pm-oscuro .estado-conexion.ok{color:#6ee7b7}',
    /* tablero de SOAT */
    'body.pm-oscuro .svg-d .t-s{fill:#a3b4d8} body.pm-oscuro .svg-d .t-v,body.pm-oscuro .svg-d .t-n,body.pm-oscuro .svg-d text.t-gn{fill:#fff} body.pm-oscuro .svg-d .grid{stroke:#2a3b70}',
    'body.pm-oscuro .svg-d .t-g{stroke:#131d38}',
    'body.pm-oscuro .gauge-n{fill:#fff} body.pm-oscuro .gauge-s{fill:#a3b4d8} body.pm-oscuro .dona-leg i[style*="#13223f"]{background:#6f8fe0!important} body.pm-oscuro .dona-leg b,body.pm-oscuro .dona-leg span{color:#e8eefc} body.pm-oscuro .dona-leg .p{color:#a3b4d8}',
    'body.pm-oscuro .svg-d [fill="#13223f"]{fill:#6f8fe0} body.pm-oscuro .svg-d [fill="#fff"]{fill:#131d38}',
    'body.pm-oscuro .tipo-band,body.pm-oscuro .dash-top select,body.pm-oscuro .dcard .d-sel{background:#0d1530}',
    /* tablero de Clientes OMS */
    'body.pm-oscuro .od-top h2{color:#fff} body.pm-oscuro .od-top label,body.pm-oscuro .od-fil label{color:#a3b4d8}',
    'body.pm-oscuro .od-top select,body.pm-oscuro .od-fil select{background:#0d1530;color:#e8eefc;border-color:#2f4284}',
    'body.pm-oscuro .od-card{background:linear-gradient(180deg,#17224a,#111a36);border-color:#25376b;box-shadow:0 8px 24px rgba(0,0,0,.30)} body.pm-oscuro .od-card h3{color:#fff}',
    'body.pm-oscuro .od-sub,body.pm-oscuro .od-ayuda,body.pm-oscuro .od-mute,body.pm-oscuro .od-rk,body.pm-oscuro .od-rq,body.pm-oscuro .od-rq2,body.pm-oscuro .od-ts,body.pm-oscuro .od-leg2,body.pm-oscuro .od-leg .p,body.pm-oscuro .od-gs{color:#a3b4d8;fill:#a3b4d8}',
    'body.pm-oscuro .od-tv,body.pm-oscuro .od-gn,body.pm-oscuro .od-tsa{fill:#fff!important} body.pm-oscuro .od-leg b,body.pm-oscuro .od-r b,body.pm-oscuro .od-rn{color:#fff}',
    'body.pm-oscuro .od-grid{stroke:#2a3b70} body.pm-oscuro .od-base{stroke:#3a4d85} body.pm-oscuro .od-tg{stroke:#111a36}',
    'body.pm-oscuro .od-parts div,body.pm-oscuro .od-tiles div{background:#1b2850} body.pm-oscuro .od-parts b,body.pm-oscuro .od-tiles b{color:#fff} body.pm-oscuro .od-parts span,body.pm-oscuro .od-tiles span{color:#a3b4d8}',
    'body.pm-oscuro .od-rp,body.pm-oscuro .od-band{background:#0d1530} body.pm-oscuro .od-rb[style*="#13223f"]{background-color:#6f8fe0!important}',
    'body.pm-oscuro .od-svg circle[fill="#fff"]{fill:#131d38}',
    'body.pm-oscuro .od-svg circle[stroke="#13223f"]{stroke:#6f8fe0} body.pm-oscuro .od-leg i[style*="#13223f"]{background:#6f8fe0!important} body.pm-oscuro .svg-d circle[stroke="#13223f"]{stroke:#6f8fe0} body.pm-oscuro .d-leg i[style*="#13223f"]{background:#6f8fe0!important}',
    /* Comisiones, Cobros y precobros y Conciliación: fondos blancos que no son de impresión */
    'body.pm-oscuro .btn{background:#2f4690;color:#fff} body.pm-oscuro .btn.g{background:#1b2850;color:#e8eefc} body.pm-oscuro .btn.d{background:#d6a417;color:#13223f}',
    'body.pm-oscuro .tab{background:#131d38;border-color:#25376b;color:#c9d6ff} body.pm-oscuro .tab.act,body.pm-oscuro .tab.on,body.pm-oscuro .tab.activo{background:#2f4690;color:#fff;border-color:#2f4690}',
    'body.pm-oscuro .drop{background:#0d1530;border-color:#3b4f8f} body.pm-oscuro .drop:hover,body.pm-oscuro .drop.on{background:#16224a} body.pm-oscuro .drop *{color:#c9d6ff}',
    'body.pm-oscuro .t,body.pm-oscuro .rcard,body.pm-oscuro .caso,body.pm-oscuro .mm-w,body.pm-oscuro .ficha-inline,body.pm-oscuro .persona,body.pm-oscuro .ficha,body.pm-oscuro .vcard,body.pm-oscuro .fdet,body.pm-oscuro .decision{background:#131d38;border-color:#25376b;color:#e8eefc;box-shadow:none}',
    'body.pm-oscuro .caso.dec{background:#0f2a2a} body.pm-oscuro .rfrase{background:#16224a;color:#dbe5ff} body.pm-oscuro .titulo-lista,body.pm-oscuro .dato,body.pm-oscuro .persona th{background:#1b2850;color:#dbe5ff;border-color:#25376b}',
    'body.pm-oscuro .busqueda input,body.pm-oscuro .mm-f select,body.pm-oscuro .pagos input.contrato{background:#0d1530;color:#e8eefc;border-color:#2f4284} body.pm-oscuro .pagos{background:#16224a;border-color:#3b4f8f}',
    'body.pm-oscuro .alerta,body.pm-oscuro .aviso,body.pm-oscuro .alr{background:#3a2a10;border-color:#7a5b00;color:#ffe4a3} body.pm-oscuro .alerta,body.pm-oscuro .alr{background:#3a1a1f;border-color:#7a2a35;color:#ffc9cf}',
    'body.pm-oscuro .panel{color:#e8eefc} body.pm-oscuro .menos td,body.pm-oscuro .noenc td,body.pm-oscuro tr.alerta td{background:#2a1a22}',
    'body.pm-oscuro .callout.gris{background:#1b2850;color:#c9d6ff} body.pm-oscuro .pago-botones button{background:#0d1530;color:#c9d6ff;border-color:#3b4f8f}',
    'body.pm-oscuro #hoja,body.pm-oscuro .inf,body.pm-oscuro .infk{background:#fff;color:#1f2430;--texto:#1f2430;--azul:#13223f}   /* los informes para imprimir siguen en blanco */',
    '#pmTemaBtn{position:fixed;left:14px;bottom:14px;z-index:9998;border:1px solid #c9d1e4;background:#fff;color:#13223f;border-radius:999px;padding:8px 14px;font:700 .82rem system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2)}',
    'body.pm-oscuro #pmTemaBtn{background:#1b2850;color:#fff;border-color:#3b4f8f}',
    '@media print{#pmTemaBtn{display:none!important}}'
  ].join('\n');
  document.head.appendChild(css);
  var b=document.createElement('button'); b.id='pmTemaBtn'; b.type='button'; b.title='Cambiar entre modo día y modo oscuro';
  function pintar(){ var o=body.classList.contains('pm-oscuro'); b.textContent=o?'☀️ Modo día':'🌙 Modo oscuro'; }
  function aplicar(o){ body.classList.toggle('pm-oscuro',o); pintar(); if(window.dispatchEvent) setTimeout(function(){ window.dispatchEvent(new Event('resize')); },30); }
  b.addEventListener('click',function(){ var o=!body.classList.contains('pm-oscuro'); try{ localStorage.setItem(K,o?'oscuro':'dia'); }catch(e){} aplicar(o); });
  window.addEventListener('storage',function(ev){ if(ev.key===K) aplicar(leer()); });
  body.appendChild(b); aplicar(leer());
})();
