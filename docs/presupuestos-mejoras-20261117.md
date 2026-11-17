# Presupuestos: claridad y consistencia

## Problema y comportamiento nuevo

El diagnóstico está en `presupuestos-revision-20261117.md`. Se autorizó resolver Presupuestos, mantener el diseño y simplificar el uso; las demás áreas se auditan sin corregirlas.

1. El margen incluye recurrentes y suscripciones programadas aunque la estimación de caja esté apagada. Activarla solo agrega la estimación restante al flujo; no altera el compromiso conocido ni crea pagos.
2. Resumen y tarjetas separan límite, gastado, previsto y margen. Alertas distinguen exceso ya gastado de exceso previsto, usando compromisos programados y la fecha del espacio.
3. «Ver gastos» y «Ver previstos» llevan al detalle privado por mes económico, categoría principal y subcategorías, en moneda base. Gastos y pendientes se paginan a 50; programados se muestran separados. Enlaces conservan los permisos existentes de cada registro.
4. El editor muestra cuánto se estimaría con el límite escrito, antes de guardar. Explica que quitar el límite conserva los gastos. La explicación extensa de tarjetas está plegada.
5. Copiar muestra error útil si falta origen o no hay categorías activas, confirma éxito y no reemplaza un destino que ya tiene límites. El bloqueo del espacio protege dos copias simultáneas. Solo copia límites y opciones.
6. Se conserva el promedio de tres meses como referencia, explicando que incluye meses vacíos y que una cuenta nueva debe ajustarlo. No se altera automáticamente el límite del usuario.
7. Ayuda y respuesta de Guafra para Presupuestos actualizadas; aclaración relacionada en Inicio, sin modificar su cálculo de disponible.

No cambia la contabilización del total de compras en cuotas, el modelo de planes, los saldos, transacciones existentes ni el mes económico. No requiere migración ni secretos nuevos.

## Verificaciones

- TypeScript sin errores.
- Compilación local completa con Webpack y base PGlite ficticia: 58 páginas estáticas, ruta privada de detalle incluida. Se conserva un aviso preexistente de Webpack sobre `pdf-worker.ts/createRequire`; no se modificó ese módulo.
- El primer intento sin base local compiló, pero no pudo prerenderizar páginas legales por falta de DATABASE_URL. Se repitió con base ficticia y terminó correctamente; no se usó la base de producción.
- Suite general local: 528 aprobadas y 2 omitidas de PostgreSQL independiente, antes de las últimas ampliaciones del archivo de presupuesto. Las pruebas definitivas de la rama deben comprobarse también en CI con PostgreSQL.
- Regresiones nuevas: programación con opción apagada/encendida, materialización sin duplicar, suscripción de tarjeta, exceso previsto, copia inválida/vacía/concurrente, destino con límites, categorías archivadas, aislamiento, reintegros, paginación y mes económico, alertas reales frente a previstas.
- Recorrido ficticio en navegador: límite 500.000, gastado 150.000, previsto 50.000, margen 300.000. Al editar a 550.000, vista previa 350.000; guardado confirmado. Detalles de compra y pedido correctos. Copia a diciembre conserva 550.000 y opción, sin gastos. Origen vacío muestra error.
- Diseño móvil 390 × 844 sin desbordamiento horizontal (documento 375 px); botones de detalle separados y editor con importe y explicación en líneas propias. Evidencias locales bajo `.data/chat-qa/`, con datos ficticios.

## Despliegue y reversión

Rama separada `fix/presupuestos-claridad`. Preview desactivado para esta rama para evitar ejecutar migraciones sobre una base compartida. No fusionar ni desplegar a producción sin autorización explícita.

Al aprobar: comprobar CI del SHA exacto, revisar diff, fusionar, verificar despliegue y control de salud. Probar lectura del presupuesto y detalle, y realizar cambios únicamente en un espacio de prueba. Si falla, revertir el commit de la propuesta y redesplegar; sin rollback de base porque no hay migración. Los presupuestos existentes y opciones se conservan.

## Límites y seguimiento

- Las sugerencias no reconstruyen meses anteriores al registro: se muestran como referencia histórica, no como recomendación garantizada.
- La estimación sigue al final del mes y no adivina el medio de pago de compras futuras.
- Las mutaciones siguen el permiso de escritura existente. Esta tarea no introduce resolución de ediciones simultáneas de límites distintos: el guardado manual mantiene el comportamiento de último guardado válido; la copia sí protege un presupuesto ya creado.
- La lista de programados de un mes no tiene paginación propia; gastos y pendientes sí. Revisar si hay espacios con cantidades extraordinarias de reglas.
- Hallazgos del resto de la aplicación: `auditoria-usabilidad-app-20261117.md`, pendientes de autorización.
