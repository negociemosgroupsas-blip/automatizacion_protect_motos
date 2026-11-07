# Conector de SOAT — cómo ponerlo a funcionar

Funciona con el Google Sheet **«Historico Soat»** (un archivo aparte de «Seguimiento Protec Motos»).

1. Abre ese Google Sheet → Extensiones → Apps Script. Borra todo y pega el contenido de `Codigo_soat.gs`. Guarda.
   (Si tu Sheet se llama distinto, cambia `SHEET_NOMBRE` en el código o pega su ID en `SHEET_ID`.)
2. Implementar → Nueva implementación (o Administrar implementaciones → lápiz → **Nueva versión**) → Aplicación web.
   Ejecutar como: **Yo** · Acceso: **Cualquier usuario**. Google pedirá permisos (hojas de cálculo y Drive): acéptalos.
3. Copia la URL (termina en `/exec`) y pégala en el botón **SOAT** del CRM → Guardar.

Desde el botón SOAT puedes **➕ Registrar SOAT**: el formulario escribe la fila nueva en la hoja (copia el formato de la fila anterior,
el consecutivo «#» y cualquier fórmula que tenga la fila de arriba). Solo escribe en columnas cuyo título reconoce
(Fecha, #, cliente, cedula, placa, Tipo vehículo, Cilindraje, Fecha inicio, Fecha vencimiento, Valor SOAT, Ganancia,
Total consignado, Forma de pago, Celular). Si alguna no existe, el CRM avisa cuál no pudo llenar.
Crea sola la pestaña `Gestiones_Soat` (mensajes enviados, renovó, no renovará).
