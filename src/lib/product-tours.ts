export type ProductTour = { title: string; steps: readonly { title: string; text: string }[] };

// Exact routes only: opening a detail or editing a record must not trigger a tour.
export const PRODUCT_TOURS: Record<string, ProductTour> = {
  presupuestos: { title: "Tu presupuesto, paso a paso", steps: [
    { title: "Elegí cuánto querés gastar", text: "Seleccioná el mes y agregá un límite por categoría. Por ejemplo, $500.000 para comida. Crear ese límite no registra un gasto ni separa dinero de tus cuentas." },
    { title: "Registrá las compras cuando ocurran", text: "Cargá cada compra en Movimientos con esa categoría y mes. Si gastaste $100.000, llevás un 20 % del límite. Ver gastos y Ver previstos te permiten revisar lo registrado y lo comprometido." },
    { title: "Anticipá lo que todavía falta", text: "El margen descuenta gastos, pendientes y programados reconocidos. Si activás Contar el margen en mi flujo de caja, se suma como estimación de gasto futuro, sin descontarlo del saldo actual. No cargues además el presupuesto completo como si fuera una compra." },
  ] },
  "presupuestos/trasladar": { title: "Antes de trasladar un presupuesto", steps: [
    { title: "Partí de un mes terminado", text: "Elegí el mes de origen y la moneda. El traslado es una herramienta Pro opcional; no necesitás usarla para llevar tus presupuestos habituales." },
    { title: "Revisá el cálculo", text: "Se copia el límite anterior y se suma solo su margen positivo, descontando gastos, pendientes y programados reconocidos. Revisá el desglose: el resultado será el nuevo límite del mes siguiente, no dinero ahorrado." },
    { title: "Confirmá solo si te sirve", text: "El destino debe estar sin límites. Confirmar no mueve saldos ni reemplaza presupuestos existentes. No se repite automáticamente ni se recalcula si después corregís el mes anterior. Para mantener únicamente tus límites, usá Copiar en Presupuestos." },
  ] },
  "movimientos/preferencias": { title: "Cargá más rápido, con control", steps: [
    { title: "Guardá lo que usás seguido", text: "Un favorito conserva concepto, cuenta y categoría. Podés guardar hasta 20. Al usarlo, completá el importe y revisá la fecha: elegirlo no crea un movimiento." },
    { title: "Sugerí categorías con Pro", text: "Podés crear hasta 30 reglas por texto del concepto. Se usa la primera coincidencia y siempre podés corregirla antes de guardar. No cambia movimientos anteriores." },
    { title: "Revisá antes de confirmar", text: "Volvé a Nuevo movimiento para usar tus favoritos. Revisá cuenta, moneda y si está pagado o pendiente. También podés abrir un movimiento anterior y cargar uno parecido, con un importe nuevo." },
  ] },
  "movimientos/nuevo": { title: "Una carga clara, sin repetir", steps: [
    { title: "Indicá qué ocurrió", text: "Elegí ingreso, gasto o transferencia y revisá la cuenta y moneda. Pagado o cobrado cambia el saldo; Pendiente queda para confirmar cuando ocurra." },
    { title: "Usá tus atajos", text: "Si guardaste favoritos, elegí uno para completar concepto, cuenta y categoría. Ingresá el importe y revisá la fecha; todavía no se guardó nada." },
    { title: "Una compra, varias categorías", text: "Para un gasto pagado completo podés activar Dividir esta compra entre categorías y repartirlo en 2 a 10 partes distintas. Deben sumar exactamente el total. Se guardan esas partes, sin agregar otro gasto por el total. No se combina con pendientes, pagos parciales o recurrencias." },
  ] },
  resumen: { title: "Entendé tu resumen del mes", steps: [
    { title: "Elegí mes y moneda", text: "El resumen está incluido en Gratis. Cada moneda se consulta por separado y los registros se agrupan por su mes económico." },
    { title: "Compará ingresos y gastos", text: "Vas a ver ingresos, gastos netos de devoluciones y su diferencia. Las transferencias entre tus cuentas no cuentan como ingresos o gastos." },
    { title: "Diferencia no es saldo", text: "Este resumen explica lo registrado en el mes. No es tu saldo bancario ni una predicción: para lo pendiente entrá a Próximos pagos y cobros; para anticiparte, a Flujo de caja." },
  ] },
  importar: { title: "Importá con una revisión previa", steps: [
    { title: "Elegí archivo y cuenta", text: "CSV está disponible en Gratis; Excel y OFX requieren Pro. Verificá que la cuenta y moneda correspondan al extracto y tocá Revisar archivo. Todavía no se guardan movimientos." },
    { title: "Revisá qué vas a incorporar", text: "Recorré las filas y sus errores. Con Pro verás posibles coincidencias con tus registros. Una coincidencia no demuestra un duplicado: omití solo lo que reconozcas. Dos compras iguales pueden ser operaciones distintas." },
    { title: "Confirmá las filas elegidas", text: "Omitir no borra movimientos existentes. Confirmar importa las filas válidas seleccionadas y vuelve a verificar la revisión; si cambiaron datos, tendrás que revisarlos otra vez. Importar registra información, no hace operaciones bancarias." },
  ] },
  "recurrentes/costos": { title: "Compará tus costos habituales", steps: [
    { title: "Reuní tus compromisos", text: "Esta vista Pro reúne gastos recurrentes activos y suscripciones de tarjeta. Revisá que sus importes y frecuencias estén actualizados." },
    { title: "Leé el equivalente anual", text: "Calcula cuánto representarían los importes actuales si se repitieran durante un año. Separa las monedas. No predice aumentos ni contempla fechas de fin." },
    { title: "Elegí dónde revisar cada cosa", text: "Para fechas y saldos proyectados, usá Flujo de caja. Cambiar o terminar un registro en Guafra no cancela el contrato con la empresa que te cobra." },
  ] },
};
