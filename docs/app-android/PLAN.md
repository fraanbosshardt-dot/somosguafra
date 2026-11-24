# App de Android de Somos Guafra (Play Store)

Rama: `app-android`. Diseño de referencia: lienzo "App Somos Guafra" (16 pantallas).

## Cómo está armada

- **Web empaquetada (Trusted Web Activity).** Las pantallas de la app viven dentro de la misma web, en `/movil`, con el diseño nuevo. La app de Android es un contenedor liviano que abre `/movil` en pantalla completa, sin barra del navegador.
- **Mismos datos y mismo servidor.** `/movil` usa las mismas funciones del servidor que `/app` (`dashboard`, `openObligations`, `recordMovement`, `payObligation`, etc.). No hay una API nueva ni datos duplicados.
- **Inicio de sesión:** el mismo de la web (correo y contraseña, Google, verificación en dos pasos).
- **Cobro de Pro dentro de la app:** Google Play Billing, a través de la Digital Goods API y la Payment Request API. Mercado Pago sigue igual en la web. Dentro de la app no se muestra ningún botón ni enlace a Mercado Pago.

## Etapas

| Etapa | Qué incluye | Estado |
|---|---|---|
| 1 | Base de `/movil`: diseño, barra de abajo, Inicio con datos reales, animaciones | En curso |
| 2 | Cargar movimiento (3 pasos), Movimientos (corregir y eliminar), Próximos (calendario, registrar pago y cobro) | Pendiente |
| 3 | Explorar y sus funciones: cuentas, tarjetas, deudas, recurrentes, flujo, presupuestos, objetivos, simulador, inversiones, alertas, informes | Pendiente |
| 4 | Configuración, Ayuda, bienvenida, inicio de sesión y registro con el diseño nuevo | Pendiente |
| 5 | Empaquetado Android: Bubblewrap, `assetlinks.json`, ícono, pantalla de apertura, firma | Pendiente |
| 6 | Google Play Billing para Pro: productos, verificación en el servidor, avisos de Google (RTDN) | Pendiente |
| 7 | Ficha de Play Store, prueba cerrada y envío a revisión | Pendiente |

## Lo que pide Google Play (y cómo lo cubrimos)

1. **Cuenta de desarrollador de Google Play:** pago único. **La creas tú.**
2. **Prueba cerrada obligatoria:** una cuenta personal creada después de noviembre de 2023 tiene que hacer una prueba cerrada con al menos 12 personas, que tengan la app instalada durante 14 días seguidos, antes de poder publicar. Una cuenta de organización (necesita número D-U-N-S) no tiene este requisito. **Conviene juntar testers desde ya.**
3. **Versión de Android:** desde el 31 de agosto de 2026, las apps nuevas tienen que apuntar a Android 16 (API 36). La app se compila con API 36.
4. **Política de privacidad:** con una URL pública. Ya existe en la web; hay que revisar que mencione la app.
5. **Borrar la cuenta:** se tiene que poder hacer desde la app (ya existe en Configuración → Seguridad) y también desde una dirección web sin instalar la app (hay que agregar esa página).
6. **Formulario de seguridad de los datos (Data safety):** declarar qué datos se guardan (correo, nombre, datos financieros cargados a mano), que viajan cifrados y que se pueden borrar.
7. **Declaración de funciones financieras:** Google la pide a todas las apps. La nuestra es una app de presupuesto y finanzas personales: no presta dinero ni mueve dinero.
8. **Clasificación de contenido** (cuestionario IARC) y **público objetivo:** mayores de 18.
9. **Pagos:** las suscripciones digitales que se venden dentro de la app tienen que cobrarse con Google Play Billing, y eso ya está previsto en la etapa 6.
10. **Ficha de la tienda:** ícono de 512×512, imagen destacada de 1024×500, al menos 2 capturas de pantalla del celular, descripción corta (80 caracteres) y descripción larga.
11. **Firma de la app:** se usa la firma de apps de Google Play. La clave de subida la generas tú y la guardas tú.
12. **Digital Asset Links:** la web publica `/.well-known/assetlinks.json` con la huella de la firma, para que la app abra la web en pantalla completa.

## Lo que tienes que hacer tú (las claves las cargas tú)

- Crear la cuenta de Google Play Console.
- Generar la clave de subida y pasarme solo la huella SHA-256, nunca la clave.
- Para Play Billing: crear en Play Console la suscripción Pro (mensual y anual), una cuenta de servicio de Google Cloud con acceso a la API de Google Play Developer, y un tema de Pub/Sub para los avisos de Google. Las credenciales se cargan como variables de entorno en Vercel.
- Juntar al menos 12 testers para la prueba cerrada.

## Fuentes

- [Versión de Android exigida por Google Play](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [Prueba cerrada para cuentas personales nuevas](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Play Billing en una Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing)
