export const CHAT_TOPICS = [
  {
    id: "start",
    title: "Empezar a usar Guafra",
    words: [
      "empezar",
      "comenzar",
      "primeros pasos",
      "como funciona",
      "cuentas",
      "cuenta bancaria",
    ],
    area: "soporte",
    answer:
      "Empezá en Cuentas: cargá tus saldos actuales. Después agregá ingresos y gastos en Movimientos. Con esos datos podés revisar el mes y anticipar tus próximos pagos. No necesito contraseñas del banco.",
    link: "/app/cuentas",
    linkLabel: "Ir a Cuentas",
  },
  {
    id: "plans",
    title: "Gratis, Pro y precios",
    words: [
      "precio",
      "planes",
      "pro",
      "gratis",
      "mensual",
      "anual",
      "suscripcion",
    ],
    area: "pagos",
    answer:
      "Gratis permite organizar tus finanzas del día a día. Pro suma planificación e informes avanzados, entre otras funciones. Los precios vigentes y la frecuencia de renovación se muestran en Precios y en Configuración → Plan. Ahí también podés revisar tu estado real.",
    link: "/app/configuracion?tab=plan",
    linkLabel: "Ver Mi plan",
  },
  {
    id: "trial",
    title: "Prueba gratuita",
    words: ["trial", "prueba", "14 dias", "periodo gratuito"],
    area: "pagos",
    answer:
      "La prueba de Pro dura 14 días desde que la activás. Podés elegir mensual o anual durante la prueba y conservar el tiempo gratuito restante. Si no autorizás una suscripción, al terminar volvés a Gratis sin que eso autorice un cobro. Revisá tus fechas en Mi plan.",
    link: "/app/configuracion?tab=plan",
    linkLabel: "Ver fechas de mi plan",
  },
  {
    id: "pending",
    title: "Solicitud o pago pendiente",
    words: [
      "pendiente",
      "cerrar mercado pago",
      "cerre mercado pago",
      "abandonar",
      "retomar",
      "continuar pago",
    ],
    area: "pagos",
    answer:
      "Abrir o cerrar el checkout no confirma un pago. Si ya hay una solicitud pendiente, retomá la misma desde Mi plan para evitar otro intento. La confirmación depende de Mercado Pago, no de volver al sitio. Si pagaste y no aparece el acceso, pedí atención del equipo.",
    link: "/app/configuracion?tab=plan",
    linkLabel: "Revisar solicitud",
  },
  {
    id: "cancel",
    title: "Cómo cancelar la renovación",
    words: [
      "como cancelar",
      "donde cancelo",
      "dar de baja",
      "cancelar suscripcion",
      "baja",
    ],
    area: "pagos",
    answer:
      "Podés pedir la baja desde Configuración → Plan → Cancelar suscripción. El sistema debe confirmar la detención de las renovaciones y mostrar hasta cuándo conservás el acceso cubierto. Este mensaje del asistente no cancela tu contrato. Si necesitás ayuda con una baja, pasamos el caso al equipo.",
    link: "/app/configuracion?tab=plan",
    linkLabel: "Administrar suscripción",
  },
  {
    id: "verify",
    title: "Confirmar correo e ingresar",
    words: [
      "correo",
      "verificacion",
      "verificar",
      "contrasena",
      "ingresar",
      "google",
      "codigo",
      "acceso",
    ],
    area: "soporte",
    answer:
      "Para confirmar tu correo, usá la pantalla Confirmar correo. Si olvidaste tu contraseña, podés recuperarla desde Ingresar. Los códigos se escriben únicamente en esas pantallas seguras: nunca me los envíes por chat ni se los compartas al equipo.",
    link: "/recuperar",
    linkLabel: "Recuperar acceso",
  },
  {
    id: "moves",
    title: "Movimientos y transferencias",
    words: [
      "movimiento",
      "transferencia",
      "ingreso",
      "gasto",
      "saldo",
      "duplicado movimiento",
    ],
    area: "soporte",
    answer:
      "Registrá ingresos y gastos en Movimientos. Para pasar dinero entre tus cuentas usá una transferencia, así no se cuenta como un nuevo ingreso o gasto. Antes de corregir un saldo, revisá los movimientos y sus fechas. Si ves una diferencia, contanos los pasos sin compartir información bancaria sensible.",
    link: "/app/movimientos",
    linkLabel: "Ver Movimientos",
  },
  {
    id: "cards",
    title: "Tarjetas y cuotas",
    words: ["tarjeta", "cuotas", "resumen", "pdf", "cierre", "vencimiento"],
    area: "soporte",
    answer:
      "En Tarjetas podés organizar consumos, cuotas, cierres y vencimientos. Revisá siempre el resultado de una importación antes de confirmarla. No envíes por chat números completos de tarjeta, códigos de seguridad ni resúmenes con datos sensibles.",
    link: "/app/tarjetas",
    linkLabel: "Ver Tarjetas",
  },
  {
    id: "export",
    title: "Importar o descargar datos",
    words: [
      "importar",
      "exportar",
      "excel",
      "csv",
      "ofx",
      "descargar",
      "respaldo",
    ],
    area: "soporte",
    answer:
      "Las opciones están en Configuración → Importar y exportar. El respaldo de tu espacio se descarga desde Configuración → Tus datos. Guardá una copia antes de cambios importantes. No hace falta pegar archivos financieros en este chat para pedir ayuda.",
    link: "/app/importar",
    linkLabel: "Importar y exportar",
  },
  {
    id: "sharing",
    title: "Compartir el espacio",
    words: [
      "compartir",
      "invitar",
      "invitacion",
      "miembro",
      "permisos",
      "espacio compartido",
    ],
    area: "soporte",
    answer:
      "Desde Configuración → Compartir, el dueño puede administrar invitaciones y permisos. El espacio compartido requiere las condiciones de Pro y cada miembro usa su propia cuenta. No compartan contraseñas. Un permiso de lectura no permite editar.",
    link: "/app/configuracion?tab=compartir",
    linkLabel: "Ver espacio compartido",
  },
  {
    id: "support",
    title: "Hablar con el equipo",
    words: [
      "humano",
      "persona",
      "equipo",
      "soporte",
      "contacto",
      "asesor",
      "reclamo",
    ],
    area: "soporte",
    answer:
      "Puedo dejar tu consulta al equipo manteniendo esta conversación. Atendemos de lunes a viernes, de 9 a 17 h (Argentina). Te avisaremos por correo cuando haya una respuesta para que vuelvas a este mismo caso. No es un chat humano disponible las 24 horas.",
    link: "/contacto",
    linkLabel: "Otros canales de consulta",
  },
  {
    id: "duplicate-payments",
    title: "Revisar pagos o cobros repetidos",
    words: ["duplicado", "duplicados", "repetido", "repetidos", "repetidos en proximos", "duplicados en proximos", "orden alfabetico"],
    area: "soporte",
    answer: "En Próximos pagos y cobros buscá el concepto y elegí Nombre (A–Z) o Solo posibles repetidos. La señal Revisar coincidencia no confirma que sobre un registro. Revisá fecha, importe original y origen antes de cancelar; no se elimina nada automáticamente. Cancelar una ocurrencia afecta esa vez; para detener las próximas revisá la regla recurrente. No uses Pagar o Cobrar para quitar repetidos.",
    link: "/app/proximos?orden=nombre&coincidencias=1",
    linkLabel: "Revisar coincidencias",
  },
  {
    id: "budgets",
    title: "Presupuestos por categoría",
    words: ["presupuesto", "limites de gasto", "categoria de gasto"],
    area: "soporte",
    answer:
      "En Presupuestos elegí el mes y agregá las categorías que querés controlar. Cada una tiene su límite, gasto real y pendientes. Un límite no es un gasto. Activá «Incluir lo que queda en la proyección» para estimar el remanente al fin de ese mes, descontando lo gastado y lo ya previsto, incluidos recurrentes y suscripciones por categoría. La estimación no crea pagos ni movimientos y no se extiende sola a otros meses. Las categorías sin límite se muestran por separado y no descuentan del presupuesto. Podés corregir los límites sin borrar movimientos.",
    link: "/app/presupuestos",
    linkLabel: "Ver Presupuestos",
  },
  {
    id: "goals",
    title: "Objetivos de ahorro",
    words: [
      "objetivo",
      "meta de ahorro",
      "vacaciones",
      "aporte mensual",
      "ahorrar",
    ],
    area: "soporte",
    answer:
      "En Objetivos cargá una meta, su importe, moneda y fecha. Registrá tus aportes para ver el progreso y el monto que falta. En «Editar objetivo» podés cambiar nombre, meta, fecha y aporte previsto sin alterar la moneda ni los aportes guardados. El simulador del aporte muestra cómo cambia la fecha estimada; no mueve dinero ni garantiza rendimientos.",
    link: "/app/objetivos",
    linkLabel: "Ver Objetivos",
  },
  {
    id: "debts",
    title: "Deudas y préstamos",
    words: ["deuda", "prestamo", "cronograma", "amortizacion"],
    area: "soporte",
    answer:
      "En Deudas y préstamos podés cargar las condiciones y revisar el cronograma. Si importás un contrato, verificá los datos antes de guardar. Cuando pagás una cuota, registrá el importe real. La app organiza tus registros: no otorga préstamos ni paga al acreedor.",
    link: "/app/deudas",
    linkLabel: "Ver Deudas y préstamos",
  },
  {
    id: "wealth",
    title: "Inversiones y patrimonio",
    words: [
      "inversion",
      "patrimonio",
      "cedear",
      "bono",
      "cripto",
      "plazo fijo",
      "fci",
    ],
    area: "soporte",
    answer:
      "En Inversiones y patrimonio podés registrar lo invertido y sus movimientos. Lo invertido se muestra separado del dinero disponible para gastar hoy. Revisá los precios y las fechas de valuación; los datos de la app no son una recomendación de compra o venta.",
    link: "/app/patrimonio",
    linkLabel: "Ver Inversiones y patrimonio",
  },
  {
    id: "agro",
    title: "Agro y ventas de cereal",
    words: ["agro", "cereal", "granos", "tonelada", "quintal", "soja", "maiz"],
    area: "soporte",
    answer:
      "Con Pro podés activar Agro desde Configuración → Funciones. En Ventas de cereal registrás cantidad, precio, impuestos, descuentos y fecha de cobro. Lo pendiente se proyecta; al liquidar cargá el importe real para que el mismo cobro no se cuente dos veces.",
    link: "/app/cereal",
    linkLabel: "Ver Ventas de cereal",
  },
  {
    id: "forecast",
    title: "Flujo de caja y próximos pagos",
    words: [
      "flujo de caja",
      "proyeccion",
      "mes en rojo",
      "calendario",
      "proximo pago",
      "vencimientos",
    ],
    area: "soporte",
    answer:
      "En Flujo de caja ves ingresos, pagos y saldo proyectado según lo que cargaste. Podés distinguir lo confirmado de lo que se repite. El flujo incluye el remanente de los presupuestos que activaste como estimación al final de cada mes, salvo en «Solo lo confirmado». Próximos pagos y cobros y Calendario muestran vencimientos; registrar un pago pendiente lo convierte en un movimiento. Revisá que estén cargados todos tus compromisos.",
    link: "/app/flujo",
    linkLabel: "Ver Flujo de caja",
  },
] as const;
export type ChatTopic = (typeof CHAT_TOPICS)[number];
export const normalizeChat = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function matchChatHelp(text: string) {
  const s = normalizeChat(text);
  if (
    /cobraron|cobro duplicado|pague|pago aprobado|reembolso|devolucion|contracargo|arrepentimiento|robaron|hacke|acceso sospechoso|borrar.*datos|eliminar.*cuenta/.test(
      s,
    )
  )
    return {
      topic: null,
      escalate: true,
      urgent: true,
      area: /privacidad|datos|eliminar|robaron|hacke|sospechoso/.test(s)
        ? "privacidad"
        : "pagos",
    };
  if (/persona|humano|hablar.*equipo|asesor|reclamo/.test(s))
    return {
      topic: CHAT_TOPICS.find((t) => t.id === "support")!,
      escalate: true,
      urgent: /reclamo/.test(s),
      area: /reclamo/.test(s) ? "reclamos" : "soporte",
    };
  const scored = CHAT_TOPICS.map((topic) => ({
    topic,
    score: topic.words.reduce(
      (n, w) =>
        n +
        ((
          w.length <= 4
            ? new RegExp(`(?:^|[^a-z0-9])${w}(?:$|[^a-z0-9])`).test(s)
            : s.includes(w)
        )
          ? w.split(" ").length
          : 0),
      0,
    ),
  })).sort((a, b) => b.score - a.score);
  const best = scored[0];
  return {
    topic: best.score > 0 ? best.topic : null,
    escalate: best.score === 0,
    urgent: false,
    area: best.score > 0 ? best.topic.area : "soporte",
  };
}
export function containsChatSecret(text: string) {
  if (
    /^\d{6}$/.test(text.trim()) ||
    /(?:c[oó]digo|otp)\s*(?:es|:)?\s*\d{6}\b|(?:cvv|cvc)\s*(?:es|:)?\s*\d{3,4}\b/i.test(
      text,
    )
  )
    return true;
  return /(?:APP_USR-|TEST-\d{8,}|sk_(?:live|test)_|Bearer\s+[A-Za-z0-9_-]{15,}|-----BEGIN .*PRIVATE KEY-----|(?:mi\s+)?contrase[nñ]a\s+(?:es|:)\s*\S+)/i.test(
    text,
  );
}
export const CASE_STATUS: Record<string, string> = {
  OPEN: "Nuevo",
  IN_PROGRESS: "En atención",
  ANSWERED: "Esperando tu respuesta",
  WAITING_INTERNAL: "En revisión interna",
  RESOLVED: "Resuelto",
  CLOSED: "Cerrado",
};
export const ADMIN_CASE_STATUS: Record<string, string> = { ...CASE_STATUS, ANSWERED: "Esperando al cliente" };
export const CASE_OPEN = ["OPEN", "IN_PROGRESS", "WAITING_INTERNAL"];
