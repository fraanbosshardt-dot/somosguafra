# Inventario de rutas, acciones y persistencia

Snapshot: d05880ea36d8d0a6dbb951e7913969f5d07dee3a. Inventario generado desde archivos, no prueba de transporte ni permisos. Los límites concretos se revisan en seguridad.md y pagos.md.

## Route handlers

| Ruta | Métodos declarados | Archivo |
|---|---|---|
| `/admin/export/[kind]` | GET | `src/app/admin/export/[kind]/route.ts` |
| `/admin/export/cuenta/[id]` | GET | `src/app/admin/export/cuenta/[id]/route.ts` |
| `/api/auth/google/callback` | GET | `src/app/api/auth/google/callback/route.ts` |
| `/api/auth/google` | GET | `src/app/api/auth/google/route.ts` |
| `/api/cron/cobros` | GET | `src/app/api/cron/cobros/route.ts` |
| `/api/cron/diario` | GET | `src/app/api/cron/diario/route.ts` |
| `/api/health/operaciones` | GET | `src/app/api/health/operaciones/route.ts` |
| `/api/health` | GET | `src/app/api/health/route.ts` |
| `/api/inversiones/buscar` | GET | `src/app/api/inversiones/buscar/route.ts` |
| `/api/mi-plan` | GET | `src/app/api/mi-plan/route.ts` |
| `/api/pagos/mercadopago` | POST | `src/app/api/pagos/mercadopago/route.ts` |
| `/api/push/aviso` | GET | `src/app/api/push/aviso/route.ts` |
| `/api/push/prueba` | POST | `src/app/api/push/prueba/route.ts` |
| `/api/push/suscribir` | POST, DELETE | `src/app/api/push/suscribir/route.ts` |
| `/api/rapido` | GET | `src/app/api/rapido/route.ts` |
| `/api/webhooks/resend` | POST | `src/app/api/webhooks/resend/route.ts` |
| `/app/configuracion/mis-datos` | GET | `src/app/app/configuracion/mis-datos/route.ts` |
| `/app/exportar/excel` | GET | `src/app/app/exportar/excel/route.ts` |
| `/app/exportar/movimientos` | GET | `src/app/app/exportar/movimientos/route.ts` |
| `/app/exportar/respaldo` | GET | `src/app/app/exportar/respaldo/route.ts` |
| `/icons/[size]` | GET | `src/app/icons/[size]/route.tsx` |
| `/invitacion/[token]/continuar` | GET | `src/app/invitacion/[token]/continuar/route.ts` |
| `/pagos/volver` | GET | `src/app/pagos/volver/route.ts` |
| `/suscribirme` | GET | `src/app/suscribirme/route.ts` |

## Páginas

| Ruta patrón | Archivo |
|---|---|
| `/[doc]` | `src/app/(legal)/[doc]/page.tsx` |
| `/admin/actividad` | `src/app/admin/(panel)/actividad/page.tsx` |
| `/admin/ajustes` | `src/app/admin/(panel)/ajustes/page.tsx` |
| `/admin/cobros` | `src/app/admin/(panel)/cobros/page.tsx` |
| `/admin/comunicaciones` | `src/app/admin/(panel)/comunicaciones/page.tsx` |
| `/admin/consultas` | `src/app/admin/(panel)/consultas/page.tsx` |
| `/admin/equipo` | `src/app/admin/(panel)/equipo/page.tsx` |
| `/admin/finanzas` | `src/app/admin/(panel)/finanzas/page.tsx` |
| `/admin` | `src/app/admin/(panel)/page.tsx` |
| `/admin/sistema` | `src/app/admin/(panel)/sistema/page.tsx` |
| `/admin/soporte` | `src/app/admin/(panel)/soporte/page.tsx` |
| `/admin/usuarios/[id]` | `src/app/admin/(panel)/usuarios/[id]/page.tsx` |
| `/admin/usuarios` | `src/app/admin/(panel)/usuarios/page.tsx` |
| `/admin/ingresar` | `src/app/admin/ingresar/page.tsx` |
| `/app/alertas` | `src/app/app/alertas/page.tsx` |
| `/app/ayuda` | `src/app/app/ayuda/page.tsx` |
| `/app/buscar` | `src/app/app/buscar/page.tsx` |
| `/app/calendario` | `src/app/app/calendario/page.tsx` |
| `/app/categorias` | `src/app/app/categorias/page.tsx` |
| `/app/cereal/[id]` | `src/app/app/cereal/[id]/page.tsx` |
| `/app/cereal` | `src/app/app/cereal/page.tsx` |
| `/app/configuracion` | `src/app/app/configuracion/page.tsx` |
| `/app/contratar` | `src/app/app/contratar/page.tsx` |
| `/app/cuentas/[id]` | `src/app/app/cuentas/[id]/page.tsx` |
| `/app/cuentas` | `src/app/app/cuentas/page.tsx` |
| `/app/deudas/[id]` | `src/app/app/deudas/[id]/page.tsx` |
| `/app/deudas` | `src/app/app/deudas/page.tsx` |
| `/app/flujo` | `src/app/app/flujo/page.tsx` |
| `/app/importar` | `src/app/app/importar/page.tsx` |
| `/app/informes` | `src/app/app/informes/page.tsx` |
| `/app/inversiones` | `src/app/app/inversiones/page.tsx` |
| `/app/movimientos/[id]` | `src/app/app/movimientos/[id]/page.tsx` |
| `/app/movimientos/nuevo` | `src/app/app/movimientos/nuevo/page.tsx` |
| `/app/movimientos` | `src/app/app/movimientos/page.tsx` |
| `/app/objetivos` | `src/app/app/objetivos/page.tsx` |
| `/app` | `src/app/app/page.tsx` |
| `/app/patrimonio` | `src/app/app/patrimonio/page.tsx` |
| `/app/presupuestos` | `src/app/app/presupuestos/page.tsx` |
| `/app/proximos/[id]` | `src/app/app/proximos/[id]/page.tsx` |
| `/app/proximos` | `src/app/app/proximos/page.tsx` |
| `/app/recurrentes` | `src/app/app/recurrentes/page.tsx` |
| `/app/revision` | `src/app/app/revision/page.tsx` |
| `/app/simulador` | `src/app/app/simulador/page.tsx` |
| `/app/tarjetas/[id]` | `src/app/app/tarjetas/[id]/page.tsx` |
| `/app/tarjetas` | `src/app/app/tarjetas/page.tsx` |
| `/bienvenida` | `src/app/bienvenida/page.tsx` |
| `/confirmar-correo` | `src/app/confirmar-correo/page.tsx` |
| `/consulta/[token]` | `src/app/consulta/[token]/page.tsx` |
| `/contacto` | `src/app/contacto/page.tsx` |
| `/glosario` | `src/app/glosario/page.tsx` |
| `/guias/[slug]` | `src/app/guias/[slug]/page.tsx` |
| `/guias` | `src/app/guias/page.tsx` |
| `/herramientas/conversor-de-monedas` | `src/app/herramientas/conversor-de-monedas/page.tsx` |
| `/herramientas/cuotas` | `src/app/herramientas/cuotas/page.tsx` |
| `/herramientas/fondo-de-emergencia` | `src/app/herramientas/fondo-de-emergencia/page.tsx` |
| `/herramientas` | `src/app/herramientas/page.tsx` |
| `/herramientas/plazo-fijo` | `src/app/herramientas/plazo-fijo/page.tsx` |
| `/herramientas/prestamo` | `src/app/herramientas/prestamo/page.tsx` |
| `/herramientas/presupuesto-50-30-20` | `src/app/herramientas/presupuesto-50-30-20/page.tsx` |
| `/ingresar` | `src/app/ingresar/page.tsx` |
| `/invitacion/[token]` | `src/app/invitacion/[token]/page.tsx` |
| `/novedades` | `src/app/novedades/page.tsx` |
| `/offline` | `src/app/offline/page.tsx` |
| `/` | `src/app/page.tsx` |
| `/productores` | `src/app/productores/page.tsx` |
| `/quienes-somos` | `src/app/quienes-somos/page.tsx` |
| `/recuperar/[token]` | `src/app/recuperar/[token]/page.tsx` |
| `/recuperar` | `src/app/recuperar/page.tsx` |
| `/registro` | `src/app/registro/page.tsx` |
| `/reporte` | `src/app/reporte/page.tsx` |
| `/seguridad` | `src/app/seguridad/page.tsx` |
| `/verificar` | `src/app/verificar/page.tsx` |
| `/verificar-correo/[token]` | `src/app/verificar-correo/[token]/page.tsx` |

`/[doc]` resuelve terminos, privacidad, reembolsos, cookies y arrepentimiento. `/guias/[slug]` genera las guías de src/content/guides.ts. Metadatos adicionales: robots.ts, sitemap.ts, manifest.ts y opengraph-image.tsx.

## Acciones del servidor

Cada acción exportada constituye superficie HTTP de Server Actions aunque no tenga URL API dedicada.

| Función | Archivo:línea |
|---|---|
| `adminCaseToolsAction` | `src/app/actions/admin.ts:24` |
| `adminLogoutAction` | `src/app/actions/admin.ts:38` |
| `adminDevLoginAction` | `src/app/actions/admin.ts:44` |
| `adminSetPlanAction` | `src/app/actions/admin.ts:56` |
| `adminGiftProAction` | `src/app/actions/admin.ts:67` |
| `adminSuspendAction` | `src/app/actions/admin.ts:77` |
| `adminReset2faAction` | `src/app/actions/admin.ts:90` |
| `adminCloseSessionsAction` | `src/app/actions/admin.ts:98` |
| `adminDeleteAccountAction` | `src/app/actions/admin.ts:106` |
| `adminAddGrantAction` | `src/app/actions/admin.ts:122` |
| `adminDeleteGrantAction` | `src/app/actions/admin.ts:143` |
| `adminCreateCouponAction` | `src/app/actions/admin.ts:152` |
| `adminToggleCouponAction` | `src/app/actions/admin.ts:168` |
| `adminCancelSubAction` | `src/app/actions/admin.ts:177` |
| `adminReplyTicketAction` | `src/app/actions/admin.ts:189` |
| `adminCloseTicketAction` | `src/app/actions/admin.ts:201` |
| `adminTicketPriorityAction` | `src/app/actions/admin.ts:209` |
| `adminSaveReplyAction` | `src/app/actions/admin.ts:218` |
| `adminDeleteReplyAction` | `src/app/actions/admin.ts:230` |
| `adminSaveAnnouncementAction` | `src/app/actions/admin.ts:239` |
| `adminClearAnnouncementAction` | `src/app/actions/admin.ts:253` |
| `adminSendCampaignAction` | `src/app/actions/admin.ts:261` |
| `adminAddNewsAction` | `src/app/actions/admin.ts:266` |
| `adminDeleteNewsAction` | `src/app/actions/admin.ts:277` |
| `adminAddCostAction` | `src/app/actions/admin.ts:286` |
| `adminDeleteCostAction` | `src/app/actions/admin.ts:298` |
| `adminSavePlansAction` | `src/app/actions/admin.ts:306` |
| `adminSaveSystemAction` | `src/app/actions/admin.ts:323` |
| `adminAddMemberAction` | `src/app/actions/admin.ts:338` |
| `adminSetRoleAction` | `src/app/actions/admin.ts:350` |
| `adminRemoveMemberAction` | `src/app/actions/admin.ts:360` |
| `adminRevokeSessionAction` | `src/app/actions/admin.ts:371` |
| `adminReplyContactAction` | `src/app/actions/admin.ts:381` |
| `adminContactStatusAction` | `src/app/actions/admin.ts:393` |
| `adminSaveContactAction` | `src/app/actions/admin.ts:403` |
| `adminAddExpenseAction` | `src/app/actions/admin.ts:417` |
| `adminSettlementAction` | `src/app/actions/admin.ts:424` |
| `adminExcludeMetricsAction` | `src/app/actions/admin.ts:430` |
| `finishOnboardingAction` | `src/app/actions/app.ts:46` |
| `createAccountAction` | `src/app/actions/app.ts:100` |
| `updateAccountAction` | `src/app/actions/app.ts:124` |
| `reorderAccountsAction` | `src/app/actions/app.ts:138` |
| `toggleAccountAction` | `src/app/actions/app.ts:145` |
| `reconcileAction` | `src/app/actions/app.ts:161` |
| `createMovementAction` | `src/app/actions/app.ts:174` |
| `linkToPendingAction` | `src/app/actions/app.ts:256` |
| `payObligationAction` | `src/app/actions/app.ts:265` |
| `quickConfirmAction` | `src/app/actions/app.ts:278` |
| `cancelObligationAction` | `src/app/actions/app.ts:302` |
| `createCategoryAction` | `src/app/actions/app.ts:310` |
| `updateProfileAction` | `src/app/actions/app.ts:327` |
| `saveModulesAction` | `src/app/actions/app.ts:349` |
| `start2faAction` | `src/app/actions/app.ts:360` |
| `twoFactorQr` | `src/app/actions/app.ts:367` |
| `confirm2faAction` | `src/app/actions/app.ts:374` |
| `disable2faAction` | `src/app/actions/app.ts:387` |
| `revokeOtherSessionsAction` | `src/app/actions/app.ts:401` |
| `updateMovementAction` | `src/app/actions/app.ts:410` |
| `updateObligationAction` | `src/app/actions/app.ts:431` |
| `deleteObligationAction` | `src/app/actions/app.ts:448` |
| `bulkPayAction` | `src/app/actions/app.ts:460` |
| `bulkMovementsAction` | `src/app/actions/app.ts:484` |
| `deleteMovementAction` | `src/app/actions/app.ts:512` |
| `setBigTextAction` | `src/app/actions/app.ts:527` |
| `resendVerifyAction` | `src/app/actions/app.ts:533` |
| `verifyEmailCodeAction` | `src/app/actions/app.ts:545` |
| `emailRemindersAction` | `src/app/actions/app.ts:563` |
| `deleteCategoryAction` | `src/app/actions/app.ts:569` |
| `deleteMyAccountAction` | `src/app/actions/app.ts:584` |
| `updateCategoryAction` | `src/app/actions/app.ts:605` |
| `signupAction` | `src/app/actions/auth.ts:27` |
| `loginAction` | `src/app/actions/auth.ts:50` |
| `verifyLoginCodeAction` | `src/app/actions/auth.ts:76` |
| `logoutAction` | `src/app/actions/auth.ts:102` |
| `requestResetAction` | `src/app/actions/auth.ts:109` |
| `resetPasswordAction` | `src/app/actions/auth.ts:133` |
| `contactAction` | `src/app/actions/contact.ts:12` |
| `createRuleAction` | `src/app/actions/modules.ts:52` |
| `changeRuleAction` | `src/app/actions/modules.ts:78` |
| `saveRuleAction` | `src/app/actions/modules.ts:90` |
| `setRuleEndAction` | `src/app/actions/modules.ts:123` |
| `deleteRuleAction` | `src/app/actions/modules.ts:135` |
| `pauseRuleAction` | `src/app/actions/modules.ts:144` |
| `endRuleAction` | `src/app/actions/modules.ts:151` |
| `createCardAction` | `src/app/actions/modules.ts:174` |
| `updateCardAction` | `src/app/actions/modules.ts:186` |
| `deleteCardAction` | `src/app/actions/modules.ts:198` |
| `setCycleAction` | `src/app/actions/modules.ts:207` |
| `cardPurchaseAction` | `src/app/actions/modules.ts:217` |
| `cardRefundAction` | `src/app/actions/modules.ts:231` |
| `advancePlanAction` | `src/app/actions/modules.ts:241` |
| `addSubscriptionAction` | `src/app/actions/modules.ts:248` |
| `endSubscriptionAction` | `src/app/actions/modules.ts:260` |
| `createDebtAction` | `src/app/actions/modules.ts:284` |
| `updateDebtAction` | `src/app/actions/modules.ts:304` |
| `deleteDebtAction` | `src/app/actions/modules.ts:325` |
| `cancelDebtAction` | `src/app/actions/modules.ts:334` |
| `payDebtOnAccountAction` | `src/app/actions/modules.ts:345` |
| `saveBudgetAction` | `src/app/actions/modules.ts:356` |
| `copyBudgetAction` | `src/app/actions/modules.ts:368` |
| `createGoalAction` | `src/app/actions/modules.ts:374` |
| `contributeAction` | `src/app/actions/modules.ts:382` |
| `updateGoalPlanAction` | `src/app/actions/modules.ts:389` |
| `deleteGoalAction` | `src/app/actions/modules.ts:397` |
| `createInvestmentAction` | `src/app/actions/modules.ts:405` |
| `createHoldingAction` | `src/app/actions/modules.ts:418` |
| `holdingTradeAction` | `src/app/actions/modules.ts:431` |
| `deleteInvestmentAction` | `src/app/actions/modules.ts:440` |
| `deleteAssetAction` | `src/app/actions/modules.ts:448` |
| `manualPriceAction` | `src/app/actions/modules.ts:456` |
| `investmentMoveAction` | `src/app/actions/modules.ts:465` |
| `valuationAction` | `src/app/actions/modules.ts:474` |
| `createAssetAction` | `src/app/actions/modules.ts:483` |
| `rateAction` | `src/app/actions/modules.ts:491` |
| `grainSaleAction` | `src/app/actions/modules.ts:512` |
| `updateGrainSaleAction` | `src/app/actions/modules.ts:522` |
| `deleteGrainSaleAction` | `src/app/actions/modules.ts:535` |
| `changeMonthlyGrainAction` | `src/app/actions/modules.ts:546` |
| `stopMonthlyGrainAction` | `src/app/actions/modules.ts:559` |
| `grainStockAction` | `src/app/actions/modules.ts:570` |
| `deleteGrainStockAction` | `src/app/actions/modules.ts:583` |
| `monthlyGrainAction` | `src/app/actions/modules.ts:591` |
| `importAction` | `src/app/actions/modules.ts:605` |
| `revertImportAction` | `src/app/actions/modules.ts:631` |
| `startTrialAction` | `src/app/actions/modules.ts:639` |
| `supportTicketAction` | `src/app/actions/modules.ts:647` |
| `checkoutAction` | `src/app/actions/modules.ts:673` |
| `discardCheckoutAction` | `src/app/actions/modules.ts:714` |
| `cancelPlanAction` | `src/app/actions/modules.ts:726` |
| `loadStatementAction` | `src/app/actions/modules.ts:737` |
| `readStatementPdfAction` | `src/app/actions/modules.ts:774` |
| `readDebtPdfAction` | `src/app/actions/modules.ts:802` |
| `projectedAction` | `src/app/actions/modules.ts:822` |
| `saveScenarioAction` | `src/app/actions/modules.ts:842` |
| `deleteScenarioAction` | `src/app/actions/modules.ts:854` |
| `prepayDebtAction` | `src/app/actions/modules.ts:862` |
| `refinanceDebtAction` | `src/app/actions/modules.ts:877` |
| `generateRecoveryCodesAction` | `src/app/actions/recovery.ts:10` |
| `inviteAction` | `src/app/actions/sharing.ts:16` |
| `revokeInviteAction` | `src/app/actions/sharing.ts:31` |
| `changeRoleAction` | `src/app/actions/sharing.ts:37` |
| `removeMemberAction` | `src/app/actions/sharing.ts:43` |
| `leaveWorkspaceAction` | `src/app/actions/sharing.ts:52` |
| `switchWorkspaceAction` | `src/app/actions/sharing.ts:64` |
| `acceptInviteAction` | `src/app/actions/sharing.ts:71` |
| `supportFollowupAction` | `src/app/actions/support.ts:8` |

## Tablas y enums

| Modelo | Ubicación |
|---|---|
| `User` | `prisma/schema.prisma:21` |
| `RecoveryCode` | `prisma/schema.prisma:56` |
| `Session` | `prisma/schema.prisma:66` |
| `Role` | `prisma/schema.prisma:81` |
| `Workspace` | `prisma/schema.prisma:87` |
| `Membership` | `prisma/schema.prisma:128` |
| `PlanCode` | `prisma/schema.prisma:141` |
| `SubscriptionStatus` | `prisma/schema.prisma:146` |
| `Subscription` | `prisma/schema.prisma:153` |
| `AccountType` | `prisma/schema.prisma:174` |
| `Account` | `prisma/schema.prisma:185` |
| `CategoryKind` | `prisma/schema.prisma:207` |
| `Category` | `prisma/schema.prisma:212` |
| `TxType` | `prisma/schema.prisma:231` |
| `Direction` | `prisma/schema.prisma:242` |
| `Transaction` | `prisma/schema.prisma:248` |
| `ObligationDirection` | `prisma/schema.prisma:290` |
| `ObligationStatus` | `prisma/schema.prisma:295` |
| `Certainty` | `prisma/schema.prisma:302` |
| `Obligation` | `prisma/schema.prisma:309` |
| `Frequency` | `prisma/schema.prisma:344` |
| `WeekendRule` | `prisma/schema.prisma:356` |
| `RecurringRule` | `prisma/schema.prisma:363` |
| `AmortizationSystem` | `prisma/schema.prisma:394` |
| `Debt` | `prisma/schema.prisma:403` |
| `DebtInstallment` | `prisma/schema.prisma:433` |
| `CreditCard` | `prisma/schema.prisma:451` |
| `CardStatement` | `prisma/schema.prisma:481` |
| `InstallmentPlan` | `prisma/schema.prisma:497` |
| `CardCycle` | `prisma/schema.prisma:516` |
| `CardSubscription` | `prisma/schema.prisma:528` |
| `Budget` | `prisma/schema.prisma:546` |
| `BudgetLine` | `prisma/schema.prisma:560` |
| `Scenario` | `prisma/schema.prisma:571` |
| `Goal` | `prisma/schema.prisma:582` |
| `GoalContribution` | `prisma/schema.prisma:599` |
| `Investment` | `prisma/schema.prisma:611` |
| `InvestmentMovement` | `prisma/schema.prisma:632` |
| `Valuation` | `prisma/schema.prisma:645` |
| `Asset` | `prisma/schema.prisma:659` |
| `GrainSale` | `prisma/schema.prisma:675` |
| `PushSubscription` | `prisma/schema.prisma:695` |
| `WorkspaceInvite` | `prisma/schema.prisma:709` |
| `GrainStock` | `prisma/schema.prisma:725` |
| `ExchangeRate` | `prisma/schema.prisma:740` |
| `ImportBatch` | `prisma/schema.prisma:755` |
| `AuditLog` | `prisma/schema.prisma:766` |
| `AppSetting` | `prisma/schema.prisma:788` |
| `SupportTicket` | `prisma/schema.prisma:794` |
| `PasswordReset` | `prisma/schema.prisma:812` |
| `Invoice` | `prisma/schema.prisma:825` |
| `BillingAgreement` | `prisma/schema.prisma:854` |
| `EmailOutbox` | `prisma/schema.prisma:873` |
| `AdminMember` | `prisma/schema.prisma:894` |
| `AdminSession` | `prisma/schema.prisma:904` |
| `Coupon` | `prisma/schema.prisma:918` |
| `ProGrant` | `prisma/schema.prisma:931` |
| `CompanyCost` | `prisma/schema.prisma:941` |
| `ProductNews` | `prisma/schema.prisma:952` |
| `EmailCampaign` | `prisma/schema.prisma:959` |
| `ContactMessage` | `prisma/schema.prisma:971` |
| `SupportMessage` | `prisma/schema.prisma:994` |
| `PaymentEvent` | `prisma/schema.prisma:1011` |
| `ProductActivity` | `prisma/schema.prisma:1026` |
| `CompanyExpense` | `prisma/schema.prisma:1034` |
| `Quote` | `prisma/schema.prisma:1044` |
| `JobLease` | `prisma/schema.prisma:1057` |

25 migraciones versionadas; aplicadas satisfactoriamente a base local vacía durante esta auditoría. No se comparó drift contra producción.

## Variables de entorno

Nombres solamente; no se leyeron valores de archivos privados. El inventario no acredita configuración externa.

`ADMIN_EMAILS`, `APP_URL`, `AUTH_SECRET`, `CRON_SECRET`, `DATABASE_URL`, `DB_POOL_MAX`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `NODE_ENV`, `PDF_MONTHLY_LIMIT`, `RESEND_API_KEY`, `RESEND_RECEIVING_API_KEY`, `RESEND_WEBHOOK_SECRET`, `SUPPORT_EMAIL_FROM`, `SUPPORT_INBOUND_ENABLED`, `SUPPORT_RECEIVING_DOMAIN`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`
