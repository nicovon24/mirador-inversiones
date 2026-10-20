# Mirador

Seguimiento de inversiones con mercados públicos, investigación, listas, portafolio y alertas. Next.js 16, Prisma 7 y PostgreSQL.

## Acceso

Inicio, Mercados, instrumentos, Aprender y Glosario se pueden consultar sin ingresar. Investigación, Portafolio, Favoritos, Alertas y Ajustes requieren Google. Solo `fervon96@gmail.com` y `nicovon24@gmail.com` están autorizados, y cada cuenta ve sus propios datos. Conectar IOL desde Portafolio es opcional y se hace con OAuth para esa cuenta.

El ingreso con Google necesita `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `MIRADOR_APP_URL`. En Google Cloud, registrar exactamente `${MIRADOR_APP_URL}/api/auth/google/callback` como URI de redirección. Para desarrollo local usar `http://localhost:3000`; para Docker publicado en el puerto 3001 usar `http://localhost:3001`. Cada entorno requiere su URL fija y sus credenciales propias. La aplicación valida la identidad Google y la lista de correos en el servidor.

## Desarrollo local

1. Crear `.env` desde `.env.example` y configurar una base de desarrollo aislada. Comprobar la URL antes de ejecutar cualquier migración. No usar la base de producción para pruebas.
2. `npm install`
3. `docker compose up -d db` para PostgreSQL local.
4. `npm run db:migrate` y `npm run db:seed` contra esa base local.
5. `npm run dev` y abrir <http://localhost:3000>.

## Docker

Configurar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env`, y registrar `http://localhost:3001/api/auth/google/callback` en el cliente web de Google. Luego ejecutar `docker compose up --build -d` y abrir <http://localhost:3001>. Compose fija `MIRADOR_APP_URL=http://localhost:3001` y habilita HTTP solo para este entorno local. También levanta la base local, aplica las migraciones y carga solo el catálogo público. Los datos persisten en `mirador-db`.

## Fuentes y alertas

| Fuente | Configuración | Uso |
| --- | --- | --- |
| data912 y Yahoo | Sin clave | Cotizaciones públicas, con posible demora |
| Finnhub | `FINNHUB_API_KEY` | Datos de EE.UU. e investigación |
| InvertirOnline | `IOL_SESSION_SECRET`, `IOL_MCP_CALLBACK_URI` | Conexión OAuth personal y de lectura desde Portafolio |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Alertas vinculadas a la cuenta Mirador |

El cron `/api/cron/alerts` requiere `CRON_SECRET`. El webhook de Telegram valida su propio secreto. El código de vinculación Telegram vence, se usa una vez y pertenece a quien lo generó en Ajustes.

## Vercel

1. Verificar que el proyecto Vercel y el repositorio correspondan al dominio que se va a publicar.
2. Configurar en **Production** `DATABASE_URL`, `MIRADOR_APP_URL=https://mirador-inversiones.vercel.app`, `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Registrar `https://mirador-inversiones.vercel.app/api/auth/google/callback` en un cliente web de Google para producción. Configurar `IOL_SESSION_SECRET` e `IOL_MCP_CALLBACK_URI` si se usará IOL. `DIRECT_URL` puede indicar la conexión directa para migraciones. No configurar `MIRADOR_LOCAL_AUTH` en Vercel.
3. En **Preview** y **Development**, usar una base, origen y cliente Google propios. El callback debe coincidir con un dominio estable por entorno. Si falta esa configuración, el ingreso privado queda cerrado.
4. Hacer respaldo y revisar la migración antes de `npm run db:migrate:deploy`. Los registros privados anteriores quedan en cuarentena sin dueño; no se asignan a la primera cuenta que ingresa. La atribución requiere confirmar titularidad y un procedimiento explícito.
5. Probar el recorrido completo en el dominio productivo: visitante en páginas públicas y redirección a `/login` en páginas privadas; ingreso con cada uno de los dos correos autorizados; rechazo de un tercero; portafolios separados; cierre de sesión que revoca la cookie y vuelve a Inicio. Verificar la conexión IOL solo en la cuenta que la autorizó. No reactivar despliegues antiguos que exponían la cartera global.

Eliminar `IOL_USERNAME`, `IOL_PASSWORD`, `APP_ACCESS_USER` y `APP_ACCESS_PASSWORD` de Development, Preview y Production, incluidas variables específicas de ramas. Esas variables pertenecen al acceso anterior y no se usan en esta versión. La cotización pública de Argentina usa data912. La conexión IOL personal mantiene sus variables OAuth y su clave de cifrado.

Comandos de comprobación: `npm test`, `npm run lint`, `npm run build`.
