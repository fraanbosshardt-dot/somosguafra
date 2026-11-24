# Entrega de usabilidad y seguimiento — 24/11/2026

## Cambios

- Configuración comparte estructura, ancho y navegación agrupada entre Perfil, Seguridad, Tus datos, Categorías, Recurrentes, Importar, Funciones, Mi plan y Compartir. En móvil mantiene selector agrupado. Perfil precede a aspecto y preferencias; monedas adicionales y funciones de Pro son ampliables.
- Inicio abre el alta de ingresos con Ingreso preseleccionado y gastos con Gasto. El checklist distingue ingresos habituales de movimientos aislados; puede omitirse un paso no aplicable en este dispositivo, sin agregar importes ficticios. Se conserva acceso para revisar la guía.
- Mi plan toma el ciclo de la solicitud pendiente cuando la URL no indica otro. Los controles de confirmación de reemplazo existentes se mantienen.
- Recurrentes permite corregir concepto, dirección, cuenta y categoría desde una fecha. Valida espacio/moneda/cuenta; conserva lo confirmado y rechaza regenerar fechas ya pagadas/canceladas. Serializa materialización y edición por espacio y evita editar una versión ya reemplazada. La estimación de cereal conserva su tratamiento de meses cubiertos por ventas reales, comprobado mediante su regresión específica.
- Objetivos agrupa editores excluyentes; movimientos anuncia selección accesible; simulador y lectura de PDF usan textos más precisos. Chat distingue pagos de Pro y ofrece temas del uso de la aplicación. Ayuda se actualiza con los comportamientos implementados.
- Admin agrega Intentos de contratación con filtros y paginación. Desde 24 h, un pending se clasifica «sin completar». No cambia el estado remoto, precios, acceso o churn; creating/uncertain y cierres en verificación permanecen identificados para revisión.
- Preferencias de correo independientes, desactivadas por defecto. Consentimiento registrado por versión y auditoría; enlace firmado de baja con POST, sin mutar al abrir el enlace. La baja suprime mensajes opcionales pendientes y conserva correos de servicio. La tabla nueva no suscribe usuarios existentes. El sender transaccional continúa bloqueando campañas: esta primera entrega prepara preferencias, no activa envíos promocionales.

## Datos y despliegue

Migración aditiva `20261124090000_communication_preferences`: tabla nueva con relación a User y valores false por defecto. No modifica registros financieros ni suscripciones existentes. Antes de publicar se generó una copia cifrada de 58 tablas y se verificó su descifrado; la clave se conserva separada del archivo y restringida a la cuenta local. Ni credenciales ni datos del respaldo se incorporan al repositorio.

Despliegue: CI de la rama debe aprobar tipos, migraciones sobre PostgreSQL de prueba, suite completa y build. Después del merge, verificar el despliegue del SHA exacto, disponibilidad y rutas clave. No hacer pagos reales como prueba.

Reversión: revertir el commit y redesplegar. Conservar la tabla aditiva y sus preferencias; no borrar consentimientos ni revertir datos financieros. El cierre remoto automático y campañas requieren su implementación y validación específicas, separadas de esta entrega.

## Evidencia de validación

Pruebas dirigidas: recurrencias y sus versiones, rechazo de cuentas ajenas, conservación de pagos y no duplicación, cereal, clasificación por antigüedad, preferencias y firma de baja. La suite completa inicial detectó una incompatibilidad con el caso de cereal, corregida antes de publicar; sus 7 pruebas y las de edición segura pasaron después de la corrección. Tipos comprobados. El resultado definitivo de CI y las revisiones visuales se registran en la entrega de GitHub.

La revisión visual usa un build de producción y base ficticia aislada. No equivale a una garantía de ausencia de errores ni a pruebas de tarjetas/pagos reales. Capturas privadas y de QA en `.data`, excluidas de Git.
