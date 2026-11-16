# Seguridad, identidad, permisos y operaciones

Fecha: 15-11-2026. Revisión estática del código y pruebas locales; sin ataques, cambios de configuración, operaciones de producción ni lectura de credenciales. Este documento no certifica infraestructura, identidades externas, backups reales ni un pentest completo.

## Controles encontrados

- `src/lib/auth/session.ts:16-45`: token aleatorio de 32 bytes; solamente SHA-256 del token almacenado; cookie httpOnly, secure en producción, SameSite=Lax, vencimiento absoluto de 12 horas o 30 días; revocación, suspensión y eliminación verificadas al leer sesión.
- `src/lib/auth/session.ts:62-100`: 2FA exigido para acceder; `requireWritableWorkspace` exige OWNER o EDITOR con función compartida activa. La autorización de escritura no depende de una cabecera enviada por el navegador. `requireOwner` restringe plan e invitaciones.
- `src/app/actions/app.ts:9` y `src/app/actions/modules.ts:6`: las mutaciones importan `requireWritableWorkspace` como `requireWorkspace`; no confundir ese alias con lectura sin autorización de escritura.
- `src/server/sharing.ts`: aceptación de invitación con bloqueo del espacio, relectura de invitación, mismo correo verificado cuando email está activo, plan vigente, límite de invitados; cambio de espacio exige membresía. IDs enviados por el cliente no bastan para pertenecer a otro espacio.
- `src/lib/auth/password.ts`: scrypt con sal aleatoria, N=32768/r=8/p=1, comparación temporal constante; contraseñas nuevas limitadas a 200 caracteres.
- `src/server/password-reset.ts`: token de recuperación hash, un uso, una hora, bloqueo de usuario y revocación de todas las sesiones y enlaces restantes en la misma transacción.
- `src/server/recovery-codes.ts`: códigos aleatorios de 80 bits almacenados como hashes, consumo atómico y reemplazo bajo bloqueo.
- `src/lib/crypto.ts`: AES-256-GCM para secreto TOTP; exige AUTH_SECRET de longitud mínima 32. No se almacenan datos de tarjeta en estos módulos.
- `src/lib/auth/admin.ts`, `src/server/admin-team.ts`: sesión de administración separada, cookie /admin por ocho horas, roles releídos en cada petición, OWNER/SUPPORT/VIEWER y auditoría. `adminDevLoginAction` requiere desarrollo y host localhost/127.0.0.1.
- Exportaciones administrativas de cuenta, clientes y finanzas exigen OWNER (`src/app/admin/export/**/route.ts`); descargas privadas verifican sesión y 2FA y envían no-store.
- `src/lib/push-endpoint.ts`: destinos push limitados a proveedores conocidos HTTPS, sin credenciales ni puertos arbitrarios; medidas contra SSRF. Suscripciones no pueden reasignarse a otro usuario; límite de 10 dispositivos; prueba limitada a una por minuto (`src/app/api/push/*`).
- `src/lib/cron-auth.ts`: secreto obligatorio y comparación temporal constante. Endpoint de diagnóstico operacional también protegido.
- `src/proxy.ts`: CSP con nonce en páginas privadas, no-store, no-referrer; `next.config.ts`: HSTS, DENY, nosniff, COOP/CORP, sin X-Powered-By. CSP pública permite inline por las necesidades actuales de renderizado; esto reduce su capacidad de mitigar XSS, sin demostrar un XSS.
- `src/server/support-thread.ts`, `src/app/consulta/[token]/page.tsx`: enlace de conversación firmado con correo, vencimiento de 90 días, comparación constante; notas internas excluidas en consulta pública; robots noindex y política no-referrer del proxy.
- `src/app/api/webhooks/resend/route.ts`: Svix antes de procesar, destinatario y remitente coincidentes con caso, cuerpo recuperado por API oficial, deduplicación; adjuntos no procesados. Recepción deshabilitada por defecto, pendiente configuración externa previamente aplazada.
- SQL crudo encontrado utiliza parámetros Prisma; no se encontró `$queryRawUnsafe`/`$executeRawUnsafe` en los módulos inspeccionados. El backup interpola únicamente nombres de tablas obtenidos del catálogo y elimina comillas. Esto no prueba ausencia de toda inyección posible.

## Hallazgos y recomendaciones

| ID | Tipo / severidad / prioridad | Evidencia | Impacto y solución | Esfuerzo / validación |
|---|---|---|---|---|
| SEC-01 | Confirmado, media; P1 | `src/app/actions/app.ts:374-390`: confirmación y desactivación TOTP sin contador de fallos; `src/app/actions/recovery.ts:15-19` sí impone 5/15 minutos | Una sesión completa robada puede intentar códigos sin el límite presente en login y recuperación. Exigir autenticación reciente para quitar 2FA, limitar intentos por usuario/IP con reserva atómica y registrar rechazos. No se afirma bypass remoto sin sesión. | 0,5-1 día; sexto fallo bloqueado, concurrencia no excede cupo, código correcto no reutilizable para acción sensible. |
| SEC-02 | Confirmado en código, riesgo alto condicionado a mala configuración; P1 | `src/server/email-verify.ts:17`: HMAC usa `AUTH_SECRET ?? ""`; `src/lib/crypto.ts:5-9` sí falla al faltar secreto | Si Resend está activo y falta AUTH_SECRET, los códigos son derivables con datos conocidos. No se verificó que esto suceda en producción. Validación central de entorno y fallo cerrado para emisión/verificación. | 0,5 día; entorno sin secreto no emite ni acepta códigos, secreto débil rechazado sin exponer valores. |
| SEC-03 | Confirmado, media operativa; P1 | `scripts/backup-db.mts:14,22`: todas las tablas en JSON local sin cifrar | El archivo contiene información financiera, PII, hashes y secretos cifrados. Estar fuera de Git evita commit accidental pero no protege disco, sincronización ni copias. No hay evidencia de exposición real. Cifrar backups, mínimo privilegio/ACL, custodia separada de clave, retención y restauración documentada. | 1-2 días más ejercicio; recuperar copia ficticia en entorno vacío y comprobar integridad, acceso no autorizado denegado. |
| SEC-04 | Confirmado, media; P1 | `src/app/actions/auth.ts:39-40`; `src/server/google-auth.ts`: creación de usuario seguida de creación de espacio en transacción distinta | Una falla después de crear User deja cuenta sin membresía; reintentar registro devuelve cuenta existente y el acceso puede quedar sin salida. Crear todo en transacción conjunta o reparar onboarding incompleto de forma idempotente. | 1 día; inducir fallo local al crear categorías y verificar rollback o recuperación completa. |
| SEC-05 | Confirmado, media; P1 | `src/app/actions/auth.ts:56-69,114-122`; `src/app/actions/app.ts:537-554`: contar eventos y escribir luego; recuperación limita por correo, sin cupo IP/global | Los límites no son atómicos y ráfagas concurrentes pueden excederlos; reset distribuido por muchos correos consume correo/DB. `contact.ts` y push ya tienen patrón de bloqueo. Centralizar reserva de cupo con expiración por usuario/IP y límites de plataforma; mantener respuesta neutra de recuperación. | 1-2 días; 20 peticiones locales simultáneas respetan cupo y no bloquean indefinidamente usuarios legítimos. |
| SEC-06 | Confirmado, baja privacidad; P2 | `src/server/admin-accounts.ts:51-53`: exportación de cuenta incluye tickets/contactos pero omite SupportMessage | El derecho de acceso/exportación no incorpora nuevas respuestas del hilo. Agregar solo mensajes no internos asociados al usuario y revisar datos de terceros. No exportar notas del equipo. | 0,5 día; fixture con respuesta pública y nota interna: solo primera aparece. |
| SEC-07 | Riesgo de política de acceso, media; P2 | `src/server/admin-accounts.ts:26-48`: exporta todos los espacios de membresía con Subscription e Invoice; `src/app/app/configuracion/mis-datos/route.ts` exige usuario pero no dueño | Un invitado, incluso VIEWER, puede descargar metadatos de facturación y el contenido entero del espacio compartido. No es acceso a tenant ajeno: posee membresía. Definir si compartir lectura incluye copias y facturación; preferir facturación solo al dueño y datos personales minimizados. | 0,5-1 día tras decisión; matriz OWNER/EDITOR/VIEWER de exportación y campos autorizados. |
| SEC-08 | Riesgo de endurecimiento, baja; P2 | `src/lib/auth/google.ts:38-61`: id_token decodificado y claims revisados sin validar JWS | El token proviene exclusivamente del intercambio HTTPS directo con Google con PKCE, state y nonce; no se demostró falsificación explotable ni token arbitrario aceptado desde cliente. Validar firma JWKS con biblioteca mantenida disminuye supuestos y errores futuros; también validar azp/iat cuando corresponda. | 1 día; rechazar firma inválida, issuer/aud/nonce/exp incorrectos; probar rotación de claves con fixture. |
| SEC-09 | Riesgo de disponibilidad, media; P2 | `src/app/actions/modules.ts:774-817`; `src/server/statement-pdf.ts:137-180` | PDF restringido a 5MB/30-60 páginas, pero parseo en mismo proceso sin presupuesto de CPU/memoria ni destrucción explícita de documento; cuota se cuenta antes del parseo y se registra después. PDF comprimido complejo y concurrencia pueden consumir recursos. Reservar cuota atómica y aislar parsing con timeout/cleanup. No se ejecutaron PDFs maliciosos. | 1-2 días; fixture seguro de complejidad alta/timeout, varias solicitudes simultáneas, memoria vuelve al nivel esperado. |

No se confirmó vulnerabilidad crítica P0 de seguridad en este alcance. Esto no equivale a una certificación de ausencia.

## Superficie de autorización revisada

| Superficie | Control actual | Pendiente |
|---|---|---|
| Server Actions auth | Validación Zod, límites login/signup/reset, 2FA | Límites atómicos y cuotas globales; recuperación ante alta parcial |
| Server Actions app/modules | Contexto de sesión y workspace con rol de escritura | Matriz negativa completa por cada acción y relación secundaria |
| Server Actions sharing | Owner para invitar y gestionar; usuario para irse/cambiar espacio | Test HTTP de sesión eliminada durante petición |
| Server Actions admin | Permiso en cada acción, auditoría | MFA/step-up del equipo depende de Google; controles de identidad humana para reset 2FA |
| GET /api/rapido, /api/mi-plan, /api/inversiones/buscar | Sesión y 2FA | Limitar búsquedas externas por usuario/global |
| POST/DELETE /api/push/suscribir y POST /api/push/prueba | Sesión + 2FA + Origin + validación | Test HTTP cross-origin real |
| GET /api/push/aviso | Sesión + 2FA, respuesta genérica anónima | Dispositivo bloqueado y membresía revocada |
| /api/cron/diario, /api/cron/cobros, /api/health/operaciones | Bearer secreto temporal constante | Confirmar programación/rotación/alertas reales del proveedor |
| /api/auth/google y callback | state, PKCE, nonce, claims, correo verificado; allowlist admin | Firma JWS como endurecimiento; revisar configuración consola Google |
| /api/pagos/mercadopago | Firma y consulta proveedor | Auditoría de pagos separada |
| /api/webhooks/resend | Svix y comprobación de caso/remitente/dedupe | Recepción externa aún no configurada; no confundir preparación con integración activa |
| /app/exportar/*, /app/configuracion/mis-datos | Sesión/2FA, scope workspace/usuario, no-store | Política de exportación de invitado y omisiones SupportMessage |
| /admin/export/* | OWNER, no-store y auditoría | Prueba HTTP de roles y no exposición en logs |
| /consulta/[token] y supportFollowupAction | Token firmado temporal o ticket del propio usuario | Revocación individual de enlace, si negocio la necesita |

CSRF de Server Actions depende de controles de Origin/Host de Next y SameSite de cookie; no se configuró una lista amplia de allowedOrigins. No se ejecutó prueba HTTP del rechazo en esta revisión. CSP ayuda a mitigar XSS; React escapa texto por defecto. No se encontró un sink de HTML arbitrario de usuario en lo inspeccionado; no se ejecutó crawler/fuzzer de XSS.

## Verificaciones y límites

- `npm audit --omit=dev --json`, ejecutado el 15-11-2026: salida 0, cero avisos en dependencias de producción; metadata 379 dependencias totales. Consulta al registro npm, no una prueba de ausencia de vulnerabilidades inéditas ni de seguridad del propio código.
- Subconjunto ejecutado: `npx vitest run tests/auth.test.ts tests/google.test.ts tests/password-reset.test.ts tests/email-verify.test.ts tests/recovery-codes.test.ts tests/security-boundaries.test.ts tests/workspace-permissions.test.ts tests/sharing.test.ts tests/admin.test.ts tests/resend-webhook.test.ts tests/proxy.test.ts`: **63/63 tests, 11/11 archivos, 29,31 s, exit 0**. Mezcla unitarias/mocks e integración con fixtures locales; no es E2E contra producción.
- Revisión de rutas, actions y librerías anteriores; lectura de tests de aislamiento, recuperación y límites.
- No se inspeccionaron valores de secretos, contenido de backups existentes, datos reales de usuarios ni tablas de producción.
- No se comprobaron ACL/cifrado/PITR de Railway, configuración WAF/Vercel, protección de dominios/email, MFA de Google del equipo ni restauración real.
- Sin navegador funcional en el entorno auditado: queda pendiente login real, CSRF de transporte, navegación con diferentes roles, cookies/cabeceras efectivamente servidas y responsive.
- Logs usan varios `console.error(e)` completos (`src/app/actions/app.ts:28`, `modules.ts:24`, callbacks OAuth y correo). No se demostró log de secretos, pero conviene logger con redacción central de tokens, cuerpos y DSN antes de ampliar monitoreo.

## Aceptación antes de producción

1. Pruebas negativas por cada rol: sesión ausente, 2FA incompleto, cuenta suspendida, miembro revocado, otro workspace y recurso secundario de otro workspace.
2. Probar endpoints HTTP reales de forma local con DB ficticia, además de tests unitarios con mocks; confirmar no-store y no datos en respuesta no autorizada.
3. Validar entorno en inicio/build sin imprimir secretos; secretos presentes se reportan como sí/no.
4. Ejecutar restauración aislada, medir RPO/RTO y registrar comprobación de integridad.
5. Alertas externas por errores cron, envíos críticos demorados, picos de login y resets, errores 500, y por fallos de auditoría. El snapshot del panel no reemplaza alertas independientes.
