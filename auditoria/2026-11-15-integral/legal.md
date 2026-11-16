# Información fiscal y protección del consumidor

Revisión técnica/documental; no dictamen jurídico ni contable. Fecha15/11/2026. Se contrastó documentación primaria oficial en la web. No se inspeccionó situación fiscal del titular ni se emitieron comprobantes.

## Fuentes y contraste

La [Disposición954/2025, texto oficial](https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-954-2025-417152/texto) regula enlaces visibles de arrepentimiento/baja, constancia y medidas dentro de24h, y atención remota con horarios mínimos. Derogó la Resolución424/2020. La [Disposición3/2026, texto oficial](https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-3-2026-423007/texto) admite verificaciones razonables exclusivamente de identidad/seguridad. El [artículo10ter y el régimen de contratos a distancia de la Ley24240](https://www.argentina.gob.ar/normativa/nacional/ley-24240-638/actualizacion) deben revisarse junto al Código Civil y Comercial y las circunstancias del servicio.

El código cita954/2025 y3/2026 en `src/content/legal.ts:24,84`; esa referencia está actualizada respecto de estas fuentes. No corresponde denunciar como error el uso de verificación razonable de identidad ni aplicar una excepción por uso del servicio automáticamente: requieren análisis profesional.

`src/components/public-shell.tsx` incluye arrepentimiento, baja y consumidor en el pie. `src/app/contacto/page.tsx` admite consultas sin registro; `src/server/contact.ts` guarda código y constancia en outbox en una transacción. Son controles útiles. Falta comprobar visualmente visibilidad en primer acceso y la denominación exigible de los enlaces; el footer muestra “Baja del servicio”. No se encontró horario concreto de atención en el contenido inspeccionado. Un SLA general de48horas hábiles no demuestra atención de bajas dentro del plazo aplicable: separar esa cola y su responsable, sin prometer automatismos inexistentes.

Los términos informan moneda ARS, frecuencia, renovación, trial y cancelación; prometen aviso30d ante aumento. `startCheckout` fija importe contractual: cambiar catálogo no implementa por sí solo un cambio de contratos vigentes. Si se ofrece actualización de precios, diseñar aviso/aceptación y mecanismo separado antes de tocar acuerdos.

## Comprobantes

[ARCA, comprobantes de monotributo](https://www.arca.gob.ar/facturacion/monotributo/comprobantes.asp) informa emisión electrónica para operaciones con consumidores finales y claseC salvo exportación. [ARCA, régimen general](https://www.arca.gob.ar/facturacion/regimen-general/comprobantes.asp) distingue tipos según situación de emisor y receptor. Son reglas condicionadas al régimen: no se infiere cuál corresponde al titular.

El modelo `Invoice` de GUAFRA almacena el cobro de MP, sin CAE/numeración fiscal en los campos inspeccionados. La app no contiene una integración emisora ARCA; eso **no prueba** que el negocio no facture manualmente por fuera. El recibo de pago y el comprobante fiscal deben tratarse por separado. Confirmar con contador: régimen/actividad, impuestos incluidos, comprobante por operación, notas de crédito, exportaciones si hubiera, retenciones/percepciones y conservación de documentación. Registrar un vínculo/estado fiscal verificable si se usa un proceso externo.

## Privacidad y retención

`src/content/legal.ts` anuncia que se conservan comprobantes cuando sea obligatorio. La cascada que elimina Invoice/PaymentEvent contradice técnicamente esa posibilidad: FIN-01/PAG-01 debe resolverse con un ledger desacoplado y minimización, no reteniendo toda la cuenta financiera personal. Determinar plazos/roles/acceso y borrado seguro con asesoría; no inventar un plazo fiscal único en código.

Revisar con especialista Ley25326, derechos de acceso/rectificación/supresión, registro/transferencias internacionales y contratos con Vercel/Railway/Resend/Google. SEC-06 documenta exportación incompleta de mensajes de soporte; SEC-07 pide delimitar facturación de invitados. No se afirma cumplimiento integral por tener una política publicada.

## Validación propuesta

1. Solicitud ficticia de baja/arrepentimiento sin sesión: código inmediato, responsable, reloj de plazo especial, constancia por el mismo canal y trazabilidad hasta resolución.
2. Verificación de identidad proporcional; no pedir claves bancarias, códigos2FA ni registro nuevo.
3. Contraste jurídico de refund10d, plazo operativo de devolución, precios finales, renovaciones, horarios, identidad/contacto y contenido legal.
4. Pago de sandbox con tarea fiscal ficticia; la prueba no debe emitir un comprobante fiscal real ni reembolsar dinero real.
5. Borrado local conserva solo hechos empresariales requeridos y elimina información personal según política aprobada.
