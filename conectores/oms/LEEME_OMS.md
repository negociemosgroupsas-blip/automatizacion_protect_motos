# Clientes OMS — cómo ponerlo a funcionar

1. Abre el Google Sheet **Historico polizas** (clientes OMS).
2. Extensiones → Apps Script. Borra todo y pega el contenido de `Codigo_oms.gs`. Guarda.
   (Si el Sheet se llama distinto, cambia `SHEET_NOMBRE` en el código o pega su ID en `SHEET_ID`.)
3. Implementar → Nueva implementación (o Administrar implementaciones → lápiz → Nueva versión) → Aplicación web. Ejecutar como: **Yo**. Acceso: **Cualquier usuario**. Copia la URL (termina en `/exec`).
4. En el CRM, botón **Clientes OMS** → pega la URL → **Guardar**.

No se cobra: el botón avisa cuando a un cliente le toca renovar al año (8 días antes) para volver a hablarle por WhatsApp.
Columnas que lee: Nombre completo, Cedula, Vehiculo, Valor a pagar, Celular, Compra (Financiado / Contado), Fecha inicio, Fecha fin, Estado.
Crea sola la pestaña `Gestiones_OMS` (mensajes enviados, renovó, no renovará).

Desde el botón **Clientes OMS** puedes **➕ Registrar cliente**: el formulario escribe la fila nueva en la hoja (copia el formato de la
fila anterior). Para que funcione, publica el código como **Nueva versión** (Implementar → Administrar implementaciones → lápiz).
