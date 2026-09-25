# Instrucciones de instalación — Sistema de Cobros Protect Motos

## Paso 1 — Crear la pestaña "Pagos" en tu Google Sheet

1. Abre tu archivo (el mismo que usa el generador de contratos, ID `1WMR0VhNg6apQa5BPg4bFoRbMqJNdQQ9f3UdlA2fKb04`).
2. Crea una pestaña nueva llamada exactamente **`Pagos`** (así, sin tildes ni espacios extra).
3. En la fila 1 escribe estos encabezados, uno por columna (A a H):

   `Fecha de pago | N° contrato | Cédula | Cliente | N° de cuota | Valor pagado | Comprobante / nota | Registrado por`

   (Si olvidas crearla, el conector la crea sola con estos encabezados la primera vez que registres un pago.)

## Paso 2 — Publicar el conector (Codigo_cobros.gs)

1. Ve a [script.google.com](https://script.google.com) → **Nuevo proyecto**.
2. Borra el contenido por defecto y pega todo el contenido de `Codigo_cobros.gs`.
3. Revisa arriba del archivo la constante `TOKEN`. Puedes dejar `PM-COBROS-2026` o cambiarla por una clave tuya (si la cambias, debes poner la misma en el panel HTML, dentro del `<script>`, variable `TOKEN`).
4. Guarda el proyecto (Ctrl+S), ponle un nombre como "Protect Motos - Conector Cobros".
5. Arriba a la derecha, clic en **Implementar → Nueva implementación**.
6. En "Tipo", selecciona **Aplicación web**.
7. Configura:
   - **Ejecutar como:** Yo (tu cuenta, la dueña del Sheet)
   - **Quién tiene acceso:** Cualquier usuario
8. Clic en **Implementar**. Google te pedirá autorizar permisos la primera vez (acepta, es tu propio script).
9. Copia la **URL de la aplicación web** que te entrega (termina en `/exec`). Esa es la URL del conector.

> Si más adelante editas el código del conector, vuelve a "Implementar → Administrar implementaciones → ✏️ → Nueva versión" para que los cambios se apliquen a la misma URL.

## Paso 3 — Abrir el panel

1. Descarga `Protect_Motos_Cobros.html` a tu computador.
2. Ábrelo haciendo doble clic (se abre en Chrome).
3. Pega la URL del conector (la que copiaste en el paso anterior) en el campo de arriba y presiona **Guardar**.
4. El panel queda recordando esa URL (localStorage), así que la próxima vez que lo abras ya estará conectado.
5. Verás el mensaje verde "Datos actualizados..." si todo quedó bien conectado.

## Cómo usarlo día a día

- **Cobros de hoy / pendientes:** solo aparecen clientes **financiados** y **activos** con alguna cuota vencida sin pagar. Se calcula automáticamente comparando la fecha de firma con los pagos registrados en la hoja "Pagos" — no necesitas tocar nada a mano.
- **Registrar un pago:** botón "Registrar pago" en la fila del cliente → verás una casilla por cada cuota del plazo; las ya pagadas aparecen marcadas y bloqueadas, y por defecto se marca solo la cuota que está pendiente. Chulea las cuotas que cubre este pago (puedes marcar varias si pagó de una vez, o si el cliente ya llevaba cuotas pagadas de antes de tener este sistema y quieres ponerlo al día) → ajusta valor, fecha y comprobante → Guardar. Esto agrega una fila nueva en "Pagos" por cada cuota marcada (nunca borra ni sobrescribe nada).
- **Cancelar un cliente:** botón "Cancelar" → confirmar. Esto escribe `CANCELADO` en la columna Estado del cliente y el cliente deja de aparecer en cobros.
- **Finalizado automático:** cuando un cliente financiado completa todas sus cuotas (según lo registrado en "Pagos"), el sistema mismo escribe `FINALIZADO` en la hoja y deja de aparecer en cobros. Tú no tienes que hacer nada.
- **Por renovar:** aparecen automáticamente los contratos (contado y financiado) cuya fecha "Fin" está a 8 días o menos. Botón WhatsApp para avisarles.
- **Historial:** busca por cédula, número de contrato o placa para ver todos sus pagos, saldo, cuotas pagadas/faltantes y si pagó antes, a tiempo o tarde.
- **WhatsApp:** los botones abren `wa.me` con el mensaje ya redactado; solo debes darle enviar.

## Notas importantes

- **Contado no se cobra:** los clientes con Forma = CONTADO nunca aparecen en "Cobros de hoy", solo en "Por renovar".
- **El sistema nunca cancela solo:** si un cliente no paga, sigue apareciendo como pendiente indefinidamente (con más días de atraso) hasta que tú lo canceles manualmente desde el panel.
- **Umbral de color naranja→rojo:** está en la constante `UMBRAL_DIAS_ROJO` dentro del `<script>` del HTML (por defecto 5 días). Puedes cambiarlo ahí si quieres ajustar la sensibilidad.
- **Aviso de renovación:** está en `DIAS_AVISO_RENOVACION` (por defecto 8 días), también editable ahí mismo.
- **Supuesto sobre el día de cobro:** la cuota 1 siempre se paga al firmar el contrato y por eso nunca se registra en la hoja "Pagos" — el sistema la da por pagada automáticamente. Las demás cuotas vencen N-1 meses después de la fecha de firma, respetando el mismo día del mes (ej: firmó el 15 de enero → cuota 2 vence 15 de febrero, cuota 3 el 15 de marzo, etc.).
- **Token de seguridad:** cualquiera con la URL del conector y el token puede leer/escribir en tu hoja. No compartas la URL del conector públicamente.
