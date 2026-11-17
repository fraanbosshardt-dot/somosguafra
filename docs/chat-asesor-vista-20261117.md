# Vista exclusiva para contactar al equipo

## Diagnóstico

El historial se mantenía montado con `hidden` durante la derivación. Además, una regla móvil limitaba el formulario al 65 % de altura, reservando un espacio innecesario. La captura del usuario muestra mensajes encima del formulario.

## Corrección

- El historial y su código no se renderizan durante el formulario ni en Mis conversaciones.
- El formulario ocupa todo el espacio disponible con un único desplazamiento.
- Al volver se conserva el historial en estado y se recupera su posición de lectura.
- No cambian la creación de casos, los mensajes, los permisos ni las notificaciones.

## Validación

- TypeScript: correcto.
- Pruebas existentes del chat, rutas e historial: 26 correctas.
- Navegador con base ficticia aislada: visitante → tema de pagos → contactar al equipo → volver. Mensajes conservados.
- En formulario: cero nodos `role=log`; título recibe foco.
- Vistas 390×680, 390×560 y 1280×800: sin historial detrás.
- Sin mensajes ni casos de prueba creados en producción.
