# Clientes OMS — cómo ponerlo a funcionar

1. Abre el Google Sheet **Historico polizas** (clientes OMS).
2. Extensiones → Apps Script. Borra todo y pega el contenido de `Codigo_oms.gs`. Guarda.
3. Implementar → Nueva implementación → Aplicación web. Ejecutar como: **Yo**. Acceso: **Cualquier usuario**. Copia la URL (termina en `/exec`).
4. En el CRM, botón **Clientes OMS** → pega la URL → **Guardar**.
5. Para subir comprobantes de pago: en el editor elige la función `pruebaDrive`, pulsa Ejecutar y acepta los permisos de Drive (una sola vez).

Columnas que lee (por el nombre del título): Nombre completo, Cedula, Vehiculo, Valor a pagar, Celular, Compra (FINANCIADO / Contado), Fecha inicio, Fecha fin, Estado (Activo / Cancelado / Finalizado).
Crea solas las pestañas `Pagos_OMS` y `Gestiones_OMS`. Cambiar el estado escribe en la columna Estado.
