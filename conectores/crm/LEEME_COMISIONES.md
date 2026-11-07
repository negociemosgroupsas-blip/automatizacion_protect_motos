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

- Solo RC o solo AP, forma de pago rara o datos vacíos = **caso especial**: el sistema avisa y usted decide
  si se paga (y cuánto) o no. Hasta decidirlo no deja descargar el informe.
- Los anulados no generan comisión.
- Se paga según la tarifa; si la columna S dice otro valor, lo muestra en «Revisar».
