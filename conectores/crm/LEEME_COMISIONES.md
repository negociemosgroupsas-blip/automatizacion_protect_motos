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
- Las ventas de Kelli (en Protect, SOAT y Clientes OMS) salen en la pestaña «Informe de Kelli» y no en el informe general.
- Clientes OMS: contado $40.000, financiado $15.000. SOAT: el valor por SOAT se escribe en la pantalla (se guarda solo).
- Para que cuenten, agregue la columna **Asesor** al FINAL de las hojas «Historico polizas» y «Historico Soat» y escriba el asesor en las ventas.
- Hay que pegar de nuevo y publicar «Nueva versión» en los conectores de **SOAT** (soat-3) y del **CRM** (crm-2, con la clave cfg). El de OMS también (guarda el asesor al registrar).
