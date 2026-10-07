# Mirador

Seguimiento personal de inversiones: cotizaciones de Argentina y EE.UU., portafolio de InvertirOnline, gráficos de línea y velas, watchlists y alertas de precio por Telegram. Modo claro y oscuro.

Stack: Next.js 16 (App Router, Server Actions) · Tailwind 4 · shadcn/ui (Base UI) · Prisma 7 + Postgres · React Query · lightweight-charts.

## Puesta en marcha

```bash
npm install
cp .env.example .env        # completar lo que tengas (todo es opcional salvo DATABASE_URL)
npm run db:up               # Postgres local en Docker (puerto 5440)
npm run db:migrate
npm run db:seed             # lista inicial con GGAL, YPFD, AAPL, NVDA…
npm run dev
```

## Fuentes de datos

| Fuente | Variable | Qué aporta |
| --- | --- | --- |
| InvertirOnline | `IOL_USERNAME`, `IOL_PASSWORD` | Argentina en tiempo real y tu portafolio |
| Finnhub | `FINNHUB_API_KEY` | EE.UU. en tiempo real y ratios |
| data912 | — | Respaldo gratuito: paneles BYMA, EE.UU., MEP/CCL |
| Yahoo Finance | — | Índices (S&P, Nasdaq, Merval) y velas de EE.UU. |
| ArgentinaDatos | — | Riesgo país |

Sin claves la app funciona igual con las fuentes gratuitas (marcadas "puede tener demora"). Las credenciales viven solo en el servidor; el navegador consulta `/api/quotes` cada 5 s.

## Alertas por Telegram

1. Crear un bot con @BotFather y cargar `TELEGRAM_BOT_TOKEN`; definir `TELEGRAM_WEBHOOK_SECRET` (texto aleatorio largo).
2. Con la app desplegada (URL pública), ir a **Ajustes → Registrar webhook** y luego **Vincular Telegram** (envía `/start` con un código propio).
3. El evaluador es `GET /api/cron/alerts` con `Authorization: Bearer $CRON_SECRET`.
   - Vercel Hobby solo permite cron diario (`vercel.json` lo deja como respaldo).
   - Para cada minuto: crear un schedule en Upstash QStash apuntando a esa URL con el header de autorización, cron `* 13-20 * * 1-5` (horario de mercado en UTC).

## Scripts

- `npm test` — tests unitarios (formato es-AR, MEP/CCL, alertas, valuación con Decimal).
- `npm run build` — build de producción.

## Deploy en Vercel

1. Importar el repo, agregar Postgres (Neon) desde el Marketplace: crea `DATABASE_URL`.
2. Cargar el resto de variables de `.env.example`.
3. `npx prisma migrate deploy` contra la base de producción (o como paso de build).
