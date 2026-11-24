# Probar la app en la computadora

Solo para la base local de prueba (`.data/pglite-movil`). Nunca se usa contra la base real.

1. Base local: `npm run db:local` con `PGLITE_DIR=.data/pglite-movil`, y después `npm run db:migrate`.
2. Web: `npm run dev`. La app está en `http://localhost:3000/movil` (o el puerto que indique).
3. Usuario de prueba local: `demo@somosguafra.test`, contraseña `Guafra-Prueba-2026!`.
4. Datos de ejemplo: `npx tsx scripts/seed-demo.mts demo@somosguafra.test`.
