# Comisiones — qué hay que actualizar (una sola vez)

El botón **Comisiones** lee la hoja Protect con el mismo conector del CRM, pero ahora ese conector
también tiene que traer la columna S (comisión) y guardar las decisiones de los casos especiales.

1. Abra el proyecto de Apps Script del **conector del CRM** (el que ya tiene pegado en «Conexiones»).
2. Reemplace todo el código por el de `conectores/crm/Codigo_crm.gs`.
3. Implementar → Administrar implementaciones → ✏️ → Versión: **Nueva versión** → Implementar
   (Quién tiene acceso: «Cualquier usuario»). La URL no cambia.
4. En el CRM, abra **Comisiones**. Si todo está bien dice «Conectado ✔».

El conector crea solo una pestaña nueva llamada **Comisiones_Config** (decisiones y observaciones).
No modifica las pestañas Protect ni Pagos.

## Reglas del informe
| Forma de pago | Con RC y AP | Sin RC y sin AP |
|---|---|---|
| Contado | $40.000 | $25.000 |
| Financiado | $15.000 | $10.000 |

- Contado con solo RC o solo AP = $40.000; financiado con solo RC = $15.000 (se pagan, pero salen en «Casos especiales» para revisar).
- Financiado con solo AP, forma de pago rara o datos vacíos = **caso especial**: el sistema avisa y usted decide
  si se paga (y cuánto) o no. Hasta decidirlo no deja descargar el informe.
- Los anulados no generan comisión.
- Se paga según la tarifa; si la columna S dice otro valor, lo muestra en «Revisar».

## Informe aparte de Kelli
- Las ventas de Kelli en Protect (hoja normal) y las pólizas de **Clientes OMS** salen en la pestaña «Informe de Kelli» y no en el informe general.
- Clientes OMS: contado $40.000, financiado $15.000. El SOAT no paga comisión y no entra.
- Los **anulados y cancelados no cuentan** (Protect y OMS), en los dos informes.
- Para que cuenten sus pólizas OMS, agregue la columna **Asesor** AL FINAL de la hoja «Historico polizas» y escriba el asesor (el formulario «Registrar cliente nuevo» de OMS ya trae el campo Asesor).
- Hay que pegar de nuevo y publicar «Nueva versión» en el conector del **CRM** (crm-3) y en el de **OMS**.

## Histórico
- Con **💾 Guardar en el histórico** el informe queda guardado (pestaña nueva «Comisiones_Historico» de la hoja de Google). Cada guardado es una versión nueva; nada se borra.
- En la pestaña **📚 Histórico guardado** se puede descargar de nuevo cualquier mes (PDF, Excel resumen o Excel detalle), tal como se firmó.
