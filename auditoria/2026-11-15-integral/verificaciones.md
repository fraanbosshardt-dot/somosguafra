# Ejecución, rendimiento y cobertura

Snapshot d05880e; 15/11/2026. Sin cambios de aplicación ni pruebas monetarias reales.

## Registro de ejecución

| Prueba | Resultado | Interpretación |
|---|---|---|
| TypeScript | `npm run typecheck`, exit0 | No errores de tipo detectados |
| Suite total | `npm test`, 51archivos,383tests, todos pasaron;143,75s | Lógica local y PostgreSQL PGlite en memoria |
| Dependencias | `npm audit --json`, exit0,0vulnerabilidades conocidas | No equivale a pentest |
| Migraciones |25aplicadas a DBvacía aislada, exit0 | Sintaxis/secuencia instalables; no verifica drift ni locks a volumen real |
| Build | `npm run build`, exit0; compiló2,7s, tipado4,1s,58páginas estáticas1,782s | Tiempos locales del proceso, no latencia usuario |
| Exploratorias |3defectos reproducidos: borradoledger, MRR, dobleaviso | Evidencia en pagos.md; no están aún como regresiones permanentes |

Se levantó `scripts/db-local.ts` con puerto5437 y directorio `.data/auditoria-integral-20261115`, luego `prisma migrate deploy` y build con DATABASE_URL apuntando explícitamente a127.0.0.1. Helper detenido al terminar. No se ejecutó `vercel-build` contra producción, ni `backup-db` sobre usuarios reales. Build genera artefactos ignorados habituales; archivos de producto versionados permanecieron intactos.

No hay script lint ni configuración de E2E navegador en package.json. No se instaló ninguna herramienta ni se alteraron dependencias para esta auditoría. No se midió cobertura instrumentada: cantidad de tests no acredita cobertura de ramas.

## HTTP pasivo de producción

Muestras `curl.exe -sS -o NUL -w ...`, sin autenticación y sin seguir checkout, desde esta computadora. Red/dispositivo no normalizados; mediciones puntuales, no p95/p75 ni atribución de tiempo de servidor.

| Recurso | HTTP | TTFB s | Total s | Cuerpo descargado |
|---|---:|---:|---:|---:|
| `/`, primera muestra |200|1,054561|1,096777|121141bytes |
| `/`, segunda muestra |200|0,191998|0,239348|121141bytes |
| `/contacto` |200|2,183370|2,358979|34317bytes |
| `/terminos` |200|1,153343|1,169651|45225bytes |
| `/app`, anónimo |307|1,283382|1,327061|No medido |
| `https://www.somosguafra.com` |308|0,519508|0,519669|No medido |
| `/api/health` |200|1,190972|1,191142|No conservado |

`robots.txt`200/146bytes; `sitemap.xml`200/3604bytes. Son accesibles; no prueba de indexación de Google ni de ausencia de URLs inválidas dentro de todos los contenidos.

Barrido adicional de las28rutas de `PUBLIC_PAGES` y guías:28/28HTTP200, todas con title y exactamente unh1 en el HTML. Resultados individuales en [http-publico.md](http-publico.md). No comprueba enlaces internos, JavaScript, validación de formularios ni diseño.

Cabeceras de `/` observadas: HSTS2años/includeSubDomains/preload, X-Frame-OptionsDENY, nosniff, Referrer-Policystrict-origin-when-cross-origin, CSP con default self, object none, frame-ancestors none y script unsafe-inline. Cache-Controlpublic,max-age0,must-revalidate. No se guardaron Set-Cookie, cookies, cuerpos privados ni identificadores de usuarios.

El HTML público referenció11scripts. Los chunks same-origin `/_next/static/` referenciados sumaron637542bytes sin compresión y198400bytes tras gzip calculado localmente. Este último es una **estimación de compresión**, no transferencia observada Brotli/gzip del navegador; no incluye fuentes, CSS, HTML ni interacciones posteriores. No equivale al bundle de la app autenticada.

## Qué no se midió

LCP, INP, CLS, waterfall visual, memoria de navegador, hidratación actual, accesibilidad automática/lector, rendimiento privado, latencia p95, queries reales, saturación de pool, CPU servidor y load test: **no evaluados**. Inventario CUA devolvió browsers vacío y “Local browser access is unavailable for this chat”. No se usaron screenshots antiguos como evidencia actual. No hubo una operación UI fallida atribuible al producto: no se pudo abrir la superficie de control.

Los GET externos anteriores no sustituyen navegar formularios, guardar datos ni comprobar estados autenticados. Tampoco se infiere que health200 garantice checkout, correo o cron.

## Plan de medición antes/después

| Área | Baseline pendiente | Objetivo propuesto | Cambio/validación |
|---|---|---|---|
| Landing móvil |3–5Lighthouse mismos parámetros + RUM28d | LCPp75≤2,5s,INP≤200ms,CLS≤0,1 | Ajustar carga inicial solo tras waterfall; repetir mismas condiciones |
| App normal | Dataset100/1000/10000movimientos; trazas queries/red | p95<1s para operaciones simples,0errores de aislamiento | Eliminar consultas duplicadas, comprobar cifras idénticas |
| Admin | Cohortes e historial sintéticos, EXPLAINANALYZE local | Memoria/queries acotadas por período/paginación | Agregados y tests de totales completos |
| Pagos | Proveedor simulado con latencia429/500 y cortes | Acceso converge sin duplicados; edad de conciliación segúnSLO | Comparar backlog máximo y duración; separar webhooks de barrido |
| PDF/importaciones | Fixtures seguros tamaño/cantidad representativos | Timeout,memoria y cuota acotados | Procesamiento aislado y limpieza, sin archivos reales de clientes |

Registrar versión/dataset/región/red/dispositivo y error rate. Si no se conoce baseline no prometer un porcentaje de mejora. No habilitar cache compartida de información privada para lograr una cifra artificialmente mejor.

## Cobertura disponible por rol

| Persona | Código/pruebas locales | Uso real en navegador actual |
|---|---|---|
| Visitante | Público/SEO/formularios inspeccionados; GETs anteriores | No disponible |
| Gratis | effectivePlan/límites/motor/roles cubiertos parcialmente | No disponible |
| Trial | Inicio/vencimiento/calendario/avisos simulados | No disponible |
| Pagador | Activación/renovación/refund simulados | Sin sandbox ni navegador |
| Pago fallido | Acceso/fechas y mensajes inspeccionados/simulados | Sin checkout de prueba oficial |
| Cancelar/volver | Baja/cambio/reserva/reconciliación simulados | Sin baja ni reactivación real |
| Admin | Roles/servicios/consultas/CSS inspeccionados | Sin panel autenticado actual |

Para cerrar: navegador operativo, cuentas ficticias por estado en staging, PostgreSQL multiconexión y secretos de sandbox cargados fuera de los documentos. Pruebas automatizadas deben abortar por defecto si entorno o proveedor no son explícitamente de prueba.
