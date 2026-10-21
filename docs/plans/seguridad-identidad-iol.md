# Identity, Data Isolation, and IOL Integration Plan

Date: 2026-10-20. Status: local implementation and production security cutover completed; private access activation is pending Google configuration and the production migration.

This document began as an analysis by Astra high and continues to record its decisions. Current execution status is at the end. Existing user changes in the workspace, including untracked files, were preserved.

Confirmed decision: Mirador sign-in uses Google OIDC, with private access restricted exclusively to `fervon96@gmail.com` and `nicovon24@gmail.com`. These are two individual accounts. This list replaces any previously mentioned email addresses. Each person must authenticate with Google and prove control of the verified email; inclusion on the list does not assign old data or the OWNER role.

## 1. Expected outcome

Mirador has its own accounts and sessions, authenticated with Google. Only the two authorized email addresses can register and sign in to use Research, Portfolio, Watchlists, Alerts, and Settings; an IOL account is not required. Connecting IOL is optional after Mirador sign-in and imports only that person's portfolio through OAuth.

| Actor | Access |
| --- | --- |
| Signed-out visitor | Home, Markets, instruments, Learn, and Glossary; their APIs expose public data only |
| Authenticated USER | Public and private sections; only their own watchlists, positions, alerts, notifications, preferences, and IOL connection |
| Authenticated OWNER | The above plus explicitly enumerated global configuration operations, such as registering the bot webhook |
| System process | Cron/webhook with its own authentication and specific permissions; does not impersonate a user |

OWNER does not grant access to other people's portfolios. The initial role is assigned to a verified identity through an explicit operational procedure; no public signup receives OWNER by being first.

## 2. Diagnostic evidence and limits

The review covered `AGENTS.md`, `package.json`, the Prisma schema and migrations, sessions, queries/actions, IOL integration, navigation, and Telegram. The declared installed versions are Next.js 16.3.8 and Prisma 7.10.0. The local Next.js guides consulted were:

- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`.
- `node_modules/next/dist/docs/01-app/02-guides/data-security.md`.
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`.
- `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`.

Findings:

1. `src/app/(app)/portfolio/page.tsx` enables a global fallback when there is no OAuth connection but environment credentials exist. This path queries holdings and cash without requiring a Mirador session.
2. `src/lib/market/iol.ts` implements password grant and stores global tokens in memory; `src/lib/market/index.ts` also uses that adapter for public market data.
3. `User` currently represents an anonymous browser identity. `getOrCreateIdentity()` creates users when connecting IOL; there is no first-party sign-in. Cleanup deletes identities without a connection or current session.
4. `Watchlist`, `Position`, `Alert`, `Notification`, and `Setting` have no owner. Queries and mutations operate globally, including deletes by instrument and notification reads.
5. The shared layout, Home, and Research consume private data. Protecting only private URLs would leave other exposure paths.
6. Telegram has singleton preferences and a global linking code; the evaluator collects all alerts and sends them to the same chat.
7. `disconnectIol()` deletes the user, their sessions, and their connection. That would be destructive for a real Mirador account.
8. PKCE, single-use OAuth state, encrypted tokens, connections keyed by `userId`, and a read-only MCP allowlist already exist. Preserve these guarantees.
9. Local Basic protection appears in untracked files. It is not individual identity and is not evidence of deployed protection.
10. The coordinator reports HTTP 200 responses without cookies on production private routes and a description of a connected IOL portfolio. No portfolios were queried during this analysis.

The cause of the discrepancy between approximately 25 million shown and approximately 10 million expected has not been established. Two risks need investigation: legacy cash may contain total net worth, and the MCP mapping adds `t0..t3` assuming the terms are non-cumulative. A test repeats this assumption; it does not prove the provider's contract.

## 3. P0: contain the exposure

Complete before enabling new accounts:

1. Identify the effective production project, team, domain, and repository from configuration and metadata. A discrepancy was reported between the `track-inversions` remote and `mirador-inversiones` builds. Do not deploy on the assumption that they are the same target.
2. Cut off global IOL access: remove the portfolio fallback and password-grant provider from the market selector. When user OAuth is unavailable, show that user's manual positions and the option to connect IOL.
3. Until authentication and ownership are complete, block private reads and mutations on the server, including Home/layout personalization, actions, and indirect routes. The private area may temporarily return 503 maintenance responses. Keep public market and learning modules available.
4. Temporarily disable global alert delivery and global Telegram linking if they cannot be migrated in the same cutover. Public fundamentals refresh may continue with system authentication.
5. Remove `IOL_USERNAME` and `IOL_PASSWORD` from local environment files and any variants, `.env.example`, documentation, Docker/Compose, and Vercel Development, Preview, and Production variables, including branch-specific variants. Inspect names/scopes and confirm absence without displaying values.
6. Build and deploy the containment code to the verified target; confirm the production domain and any older deployment URLs that remain accessible. Removing variables does not change old builds or guarantee that global tokens disappear from existing processes.
7. Revoke legacy broker access using available controls and involve the account owner where needed; do not print tokens or sign in with stored credentials. Track any revocation that requires human action as pending.

Do not remove `IOL_SESSION_SECRET` or the OAuth callback based on similar names. Do not enable an alternative fallback with global credentials. Do not roll back to a version that exposes the portfolio again.

P0 exit criterion: a visitor can view public markets but receives no private financial data and cannot perform private mutations; no route uses IOL password grant.

## 4. P1: Google sign-in, allowlist, and session contract

Chosen method: Google OIDC through a maintained library compatible with Next 16 and Prisma 7. The implementation will select and verify the library; there will be no Mirador password form or alternative public signup.

Exact server-side allowlist:

- `fervon96@gmail.com`.
- `nicovon24@gmail.com`.

OIDC controls: authorization-code flow with a registered fixed callback; `openid email` scopes and `profile` only if needed. Validate state bound to the browser and nonce bound to the attempt; reject expired or reused attempts. Verify the ID token signature using official keys, the permitted Google issuer, the client audience configured for that environment, and expiration. Require `email_verified === true`. Use `sub` as Google's stable identifier; email does not replace that identity. These controls follow the [official Google OIDC documentation](https://developers.google.com/identity/openid-connect/openid-connect).

Mirador policy: after validating OIDC, compare the verified email, normalized to lowercase, against the two complete values. Do not expand the list by removing dots, stripping `+` suffixes, accepting whole domains, or using `login_hint` for authorization. An email typed into a form, query, header, or localStorage does not prove access. Check authorization before persisting an account or creating a session; verify that the library's hooks preserve this order.

First authorized sign-in: atomically create a Mirador account with a unique Google provider and `sub` link, USER role, and empty private data. Later sign-ins: retrieve the same account through its Google link and recheck that the email remains authorized and the account enabled. The two Google subjects keep independent IDs, sessions, and data. Do not automatically link by email to legacy identities or to an account with a different `sub`.

Unauthorized, missing, or unverified email: deny signup and session creation, clear the OIDC attempt, and show “This account does not have access to Mirador,” with an option to choose another Google account or return Home. Do not reveal the allowlist in the error. A failed attempt must not appear to have successfully switched accounts; any prior valid session retains its original identity until logout or a new authorized sign-in.

Recheck the allowlist when resolving a Mirador session as well: removing an email from configuration must block its existing sessions without waiting for another Google sign-in. Missing or invalid configuration fails closed. Google test-user registration, if required by consent-screen settings, supplements this policy; it does not replace enforcement by the Mirador server.

Server contract to establish before splitting work:

- `getCurrentUser(): Promise<{ id, role } | null>` validates the session and account status against the database.
- `requireUser()` returns the same DTO or a typed authentication error.
- `requireRole("OWNER")` requires a valid session and a role confirmed on the server.
- Pages translate a missing session to `/login?returnTo=...`; APIs return 401 and actions return a typed result. `returnTo` accepts only approved local paths.
- Do not expose private-access helpers that accept a client-supplied `userId`. Each entry point obtains the actor from the session.

Account model: stable internal ID, unique Google provider and `sub` link, normalized verified email, USER role by default, account status, and any fields required by the selected library. OWNER requires explicit designation and verified authentication; neither email receives that role automatically.

Keep server-side opaque, revocable sessions. The existing approach of storing a session-token hash may be retained. Cookies are HttpOnly, Secure in production, use an appropriate SameSite setting, and have explicit expiration. Rotate sessions at authentication and privilege changes; revoke them at logout or account disablement. An IOL connection may expire without ending the Mirador session. Google's ID token does not replace the Mirador session or grant IOL access; do not persist Google tokens for offline access the application does not need.

Remove automatic identity creation when connecting IOL and cleanup that deletes users for lack of IOL. Invalidate existing anonymous sessions with a new version/name or an authentication marker; an old cookie never proves first-party sign-in.

Apply CSRF/origin protection to mutations according to the library and Next.js, validate with Zod, avoid account-enumerating errors, and rate-limit attempts with storage suitable for multiple instances. Do not rely only on one process's memory for production login rate limits.

Proposed authentication configuration; adapt final names to the selected library:

| Variable/element | Policy |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Separate Google client per environment; secret stays server-side |
| `AUTH_SECRET` | Dedicated authentication secret, separate from IOL encryption |
| `APP_ORIGIN` and Google callback | Fixed origin and exact library callback; never derive them from an arbitrary Host header |
| `AUTH_ALLOWED_EMAILS` | Exactly `fervon96@gmail.com,nicovon24@gmail.com`; validate server-side and deny access if missing or malformed |
| Development | Explicit localhost client/callback, dedicated database and secret; same allowlist |
| Preview | Isolated client and database, stable preview domain with exact callback; sign-in disabled if no callback is configured |
| Production | Confirmed production HTTPS client/callback, production database and secret; same allowlist |

Do not share authentication cookies across hosts/environments or use the production database for sign-in tests. Automated tests use mocked OIDC without expanding the deployed allowlist. Google OAuth configuration remains separate from `IOL_SESSION_SECRET` and the IOL callback.

## 5. P1: migrate ownership without taking over data

Create new migrations; do not modify or revert the applied `20261008003757_iol_login_only` migration, which removed account fields.

1. Take a backup and record per-table counts without writing financial data to logs. Test the migration on an isolated copy.
2. Add nullable `ownerId` columns and indexes to Watchlist, Position, Alert, and Notification. Replace singleton Setting with one unique record per user. WatchlistItem may inherit ownership from its list, provided every operation validates that relationship.
3. Add real identity and role without promoting anonymous users. Old records without an owner remain in logical quarantine: `ownerId = null`, inaccessible to user queries and excluded from cron and delivery.
4. All future creates require an `ownerId` calculated on the server. All private reads and mutations filter by that `ownerId`. Never include ownerless rows as “default data.”
5. Do not assign previous data to the first signup, first OWNER, first user connecting IOL, or browser with an old cookie.
6. Offer an explicit operational migration after confirming the owner of each dataset. Run an approved record-to-user mapping with before/after counts and a transaction. Rows without proof of ownership remain isolated.
7. For existing anonymous IOL connections, the preferred option is to require new OAuth authorization from the Mirador account. Document any retention/removal of old tokens; do not associate them based on inferred matches.
8. Once all active data has an owner, archive or resolve remaining rows and tighten constraints. If nullable quarantined rows are retained during transition, add tests preventing their return; the constraint phase must not cause silent data loss.

Notifications retain their owner if an alert is deleted. Notifications created from an alert inherit that alert's `ownerId` and cannot accept a different one. Shared Instrument and Fundamentals catalog data remains public; users must not be able to freely overwrite global metadata through a favorite's name.

Update seed data to populate the public catalog and, if needed, sample data associated with an explicit test user in non-production environments. Remove implicit creation of watchlists and singleton Setting.

## 6. P1: authorization for data, actions, pages, and caches

- Centralize private access in a `server-only` DAL. Each query or action validates the actor before reading or modifying data. `proxy.ts` helps with early redirects; it is not the final authority.
- Add page-level controls to Research, Portfolio, Watchlists, Alerts, and Settings. The layout alone is insufficient: Next.js has independent actions, RSC, navigation, and direct entry points.
- Home/layout use a public DTO for visitors. Query watchlists, counts, or notifications only when there is an authenticated user, and scope those queries to that user.
- For update/delete, require both ID and `ownerId`; for WatchlistItem, verify the list owner. A missing record and another user's record must produce the same public result.
- `removeFromWatchlist` without a specific list removes only from the actor's lists. `markNotificationsRead` updates only that actor's notifications. Calculate the default list and its order within the user's scope.
- Distinguish missing session, authorization failure, and infrastructure error. Existing wrappers that convert every failure into empty data must not hide authorization failures or failed mutations.
- Authorize and rate-limit Research refresh per user; cron uses an explicit internal system function and must not accidentally call a session query when running in the background.
- Private data must not enter public caches or global cache keys. Initially, use private queries without shared caching and HTTP `private, no-store` where applicable. `React.cache` may deduplicate within a render; it is not a global cache.
- If persistent per-user caching is later introduced, authorize before access, include `ownerId` in keys/tags, and define per-user invalidation. Do not cache tokens or financial DTOs in the public shell.
- Clear private browser queries and state on logout/account switch; scope average-cost storage keys to the authenticated user and remove the `legacy` key. Do not automatically import prior localStorage data.

`next.config.ts` does not currently enable Cache Components. Do not introduce that migration as part of security work. If that configuration changes, consult the local guides on async cookies, Suspense, and private caching before changing rendering.

## 7. P1: optional IOL and complete removal of legacy behavior

`connectIol` requires `requireUser()` before creating a pending authorization. The callback checks a valid Mirador session, matching `userId`, state/cookie, expiration, and single use. An account switch or logout between initiation and callback cancels the flow.

`disconnectIol` removes only that user's connection and pending authorizations and revokes tokens where the provider supports it. It preserves the Mirador account, session, watchlists, and positions. Logout revokes the Mirador session and clears local state; OAuth connection retention must be explicitly defined and never allows queries without login.

Keep access/refresh token encryption, PKCE, refresh locks, and the read-only allowlist. Tokens, verifiers, and codes never appear in props, RSC, browser, or logs. Every private call obtains its `userId` from the validated session. No fallback loads another account if OAuth fails.

Extract `BrokerHolding`/`BrokerCash` into a neutral types module before removing `src/lib/market/iol.ts`. Remove its imports and selection from `src/lib/market/index.ts`, legacy queries, global token state, variables, Settings/footer copy, examples, and documentation. Public quotes use the existing public providers; verify that panels, history, search, and instruments still work.

Separate configuration:

- Development: dedicated database, encryption secret, and local callback.
- Preview: isolated database and secret; explicitly allowed callback or disabled IOL integration.
- Production: production database, secret, origin, and callback; no broker secrets in `NEXT_PUBLIC_*` variables.
- Authentication, IOL encryption, cron, and webhook secrets serve different purposes. Do not reuse or rotate the IOL encryption secret without a plan for already encrypted tokens.
- `.env.example` contains names and example values only; the final variable inventory lists names by environment, never values.

## 8. P1: Telegram and system processes

Replace global codes with a random nonce, stored hash, associated user, short expiration, and single use. The webhook validates its secret and links a chat only to the nonce owner; define a policy for a chat already linked to another account. `/stop` removes the link for that chat.

The evaluator may process alerts for all users as a system process, but creates notifications with the alert's `ownerId` and groups deliveries by owner and their chat. Exclude quarantined data and disabled accounts. Keep concurrency controls to prevent duplicate triggers.

Global webhook registration is reserved for OWNER or deployment configuration. Linking, unlinking, and testing Telegram are individual operations. Build the webhook URL from the configured origin, not the incoming Host header. Integration tests use a fake transport; do not send real messages during implementation.

## 9. P2: reconcile the portfolio total

Keep this work separate from containment; do not change figures to reach approximately 10 million.

1. Define a DTO that distinguishes holdings, cash, reported net worth, currency, country/account, timestamp, and partial status. “Total” and “available” are not interchangeable.
2. Obtain official contract documentation and authorized sanitized fixtures. Confirm whether `totals` includes securities and whether `t0..t3` are cumulative balances, independent balances, or settlement dates. Do not infer semantics from field names.
3. Reconstruct the total from identified components: holdings by currency + confirmed cash + explicitly included manual positions. Use broker-reported net worth for comparison; do not add it again as cash.
4. Check duplicates across country/account, manual instruments representing the same holdings, bonds by lot/nominal value, quote currency, and ARS/USD conversion. If manual duplication exists, provide an explicit inclusion control; do not delete or deduplicate by symbol without evidence.
5. If balance semantics are unknown or responses are partial, show a holdings subtotal and incomplete status; do not present an exact global total using an invented zero.
6. Show breakdown, source, currency, and timestamp to compare with IOL at the same time. Document the formula and verified differences. Fixtures should establish the contract; replace any test that merely repeats the `t0..t3` sum if the contract says otherwise.

## 10. File ownership and dependency plan

Implementation is delegated only after identifying the Google orchestrator the user wants. GSD under `.gemini/antigravity` is a candidate found by the coordinator, not confirmation of the user's choice. Do not start another orchestrator based on assumed equivalence.

The coordinator owns cross-cutting contracts, migration sequence, remote configuration, `package.json`/lockfile, and integration resolution. Each task receives the base diff and acceptance criteria; no agent reverts another contributor's changes.

| Task | Exclusive files/responsibility | Dependency and acceptance |
| --- | --- | --- |
| A. Data | `prisma/schema.prisma`, new migrations, seed, and explicit migration script | Establish contract first; rehearsed migration preserves records and isolates ownerless rows |
| B. Identity | `src/server/auth/**`, new auth pages/components, auth routes, session tests | A and selected library; Google OIDC; signup/sign-in only for the two verified emails; logout independent of IOL; reject old sessions |
| C. Authorization and UI | `src/server/queries.ts`, `src/server/actions.ts`, `src/server/research-table.ts`, `(app)` pages, shell, private provider, favorite buttons, proxy, and tests | A/B and D's neutral DTO; authorization and A/B isolation at every entry point; C owns the portfolio page |
| D. IOL and market | `src/server/iol/**`, IOL callback, `src/lib/market/iol.ts`, `src/lib/market/index.ts`, neutral types module, and IOL tests | B; no password grant or fallback; disconnect preserves account and data |
| E. Telegram | `src/server/evaluate-alerts.ts`, `src/lib/telegram.ts`, cron/webhook routes, Telegram components, new linking service, and tests | A/B; C wraps the service with actions; no cross-account deliveries |
| F. Environments and deployment | `src/lib/env.ts`, existing `.env*`, README, Docker/Compose, Vercel metadata, and deployment | Coordinator; remove only legacy credentials, retain OAuth, verify target |
| G. Valuation | `src/server/iol/portfolio.ts`, mapping tests, `src/lib/portfolio*.ts`, portfolio components | Sequential after D/C to avoid overlapping active files; verify balance contract |
| H. Independent review | Read diff and acceptance tests; report without editing others' files | After integration; different model from implementer, focus on sessions/IDOR/cache/migrations |

A/B must serialize the contract and Prisma changes; C/D/E can proceed afterward in separate files. G takes ownership of D/C files only when those tasks finish. F coordinates environment changes with everyone, without leaving a build that expects removed variables. The chosen orchestrator selects more economical models; the security review needs fresh context.

## 11. Tests and acceptance before opening private access

Use two fictitious users A/B, one OWNER, and old quarantined rows. Use fake IOL/Telegram transports; no trading operations.

- A visitor can navigate the five public areas and their APIs. The five private areas redirect to login or reject access before querying private data, including RSC, prefetch, and deep URLs.
- A new account without IOL can access empty private screens and create watchlists, positions, and alerts.
- Google allows only the two exact verified emails and creates separate accounts. A different email, false/missing `email_verified`, invalid signature/issuer/audience, expired token, invalid state/nonce, or replay creates no account or session.
- Repeated sign-in with the same `sub` retains the account; switching between the two accounts renews the session and clears private state. Removing an email from the allowlist blocks its sessions; missing configuration fails closed.
- Unauthorized email receives a rejection and option to switch accounts without revealing the allowlist. Neither user receives OWNER, legacy data, or an IOL connection automatically.
- A cannot read, modify, or delete B's records by passing IDs or using action variants without a list ID. OWNER also cannot access B's portfolio.
- HTML, JSON, RSC, counts, notifications, Home, personalized search, and caches never mix A/B. Logging out and signing in as B in the same browser does not show A's state or average cost basis.
- Missing, expired, revoked, and old anonymous sessions are rejected. Database errors never grant access.
- OAuth rejects repeated/expired state, callbacks without a session, a different account, external `returnTo`, and missing cookies. Disconnecting IOL preserves the account and positions. Tools outside the allowlist make no network requests.
- Fixtures show that tokens are encrypted; response/log inspection finds no secrets. Do not test with real credentials.
- Alerts and Telegram respect `ownerId`, nonce consumption, and recipient; quarantined data is never delivered.
- Migration preserves counts, never assigns ownership by row order, and can be rehearsed/restored. Rollback compatibility is documented.
- Active-reference search removes `IOL_USERNAME`, `IOL_PASSWORD`, password grant, legacy `hasIol`, and global portfolio access. Historical mentions in this plan may remain; they are not configuration.
- Run relevant existing tests, new authentication/authorization/migration tests, lint, and build. A successful compile alone is not acceptance.

Deployment sequence: containment first; additive migrations while the private area remains closed; integrated build in isolated preview; anonymous/A/B tests; deploy to the confirmed project; verify on the real domain; finally open sign-in and private access. Do not let an old app with global queries run alongside new multi-account data. If a phase fails, keep containment in place and fix forward.

## 12. Independent review adjustments (Sol high)

These requirements supplement the plan and must be included in acceptance criteria:

- `completeAuthorization` must reject `sessionUserId === null` inside the service, before consuming the flow or exchanging the code. Requiring a session only in the Route Handler is insufficient. Test the service directly with a missing session and with a different user.
- Preserve the existing singleton `Setting` row in quarantine or in a migration copy. Do not implicitly assign its `telegramChatId`, preferences, or linking codes to a new account. Require verified attribution of preferences and fresh Telegram linking.
- The schema must unambiguously distinguish legacy anonymous identities from authenticatable Mirador accounts. `getCurrentUser` must reject legacy identities even if an old cookie or session exists. Remove cleanup from `getOrCreateIdentity` before creating real accounts.
- P0 containment must be active on the confirmed production project before opening signups or introducing multi-account data. Also verify accessible old deployments and close their access before they can query new data.
- Task C owns `src/app/(app)/settings/page.tsx`, `src/app/(app)/alerts/page.tsx`, and all wrappers in `src/server/actions.ts`. Task E owns the new Telegram linking service, transport, and Telegram-specific components, which must be inventoried before dispatching E. C integrates its imports; E does not edit those pages or wrappers.

Plan written by Astra high and reviewed by Sol high. This review is not implementation or a security validation of the current deployment.

## 13. Minimum pending decisions

1. Confirm the Google orchestrator and models available for implementation/review; this plan does not execute them.
2. Confirm the identity that will receive OWNER and ownership of old records before any assignment. Until then, those records remain isolated; both new users have the USER role.
3. Prepare Google clients/callbacks per environment. The Vercel `mirador-inversiones` project was confirmed; GitHub redirects the local `track-inversions` remote to the same repository, and `main` matched `c49e5ca` before this cutover was published.
4. To resolve the portfolio-total discrepancy, obtain the IOL contract and authorized sanitized evidence; until then, do not state a cause or corrected figure.

The user authorized implementation. Execution and remaining items are recorded below.

## 14. Execution status (2026-10-20)

- Google OIDC sign-in for the two agreed emails, revocable Mirador sessions, `ownerId` isolation in queries/actions, per-user IOL connection without password grant, per-user Telegram, and an additive migration have been implemented. Old records remain ownerless.
- `IOL_USERNAME`, `IOL_PASSWORD`, `APP_ACCESS_USER`, and `APP_ACCESS_PASSWORD` were removed from local and Vercel configuration; environment variable names were verified without displaying values.
- The security cutover was deployed directly to the Vercel `mirador-inversiones` project, deployment `dpl_9paJ7CZADdf9fiNbTVh7prAF8aUi`. The production domain returned 200 for public areas and 307 to `/login` for the five private areas without a session; the tested previous deployment URL returned a protection-related 302.
- Prisma successfully applied all five migrations to an isolated Docker database, which was then removed. TypeScript, build, and 140 tests passed; a test with fictitious A/B sessions confirmed each sees only their own list and that the legacy row is absent.
- Automatic review rejected exporting a full Neon backup to a local file because it might contain personal data and tokens. That export and the new production migration were not run; specific backup authorization was requested.
- Production sign-in remains closed because `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are missing in Vercel. `MIRADOR_APP_URL` has been added to Production and will take effect with the next deployment. Attribution of old data and the OWNER role still require ownership confirmation. The prior portfolio figure has not been declared fixed; the screen now shows a holdings subtotal without adding ambiguous `cash.total` and warns about possible manual duplicates.
