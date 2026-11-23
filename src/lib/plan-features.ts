// Catálogo público y claves de permisos compartidos por web, app y servidor.
export const FEATURE_KEYS = ["flujo5", "simulador", "cereal", "informes", "compartido", "ilimitado", "soporte", "pdf"] as const;
export type FeatureKey = typeof FEATURE_KEYS[number];
export type PlanFeature = { name: string; plan: "free" | "pro"; beta?: boolean; feature?: FeatureKey };
// beta: todavía en desarrollo; se habilita para Pro sin costo extra cuando esté lista.
export const PLAN_FEATURES: PlanFeature[] = [
  { name: "Cuentas, movimientos, ingresos y gastos", plan: "free" },
  { name: "Favoritos, compras divididas y resumen mensual", plan: "free" },
  { name: "Calculadora básica de compras en cuotas", plan: "free" },
  { name: "Tarjetas, cuotas y deudas", plan: "free" },
  { name: "Próximos pagos y calendario", plan: "free" },
  { name: "Presupuestos y objetivos de ahorro", plan: "free" },
  { name: "Flujo de caja a 1 año", plan: "free" },
  { name: "Alertas y consejos", plan: "free" },
  { name: "Inversiones y patrimonio", plan: "free" },
  { name: "Cotización del dólar en vivo", plan: "free" },
  { name: "Importar y exportar CSV", plan: "free" },
  { name: "Verificación en dos pasos", plan: "free" },
  { name: "Flujo de caja a 2, 3 y 5 años", plan: "pro", feature: "flujo5" },
  { name: "Escenarios comparativos", plan: "pro", feature: "simulador" },
  { name: "Módulo Agro: ventas de granos", plan: "pro", feature: "cereal" },
  { name: "Informes avanzados", plan: "pro", feature: "informes" },
  { name: "Reglas de categoría y revisión asistida de extractos", plan: "pro", feature: "informes" },
  { name: "Traslado opcional de margen de presupuestos", plan: "pro", feature: "informes" },
  { name: "Costo anual orientativo de servicios", plan: "pro", feature: "informes" },
  { name: "Leer el resumen de la tarjeta desde el PDF", plan: "pro", feature: "pdf" },
  { name: "Saldo día a día en el flujo de caja", plan: "pro", feature: "flujo5" },
  { name: "Exportar a Excel y PDF", plan: "pro", feature: "informes" },
  { name: "Importar Excel y OFX", plan: "pro", feature: "informes" },
  { name: "Espacio compartido (hasta 3 personas)", plan: "pro", feature: "compartido" },
  { name: "Cuentas y objetivos sin límite", plan: "pro", feature: "ilimitado" },
  { name: "Soporte prioritario (respuesta en 1 día hábil)", plan: "pro", feature: "soporte" },
];

export const FREE_LIMITS = { accounts: 5, goals: 3 };
