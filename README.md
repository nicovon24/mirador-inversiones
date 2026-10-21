# Mirador

Investment tracking for public markets, research, watchlists, portfolios, and alerts. Built with Next.js 16, Prisma 7, and PostgreSQL.

## Access

Home, Markets, instruments, Learn, and Glossary are available without signing in. Research, Portfolio, Watchlists, Alerts, and Settings require Google sign-in. Only `fervon96@gmail.com` and `nicovon24@gmail.com` are authorized, and each account can see only its own data. Connecting IOL from Portfolio is optional and uses OAuth for that account.

Google sign-in requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `MIRADOR_APP_URL`. In Google Cloud, register exactly `${MIRADOR_APP_URL}/api/auth/google/callback` as the redirect URI. Use `http://localhost:3000` for local development and `http://localhost:3001` for Docker on port 3001. Each environment needs its own fixed URL and credentials. The application validates the Google identity and email allowlist on the server.

## Local development

1. Create `.env` from `.env.example` and configure an isolated development database. Check the URL before running any migration. Never use the production database for testing.
2. Run `npm install`.
3. Run `docker compose up -d db` to start local PostgreSQL.
4. Run `npm run db:migrate` and `npm run db:seed` against that local database.
5. Run `npm run dev` and open <http://localhost:3000>.

## Docker

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`, and register `http://localhost:3001/api/auth/google/callback` in the Google web client. Then run `docker compose up --build -d` and open <http://localhost:3001>. Compose sets `MIRADOR_APP_URL=http://localhost:3001` and enables HTTP only for this local environment. It also starts the local database, applies migrations, and loads only the public catalog. Data persists in `mirador-db`.

## Data sources and alerts

| Source | Configuration | Use |
| --- | --- | --- |
| data912 and Yahoo | No key required | Public quotes, which may be delayed |
| Finnhub | `FINNHUB_API_KEY` | U.S. data and research |
| InvertirOnline | `IOL_SESSION_SECRET`, `IOL_MCP_CALLBACK_URI` | Personal, read-only OAuth connection from Portfolio |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Alerts linked to the Mirador account |

The `/api/cron/alerts` cron job requires `CRON_SECRET`. The Telegram webhook validates its own secret. Telegram linking codes expire, can be used once, and belong to the account that created them in Settings.

## Vercel

1. Verify that the Vercel project and repository match the domain you intend to publish.
2. In **Production**, configure `DATABASE_URL`, `MIRADOR_APP_URL=https://mirador-inversiones.vercel.app`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`. Register `https://mirador-inversiones.vercel.app/api/auth/google/callback` in a Google web client for production. Configure `IOL_SESSION_SECRET` and `IOL_MCP_CALLBACK_URI` if IOL will be used. `DIRECT_URL` may specify the direct connection for migrations. Do not configure `MIRADOR_LOCAL_AUTH` in Vercel.
3. In **Preview** and **Development**, use a separate database, origin, and Google client. The callback must match a stable domain for each environment. Private sign-in remains disabled if this configuration is missing.
4. Back up the database and review the migration before running `npm run db:migrate:deploy`. Previous private records remain quarantined without an owner; they are never assigned to the first account that signs in. Attribution requires verified ownership and an explicit procedure.
5. Test the full flow on the production domain: public pages for visitors and redirects to `/login` for private pages; sign-in with each of the two authorized emails; rejection of a third party; separate portfolios; and sign-out that revokes the cookie and returns to Home. Verify that the IOL connection is available only to the account that authorized it. Do not reactivate older deployments that exposed the shared portfolio.

Remove `IOL_USERNAME`, `IOL_PASSWORD`, `APP_ACCESS_USER`, and `APP_ACCESS_PASSWORD` from Development, Preview, and Production, including branch-specific variables. Those variables belong to the previous access model and are not used in this version. Public quotes for Argentina use data912. Personal IOL connections retain their OAuth variables and encryption key.

Verification commands: `npm test`, `npm run lint`, and `npm run build`.
