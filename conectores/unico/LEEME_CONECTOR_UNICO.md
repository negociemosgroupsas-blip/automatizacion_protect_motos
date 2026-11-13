# Conector único (un solo Google Apps Script)

1. Entre a script.google.com → **Nuevo proyecto** → nómbrelo «Protect Motos – Conector único».
2. Borre todo y pegue el contenido de `Codigo_UNICO.gs`. Guarde.
3. Ejecute la función **AUTORIZAR_TODO** una vez y acepte los permisos (Hojas de cálculo y Drive).
4. Implementar → **Nueva implementación** → Aplicación web → Ejecutar como: **Yo** · Acceso: **Cualquier usuario** → Implementar. Copie la URL (termina en /exec).
5. En el sistema: pestaña **Conexiones** → «Conector único» → pegue la URL → **Usar en todo el sistema** → **Probar los 5 conectores**.

Cuando haya que actualizar el código: pegue el nuevo y use Implementar → Administrar implementaciones → ✏️ → **Nueva versión** (así la URL no cambia).

Los conectores viejos siguen funcionando mientras no cambie las URLs; no se borró nada. `construir.py` regenera `Codigo_UNICO.gs` a partir de las carpetas cobros, crm, oms, soat, contratos y conciliacion.
