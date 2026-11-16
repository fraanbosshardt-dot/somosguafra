# Correcciones de seguridad preparadas en rama

Sin desplegar, sin cambios externos y sin transacciones de dinero. Complementa el diagnóstico original; no lo reemplaza.

## Cambios

- SEC-01/05: `src/server/security-limits.ts` reserva cuotas con bloqueos advisory de PostgreSQL y AuditLog, en orden determinista. Concurrencia entre procesos comparte límites; las claves son hashes, sin correos/IP en esas nuevas filas. Aplicado a login, registro por contraseña/Google, recuperación de contraseña, códigos de email, reenvíos y TOTP. El login también limita longitud de contraseña y rechaza suspendidos antes de crear sesión.
- SEC-01: desactivar 2FA y regenerar recuperación requieren sesión creada hace menos de 15 minutos además del código TOTP; los rechazos se auditan. Activar/desactivar 2FA revoca otras sesiones. Al activar, las sesiones antiguas no conservan verificación heredada de cuando no existía 2FA.
- SEC-01: `src/server/totp-check.ts` verifica contra secreto vigente dentro de bloqueo de usuario y consume el contador TOTP una sola vez en AuditLog. Aplica a login, activación, desactivación y códigos de recuperación. No guarda código ni secreto descifrado. Si se usó el código al ingresar, hay que esperar al siguiente antes de otra acción sensible.
- SEC-02: `src/lib/auth/secret.ts`, email-verify/account-mail: no firmar códigos o enlaces con AUTH_SECRET ausente o de menos de 32 caracteres. Conserva el formato de firmas para compatibilidad con enlaces anteriores. Soporte no genera enlaces firmados con secreto débil; un entorno incompleto no genera tokens predecibles. No se inspeccionaron secretos de producción.
- SEC-04: User, Workspace, Membership, Subscription y categorías iniciales se crean en una única transacción para correo y Google. Fallo revierte todo. Ingresos de cuentas históricas sin ninguna membresía reparan el espacio bajo bloqueo, sin alterar membresías existentes. Alta Google concurrente reconoce el registro ganador sin crear dos espacios.
- SEC-06/07: exportación personal incorpora mensajes públicos de soporte/contacto y omite notas internas. La facturación (Subscription/Invoice) solo se entrega por espacios propios OWNER. Invitados conservan exportación de datos que ya pueden leer en el espacio compartido; no se elimina funcionalidad de colaboración.
- SEC-08: Google ID token exige firma RSA-SHA256 con kid del JWKS oficial, issuer/aud/azp/nonce/exp/iat/email verificado. Nunca acepta jku del token. Fetch de JWKS con timeout de cinco segundos, caché acotada y refresco para rotación limitado a una vez por minuto. Si Google no puede verificarse, el acceso falla cerrado con el aviso existente. Sin nueva dependencia.

## Pruebas ejecutadas

`npx vitest run tests/security-actions.test.ts tests/security-remediation.test.ts tests/google.test.ts tests/email-verify.test.ts tests/admin.test.ts tests/support-replies.test.ts tests/resend-webhook.test.ts tests/audit.test.ts`

Resultado: **48/48 casos, 8/8 archivos, 24,17 segundos, salida 0**.

Incluye concurrencia de cuotas, límite compartido por IP, vencimiento, claves ausentes/débiles, rollback de alta al fallar categorías mediante trigger SOLO en base efímera, reparación idempotente, alta Google simultánea, firma JWT alterada/clave desconocida, JWKS simulado oficial y caché, exportación por rol y exclusión de notas internas, sesión antigua al quitar 2FA, sexto intento bloqueado, revocación de sesiones al activarlo y TOTP concurrente/reutilizado.

`npm run typecheck`: salida 0 después de los cambios.

Las pruebas usan fixtures, PGlite y mocks para Next/Google/correos; no prueban latencia de PostgreSQL remoto ni OAuth en navegador. Requieren regresión completa final por el integrador. No se ejecutaron APIs reales de identidad ni correo durante las pruebas.

## Integración y riesgos residuales

- No hay migración nueva en estos cambios: se reutilizan AuditLog e índices existentes de acción/entidad/fecha. Las filas de cuota/TOTP deben tener retención operativa razonable; nunca purgar consumos TOTP de la ventana vigente. La retención y limpieza general la integra el responsable de operaciones.
- Contabilizar intentos reservados, incluidos correctos, es deliberado para cerrar ráfagas y acotar trabajo; no se promete una cantidad de fallos exacta antes de bloquear si se hicieron otras acciones TOTP en los 15 minutos anteriores.
- La sesión reciente se solicita con instrucciones de cerrar e ingresar nuevamente. No se introduce pantalla nueva de reautenticación ni se simula un login silencioso.
- SEC-03 (backup cifrado/restauración) y SEC-09 (presupuesto/aislamiento y cuotas PDF) se asignaron al integrador, fuera de estos archivos.
- Siguen pendientes verificación visual, OAuth de Google real tras despliegue autorizado, cabeceras HTTP/cookies efectivas y políticas de infraestructura; no se presentan como resueltos por tests locales.
- Reversión: revertir código de esta rama; las filas nuevas de AuditLog son compatibles y no necesitan borrarse. Volver al código anterior reintroduce las debilidades corregidas; preferir corrección progresiva si aparece una incidencia.
