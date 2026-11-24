# Controles y rendimiento — 24/11/2026

## Cambios implementados

- Un selector de mes compartido en Movimientos, Presupuestos, Calendario y Reporte: superficie agrupada, etiqueta, mes/año y flechas SVG; áreas táctiles de 44 px. Conserva parámetros y el límite de meses del reporte.
- Búsquedas con bordes neutros, lupa y un solo foco visible, eliminando el anillo verde y la superposición de foco entre campo y contenedor. No se suprime la indicación de foco para teclado.
- El widget flotante del chat mantiene su botón inicial, pero descarga conversaciones y respuestas al abrirse. Se conserva la intención de apertura antes de cargar, el código del caso, la apertura desde Ayuda/cabecera, el enlace `?chat=`, el historial y la presentación privada inline. Fallas de descarga permiten reintentar.
- La búsqueda global no vuelve a consultar tablas para grupos sin ids encontrados. Los filtros por espacio se conservan.
- Movimientos y Calendario agrupan filas sin copiar el array entero por cada registro del mismo día.

## Evidencia de rendimiento

Comparación de scripts `src` del HTML estático de la landing, dos builds locales de producción con las mismas dependencias y configuración. Se sumó tamaño de archivos y su gzip individual. No equivale a bytes de transferencia reales, Brotli ni Core Web Vitals.

| Medición | Antes | Después |
| --- | ---: | ---: |
| Scripts iniciales | 12 | 11 |
| JavaScript sin comprimir | 670.932 bytes | 642.528 bytes |
| Suma comprimida con gzip | 211.481 bytes | 201.231 bytes |
| Código de conversaciones/respuestas en scripts iniciales | Sí | No |

Reducción observada: 28.404 bytes de JavaScript inicial y 10.250 bytes gzip. En navegador, un chunk adicional se incorpora al pulsar el chat, y el diálogo abre correctamente. No se atribuye un porcentaje de mejora de velocidad a esta reducción.

En búsqueda sin coincidencias se evitan las siete consultas posteriores de detalle; con una cuenta encontrada se consulta solo esa tabla. Las consultas iniciales de identificación y el aislamiento por espacio permanecen.

## Verificación y límites

- TypeScript y build local de producción correctos; 20 pruebas dirigidas correctas, incluyendo dos nuevas de consulta selectiva y la intención pendiente del chat.
- Navegador integrado sobre base ficticia: abrir chat desde acceso flotante y cabecera móvil; enlace a un caso existente; selector de mes que conserva tipo y texto buscado; foco sin sombra del campo y con borde neutro del contenedor; Calendario, Presupuestos y Reporte, incluyendo ausencia de enlace a un reporte futuro.
- Revisión visual en escritorio 1280 × 800 y emulación móvil 375 × 667, en claro y oscuro. No equivale a Safari/celular físico ni a una auditoría completa de accesibilidad.
- Sin cambios de precios, activación de planes, saldos, reglas de cobro, variables de producción o migraciones. La revisión integral adicional solicitada se presenta como propuesta separada.

Reversión: revertir esta entrega y redesplegar, sin transformaciones de datos.
