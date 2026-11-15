# Correcciones de la auditoría del 15/11/2026

## Integridad y dinero

- Se retiró la eliminación automática de cuentas por inactividad. El selector de registros abandonados quedó restringido a registros vacíos y sin uso para revisión manual.
- Conciliaciones y escrituras financieras comparten un bloqueo por espacio. La conciliación calcula, ajusta y marca el saldo dentro de una transacción.
- Movimientos pendientes y transferencias también tienen protección contra reintentos con la misma clave de formulario.
- Las alertas muestran cada moneda por separado. No se suman ARS y USD como si fueran la misma moneda.
- El disponible reserva vencimientos del día de corte y cuenta correctamente el último día del mes.
- Altas de cuentas, objetivos e invitaciones comprueban y consumen el cupo dentro de la misma transacción. El aporte inicial queda unido al objetivo que se acaba de crear.

## Acceso y planes

- Los invitados conservan lectura al volver el espacio a Gratis. Editar y sumar personas exige Pro y el permiso correspondiente. El dueño conserva sus datos.
- El premio de referidos exige correo verificado, bienvenida terminada y un primer movimiento. Ambos beneficios y el marcador se confirman juntos, con límite por quien invita.
- Los días ganados no cambian cobros autorizados: quedan como crédito mientras exista una suscripción paga o programada. Se aplican cuando no queda renovación ni cobertura paga pendiente. No reemplazan un acceso permanente por uno temporal.
- Características y límites parten de un catálogo común; landing y configuración respetan las funciones que el administrador haya incluido en Gratis.

## Contacto, seguridad y recuperación

- Un envío legítimo rápido de Contacto se registra normalmente. El antispam nunca devuelve una constancia ficticia.
- Consulta y acuse se guardan juntos. Las respuestas del equipo también conservan su correo en una cola durable e idempotente.
- Se agregaron códigos de recuperación del segundo factor: ocho códigos de un solo uso, almacenados como hashes. Se generan desde Seguridad confirmando el código TOTP y se muestran una sola vez. Desactivar o restablecer 2FA invalida los códigos anteriores.
- Se registra la versión de términos aceptada en altas nuevas; no se inventa aceptación para cuentas existentes.
- Las páginas privadas usan CSP con nonce y no-store. La navegación pública hacia la app realiza una carga de documento para aplicar la política privada.
- Se auditan accesos al panel y consultas de fichas del cliente.

## Recuperación operativa

Se migró de Cron Jobs a Vercel Schedules: mantenimiento diario y recuperación de cobros/correos cada 15 minutos, con ventana de ejecución de hasta 15 minutos del plan Hobby. Se usa el CRON_SECRET existente. La configuración no necesita contratar otro plan.

La recuperación prioriza acuerdos vigentes y revisa también una porción del historial. Tiene presupuesto de tiempo, arrendamiento contra ejecuciones superpuestas y reintentos de correo. No crea cargos. Sistema muestra antigüedad de la cola, acuerdos atrasados y pagos vigentes sin acceso efectivo. El chequeo operativo detallado exige autenticación; el chequeo público no expone datos de clientes.

GitHub comprueba cada hora la disponibilidad del sitio, el ingreso y la base de datos. Los avisos de fallos dependen de las preferencias de notificación de GitHub del equipo.

Referencias: [configuración de Schedules](https://vercel.com/docs/schedules/configuration), [límites Hobby](https://vercel.com/docs/schedules/limits), [migración y CRON_SECRET](https://vercel.com/docs/schedules/migrate-from-cron-jobs).

## Experiencia

- Se quitó «Ver solicitud» de la landing. La navegación muestra «Ir a la app» y precios permite «Continuar pago» mediante la misma solicitud de Mercado Pago.
- La landing resume el acceso; el detalle operativo queda en Plan. Al continuar un pago se conserva su ciclo para no anunciar otro precio mientras se retoma el contrato original.
- Configuración tiene un selector de secciones en móvil; Ayuda permite búsqueda y filtrado por tema.
- Se agregó Revisión del mes para comparar saldos, revisar pendientes, categorías y recurrentes. Es una revisión de datos: no mueve dinero ni cierra registros.
- El inicio explica qué incluye el disponible y avisa cuando faltan recurrentes.
- Se estabilizaron los saltos a secciones de la landing y se respeta la preferencia de movimiento reducido.
- Se agregó acceso explícito a Baja del servicio mediante Contacto. No exige indicar motivos.

## Validación y límites

Las regresiones usan PostgreSQL PGlite aislado, con las migraciones del proyecto y datos ficticios. Incluyen concurrencia, cupos, monedas, referidos, códigos de recuperación, constancias, respuestas, permisos, nonce y arrendamientos de mantenimiento. La compilación de producción y CI deben aprobar antes de considerar publicado el cambio.

No se ejecutan compras ni cancelaciones reales para probar. Las credenciales y las tarjetas de producción no se usan en pruebas. El simulacro de restauración del proveedor, la revisión jurídica/fiscal profesional, la contratación de personal de soporte y las hipótesis comerciales requieren una validación independiente; este cambio no los certifica ni modifica precios o contratos vigentes.
