# Protect Motos — Plataforma centralizada

Abre `index.html` con doble clic (Chrome). Guarda la carpeta completa en el computador (no solo el archivo).

```
index.html                  Plataforma: menú lateral + resumen de inicio
assets/logo.png
modulos/
  cobros.html               Sistema de Cobros           (idéntico a Protect_Motos_Cobros.html, v. rama practical-cray)
  conciliacion.html         Conciliación / Consolidación (idéntico a Protect_Motos_Consolidacion_Sencillo.html)
  contratos.html            Generador de contratos       (idéntico a Protect_Motos_Automatizador_2.html)
conectores/                 Códigos de Google Apps Script (sin cambios; se publican igual que antes)
  cobros/Codigo_cobros.gs
  conciliacion/PASO_1_pegar_en_Codigo.gs, PASO_2_pegar_en_Sin_titulo.gs
  contratos/Codigo_conector.gs
```

## Cómo se integró (sin tocar los módulos)
Cada módulo se muestra en su propio marco (iframe) dentro de la plataforma. Los HTML y los `.gs` están **sin modificar**, por eso conservan
sus cálculos, tokens, conectores JSONP, hojas (Protect, Pagos, Gestiones, Consolidado, RC, AP, Codigos Fasecolda) y su caché local.
Los módulos se cargan al abrirlos por primera vez y quedan vivos al cambiar de menú (no pierden lo que estabas haciendo ni su auto-actualización).

Claves de `localStorage` de cada módulo (no chocan entre sí): Cobros `pm_cobros_*`; Conciliación `conc_*`; Contratos `pm_gsurl`, `pm_refs`, `pm_fasedb`.

## Datos compartidos
Los tres usan el mismo Sheet `1WMR0VhN…` (hoja **Protect**): Contratos crea el cliente → Cobros lo ve (Estado col. AR, pagos) →
Conciliación lo cruza con Consolidado (escribe col. C de Protect). Cada módulo lee la hoja al pulsar «Actualizar datos» o por su auto-actualización.

## Primer uso
1. Abre `index.html`. 2. En cada módulo pega una vez la URL de su conector y pulsa Guardar (si ya la habías guardado en ese Chrome, aparece sola).
3. El Inicio muestra un resumen de clientes (activos/finalizados/cancelados) usando la URL de Cobros.

Las copias antiguas en la raíz (`Protect_Motos_Cobros.html`, `Codigo_cobros.gs`) no se modificaron; la versión vigente es la de `modulos/` y `conectores/`.

## Búsqueda global y alertas (Inicio)
- **Búsqueda** (barra superior, siempre visible): por cédula, placa, nombre o N° de contrato. Abre una ficha con datos del contrato, cuotas pagadas, pagos registrados y estado de consolidación. Solo lee datos; no escribe en las hojas. Usa las URLs de Cobros y Conciliación ya guardadas en el navegador.
- **Alertas de Conciliación** (Inicio): faltan por consolidar, pagaron de menos, pagaron de más (revisar valor) y ya consolidados. Se calculan con el modo rápido del conector de Conciliación (no escribe en las hojas).
- Botón «↻ Actualizar» vuelve a leer ambos conectores.

## Actualización automática
El Inicio (gráficas, moto, alertas y búsqueda) vuelve a leer Cobros y Conciliación cada 60 segundos mientras la pestaña está visible, y al volver a ella si pasó más de un minuto. La hora de la última lectura aparece junto a «Actualizar». Los módulos mantienen su propia actualización (Cobros: cada 1 min; Conciliación: la que elijas en su selector). Contratos no se actualiza solo para no borrar lo que se está escribiendo.


## Conector del CRM (proyecto nuevo, solo lectura)
Para no tocar el conector de Cobros que ya funciona, el Inicio del CRM lee sus datos de un **proyecto de Apps Script nuevo**: `conectores/crm/Codigo_crm.gs`.
- Solo lee las hojas Protect y Pagos. No escribe, no usa Drive y no cambia los otros conectores.
- Publicar: script.google.com → Nuevo proyecto → pegar el código → Implementar → Nueva implementación → Aplicación web (Ejecutar como: Yo · Acceso: Cualquier usuario).
- Pegar la URL (termina en /exec) en el CRM, pestaña **Conexiones**, y pulsar *Guardar* y *Probar conexión*.
- `conectores/cobros/Codigo_cobros.gs` quedó idéntico al original: no hay que volver a publicarlo.
