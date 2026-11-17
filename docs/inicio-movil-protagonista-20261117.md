# Inicio móvil: jerarquía del disponible

## Diagnóstico

La regla general `.app .view .card` de `src/app/app/mobile.css` agregaba padding a la tarjeta contenedora del resumen. Ese segundo margen achicaba la tarjeta verde. Además, el aviso de datos incompletos y una explicación antes del importe desplazaban el indicador principal hacia abajo.

## Cambio

- Se identifica exclusivamente el resumen de Inicio con `home-summary` y se elimina su segundo margen en pantallas de hasta 640 px.
- La tarjeta verde ocupa el ancho disponible, aparece debajo del saludo y presenta primero el disponible y su importe.
- El aviso de revisión de datos queda después del resumen y las acciones rápidas. La explicación completa del cálculo sigue en el desplegable existente.
- No cambian cálculos financieros, permisos, pagos, consultas ni estructura de datos. Los avisos de retorno de pagos conservan su prioridad.
- Se deshabilita el despliegue de la rama de trabajo para evitar previews sobre la base compartida.

## Validación

Se recorrió la aplicación local con una base ficticia aislada y un importe de ocho cifras ($25.070.456), sin servicios externos ni datos de producción.

| Ancho de pantalla | Ancho de tarjeta verde | Alto | Desborde del importe |
| --- | --- | --- | --- |
| 320 px | 281 px | 220 px | No |
| 390 px | 343 px | 230 px | No |
| 430 px | 383 px | 230 px | No |

En los tres tamaños la tarjeta comienza 22 px debajo del saludo y no hay desborde horizontal de la página. TypeScript y revisión de whitespace sin errores. Las reglas visuales nuevas están limitadas a móvil; el diseño de escritorio conserva su distribución.

## Publicación y reversión

No requiere migración ni nuevas variables. Publicar mediante la integración habitual de main tras los controles obligatorios. Para revertir, revertir el commit de este cambio y publicar de nuevo; no requiere restaurar datos.
