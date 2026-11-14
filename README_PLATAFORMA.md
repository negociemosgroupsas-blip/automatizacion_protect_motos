# Protect Motos — Sistema de gestión (guía de la plataforma)

Abra `index.html` con doble clic (Chrome o Edge). **Guarde la carpeta completa** en el computador (no solo el archivo).

## Mapa del sistema

```
index.html                    Plataforma: menú lateral + Inicio (panel ejecutivo)
assets/
  cotizador_core.js           Reglas del cotizador de renovación (mismas de Contratos)
  cotizacion_renov.js         Botón ENVIAR COTIZACIÓN + panel de cotizaciones
  cotizacion_nueva.js         Formulario del Cotizador (clientes nuevos)
  cotizacion_doc.js           Cotización en PDF / imagen (2 opciones, contado y financiado, coberturas por aseguradora)
  logo_data.js                Logo incrustado para el PDF
  dash_oms.js                 Tablero de Clientes OMS
  tema_modulo.js              Modo oscuro / día de los módulos
  xlsx.mini.min.js, pptxgen.bundle.js, zip_simple.js, logo*.png
modulos/                      Un archivo por botón del menú
  contratos.html              OPERACIÓN · cotiza, genera e imprime el contrato y lo guarda en la hoja
  cobros.html                 OPERACIÓN · cuotas, pagos, renovaciones, cotizaciones de renovación
  precobros.html              OPERACIÓN · lee el precobro del proveedor y pone asesor y N.º de contrato
  conciliacion.html           OPERACIÓN · cruza Protect contra el Consolidado de pagos
  cotizador.html              OPERACIÓN · cotizaciones para CLIENTES NUEVOS (mismo cotizador de Contratos, PDF/imagen/WhatsApp, hoja «Cotizaciones Clientes Nuevos»)
  banco.html                  OPERACIÓN · Verificación bancaria: lee la hoja de Google del banco (acción banco_leer, crm-9; el ID de la hoja va en BANCO_SHEET_ID dentro del código) y la compara con la hoja Pagos por fecha y valor, con el cliente al frente
  erp.html                    OPERACIÓN · Cruce semanal ERP (clientes ERP-Protect): archivo del jefe vs hoja Protect (cédula + Total vs columna P)
  oms.html / soat.html        SEGUROS · clientes OMS y SOAT (cobros, primer pago, renovaciones, tablero)
  comisiones.html             GESTIÓN · informe de comisiones de asesores (mensual, anual, histórico)
conectores/
  unico/Codigo_UNICO.gs       ⭐ UN SOLO Apps Script con todo (recomendado) — se genera con unico/construir.py
  cobros/ crm/ oms/ soat/ contratos/ conciliacion/   Los conectores originales (siguen siendo la fuente del único)
```

## Menú (organizado por tarea)
**Inicio** · **Operación**: Contratos, Cotizador, Cobros, Cobros y precobros, Conciliación, Cruce semanal ERP, Verificación bancaria · **Seguros**: Clientes OMS, SOAT ·
**Gestión**: Comisiones · **Sistema**: Conexiones.

## Inicio = panel gerencial
1. Tarjetas de resumen (contratos del mes vs meta, RC, SOAT, clientes activos, por consolidar).
2. **Resumen gerencial**: contratos del mes (con proyección al cierre), acumulado del año vs año anterior, valor contratado,
   mezcla financiada, cancelaciones y comisiones del mes — cada uno comparado con el período anterior.
3. **Atención requerida**: contratos por vencer, SOAT y OMS por renovar, pendientes de consolidar, comisiones sin decidir.
4. Secciones plegables: Ventas y contratos · Clientes y seguros · Conciliación · SOAT · Clientes OMS · Comisiones · Renovaciones
   (tres gráficas: Protect/Cobros, pólizas OMS y SOAT — mensajes enviados vs renovaron).

## Paleta de gráficas (igual en todo el sistema)
Cian `#38bdf8` (series y barras) · Oro `#fdc33e` (destacado, mes actual, contado) · Azul `#5b78c7` (financiado) · Azul claro `#9fb8e8` · Naranja `#e08a00` · Verde `#1f9d55` (activo, positivo) · Rojo `#dc2626` (cancelado, alerta). Es la misma del Inicio y se aplica en Clientes OMS, SOAT, Conciliación, Comisiones y Cobros.

## Conexión con Google (un solo conector)
1. Nuevo proyecto en script.google.com → pegar `conectores/unico/Codigo_UNICO.gs` → ejecutar **AUTORIZAR_TODO** una vez.
2. Implementar → Aplicación web (Ejecutar como: Yo · Acceso: Cualquier usuario) → copiar la URL `/exec`.
3. En el sistema: **Conexiones → Conector único → Usar en todo el sistema → Probar los 5 conectores**.
4. Para actualizar: pegar el código nuevo y publicar **Nueva versión** sobre la misma implementación (la URL no cambia).
5. Otro computador: **Conexiones → Cargar mis conexiones** (archivo guardado antes con «Guardar mis conexiones»).

Claves (tokens) por módulo: Cobros `PM-COBROS-2026` · CRM `PM-CRM-2026` · OMS `PM-OMS-2026` · SOAT `PM-SOAT-2026` · Contratos `PM-9K3ZQ-2026` · Conciliación (token propio).
El conector único elige el módulo según la clave, por eso los módulos no cambian.

## Datos compartidos
Sheet «Seguimiento Protec Motos 2026 ACTUAL»: **Protect** (contratos) · **Pagos** · **Gestiones** · **Consolidado**. Hojas que crea el sistema solo:
`Comisiones_Config`, `Comisiones_Historico`, `Cotizaciones Renovación`, `Conciliacion_Dugo`, `Historial_Consolidacion`, `Asignaciones_Pagos`, `Ajustes_Manuales`.
Separadas: «Historico polizas» (OMS), «Historico Soat» (SOAT), Responsabilidad Civil, Accidentes Personales.

## Reglas de negocio vigentes
- **Cotizador** (Contratos y renovaciones): contado 7,5 % del valor de la moto; financiado 9 % (3 m), 10 % (6 m), 12 % (12 m); RC $152.857, AP $47.000.
- **Renovación**: valor a garantizar = el menor entre (factura anterior ÷ 1,1) y (Fasecolda actual ÷ 1,1).
- **Comisiones**: contado con RC/AP $40.000 · contado sin RC ni AP $25.000 · financiado con RC $15.000 · financiado sin RC $10.000; anulados y cancelados no pagan; SOAT no genera comisión; Kelli suma pólizas OMS.
- **Renovaciones con precio fijo**: las ADX usan precios fijos (hurto/pérdida total contado $887.940 y 12 × $92.493; con RC y AP contado $1.087.797, primera cuota $292.351 y 11 × $92.493). Se editan en el formulario de cotización («Precios fijos de renovación por moto»).
- **Pago**: al registrar un pago el sistema avisa si pagó bien, de menos o de más (tolerancia $1.000).

## Pruebas rápidas antes de mostrar a gerencia
1. Conexiones → «Probar los 5 conectores» (todos deben responder).
2. Inicio → «Resumen gerencial» y «Atención requerida» con números reales.
3. Cobros → Registrar pago (aviso de valor) · ENVIAR COTIZACIÓN · panel «Cotizaciones de renovación».
4. Clientes OMS y SOAT → botón de modo oscuro/día.

## Cuidados
- No borre pestañas ni cambie los nombres de las hojas de Google (los conectores las buscan por nombre).
- Guarde el archivo de conexiones en un lugar privado (contiene las direcciones de sus conectores).
- El espacio de Drive lleno bloquea la subida de comprobantes.
