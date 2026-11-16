# Comprobación HTTP de páginas públicas

GET sin sesión; no navegador, formularios ni interacción JS. Dos solicitudes simultáneas máximo. Tiempo total de cada GET desde esta computadora, no TTFB ni CWV. Sin credenciales, sin guardar cuerpos. Snapshot del sitio disponible el15/11/2026.

| Ruta | HTTP | Total s | title presente | h1 en HTML |
|---|---:|---:|---|---:|
| `/` | 200 | 0.391 | True | 1 |
| `/herramientas` | 200 | 0.55 | True | 1 |
| `/herramientas/cuotas` | 200 | 0.621 | True | 1 |
| `/herramientas/prestamo` | 200 | 0.526 | True | 1 |
| `/herramientas/plazo-fijo` | 200 | 0.534 | True | 1 |
| `/herramientas/conversor-de-monedas` | 200 | 2.333 | True | 1 |
| `/herramientas/fondo-de-emergencia` | 200 | 0.547 | True | 1 |
| `/herramientas/presupuesto-50-30-20` | 200 | 0.529 | True | 1 |
| `/glosario` | 200 | 0.534 | True | 1 |
| `/novedades` | 200 | 0.516 | True | 1 |
| `/productores` | 200 | 0.541 | True | 1 |
| `/guias` | 200 | 0.902 | True | 1 |
| `/quienes-somos` | 200 | 0.532 | True | 1 |
| `/seguridad` | 200 | 0.541 | True | 1 |
| `/contacto` | 200 | 0.456 | True | 1 |
| `/terminos` | 200 | 0.198 | True | 1 |
| `/privacidad` | 200 | 0.541 | True | 1 |
| `/reembolsos` | 200 | 0.523 | True | 1 |
| `/cookies` | 200 | 0.525 | True | 1 |
| `/arrepentimiento` | 200 | 0.591 | True | 1 |
| `/guias/como-organizar-el-sueldo` | 200 | 0.524 | True | 1 |
| `/guias/conviene-pagar-en-cuotas` | 200 | 0.534 | True | 1 |
| `/guias/que-es-el-cft` | 200 | 0.492 | True | 1 |
| `/guias/impuesto-al-cheque-venta-de-granos` | 200 | 0.562 | True | 1 |
| `/guias/fondo-de-emergencia` | 200 | 0.493 | True | 1 |
| `/guias/como-funciona-el-plazo-fijo` | 200 | 0.508 | True | 1 |
| `/guias/regla-50-30-20` | 200 | 0.507 | True | 1 |
| `/guias/como-salir-de-deudas` | 200 | 0.525 | True | 1 |
