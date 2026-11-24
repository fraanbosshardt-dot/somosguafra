# Orden visual de Movimientos y guía inicial

- Mes, búsqueda, categoría y Aplicar comparten una barra. El rango de fechas queda dentro del mismo grupo como opción secundaria, visible al usarlo. En móvil búsqueda ocupa una fila y categoría/Aplicar comparten la siguiente.
- La guía inicial muestra los pasos pendientes; los revisados se consultan en un desplegable. Se quitan el tachado extenso y el texto de ingresos fijos que no correspondía a Agro. «Omitir por ahora» conserva la preferencia local existente y no cambia datos financieros.
- La paginación conserva categoría, búsqueda, tipo y fechas. Usar rango y volver al mes también mantiene los filtros de búsqueda/categoría/tipo. Aplicar filtros vuelve a la primera página.

Verificación: tipos y build de producción con base ficticia; navegación real en escritorio y emulación 375/320 px, pasos revisados y omisión; búsqueda + categoría + tipo sobre más de 200 movimientos ficticios, Ver más y rango de fechas. Pruebas de rutas existentes y CI completo antes de publicar. Las capturas de QA se guardan en `.data`, fuera de Git. No se modifican saldos, suscripciones ni datos reales.

Reversión: revert y despliegue, sin migraciones ni transformaciones de datos. La organización visual no cambia la fórmula de los totales ni los permisos.
