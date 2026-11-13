# Cotizaciones de renovación (conector CRM: versión crm-4)

1. Abre el proyecto de Apps Script del CRM, borra todo y pega `Codigo_crm.gs` (el nuevo).
2. Implementar → Administrar implementaciones → ✏️ editar → Versión: **Nueva versión** → Implementar (NO «Nueva implementación»).
3. Abre la URL del conector con `?token=PM-CRM-2026&action=ping`: debe decir `crm-4`.
4. En Cobros → «Por renovar», pulsa **ENVIAR COTIZACIÓN**. La pestaña «Cotizaciones Renovación» se crea sola la primera vez que guardes.

Regla: valor a garantizar = el menor entre (factura anterior ÷ 1,1) y (Fasecolda actual ÷ 1,1).
Contado = 7,5 %. Financiado = 9 % (3 m), 10 % (6 m), 12 % (12 m). Mismas reglas que Contratos (`assets/cotizador_core.js`).
