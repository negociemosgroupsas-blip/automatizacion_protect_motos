# Clientes OMS: pagos con comprobante (conector oms-4)

1. Abra el proyecto de Apps Script **"clientes OMS"**, borre todo el código y pegue `Codigo_oms.gs`. Guarde.
2. Arriba elija la función **autorizarPermisos**, toque ▶ Ejecutar y acepte los permisos (Drive y Hojas).
3. Implementar → Administrar implementaciones → ✏️ → **Nueva versión** → Implementar (acceso «Cualquier usuario»).
4. Compruebe: `URL/exec?action=ping&token=PM-OMS-2026` debe decir `"version":"oms-4"`.

Qué crea solo:
- Pestaña **Pagos_OMS** en la hoja (fecha, referencia, cédula, cliente, concepto, valor, nota, quién lo registró, enlace al comprobante).
- Carpeta **Comprobantes de pago OMS** en su Drive, con una subcarpeta por cliente.
No toca la hoja de clientes ni ninguna otra.
