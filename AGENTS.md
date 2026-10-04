# Repository Guide

## Product and stack

OBLIG is a private portfolio tracker for Ukrainian government bonds. It is a Next.js 15 App Router application using React 19, strict TypeScript, Auth.js v5 with Google OAuth, and PostgreSQL through `pg`. The signed-in dashboard is a client component with five tabs: Analytics (the default tab), Bonds, Coupons, Cashflow, and Live Prices. Styling is shared in `app/globals.css`; there is no charting library, test framework, or separate public asset directory.

## Source map

- `app/page.tsx` owns the dashboard shell, tab selection, exchange-rate header, and persisted theme toggle.
- `app/AnalyticsTab.tsx` calculates portfolio metrics, currency exposure, cashflow summaries, maturity distribution, historical FX impact, and the bond-versus-USD scenario. Keep forecast assumptions explicit in both code and UI.
- `app/BondsTab.tsx` manages bond positions and the add/edit form; `app/CouponsTab.tsx` lists scheduled and past coupon records; `app/CashflowTab.tsx` groups coupon and maturity cashflows by month; `app/LivePricesTab.tsx` displays Privat24 bond prices and coupon details.
- `app/login/page.tsx`, `app/SignOutButton.tsx`, `auth.ts`, and `middleware.ts` implement Google sign-in and page access. `app/api/auth/[...nextauth]/route.ts` exposes Auth.js handlers. The middleware leaves API routes outside its page redirect, so API handlers must authenticate themselves.
- `app/api/` contains authenticated endpoints for bonds, coupons, user config, live/historical NBU rates, and Privat24 live prices.
- `lib/bond-types.ts` defines and validates bond input and enumerated values. `lib/coupons.ts` generates schedules and replaces them in a transaction. `lib/db.ts` owns the process-wide PostgreSQL pool. `lib/require-user.ts` returns the authenticated owner ID.
- `supabase/migrations/` contains ordered SQL migrations. They are applied by `scripts/migrate.mjs`, not by the Supabase CLI. `db/init.sql` is the bootstrap schema mounted by Docker on first database initialization; it is not the migration runner.
- `docker-compose.yml` defines the local PostgreSQL 17 service and persistent named volume. `README.md` documents local setup and OAuth configuration; `.env.example` lists environment variables.

## Data and domain behavior

- A bond has an owner, status, face value, quantity, purchase price/date, currency, maturity, and coupon terms. Supported currencies are UAH, USD, and EUR; statuses are ACTIVE, MATURED, REDEEMED, and SOLD.
- Coupon schedules are derived from bond terms (frequency, first coupon date, maturity, day-count convention, rate or fixed coupon, and tax rate). Coupons are stored as individual dated records with gross, tax, net, and PAID/SCHEDULED status. Editing a bond replaces its entire coupon schedule in the same database transaction as the bond update. Deleting a bond cascades to its coupons.
- Coupon schedules model interest payments, not principal repayments. Maturity principal is calculated from bond face value and quantity where a view needs it; do not treat a coupon row as the returned principal.
- Analytics use active positions for current principal/exposure. Historical capital-gain calculations use NBU rates on or before purchase/payment dates where available, with current rates as fallback. The USD scenario currently compares current active UAH face value converted at the live NBU rate with scheduled net UAH coupons and principal repayments through the latest active UAH maturity. It assumes coupon/principal proceeds remain idle as UAH cash and USD earns no interest; it does not model reinvestment, transaction spreads, or fees. Preserve or revise these assumptions deliberately when changing the projection.
- NBU current rates are cached by Next.js for up to 12 hours; historical rates for up to one day. Privat24 live bond prices are stored in the single-row `live_prices_cache` table for all users, refreshed after three hours, and stale cached data is served if refresh fails.
- User preferences are stored in `user_configs` as JSONB and currently persist the light/dark theme.

## API and security rules

- Every user-data API route must call `requireUserId()` (or `require-user.ts`) and return 401 without a session. Scope all reads, updates, and deletes to the authenticated owner. Never trust an owner ID from the request body.
- Validate untrusted request bodies at the API boundary. Use parameterized SQL for values; only interpolate fixed, code-owned SQL fragments such as selected column lists.
- Bond create/update and generated coupon replacement must stay within one PostgreSQL transaction. Roll back on failure and always release checked-out clients.
- Current API routes: `GET/POST /api/bonds`; `PUT/DELETE /api/bonds/[id]`; `GET /api/coupons`; `GET/PUT /api/config`; `GET /api/exchange-rates`; `GET /api/exchange-rates/history?start=YYYY-MM-DD&end=YYYY-MM-DD`; `GET /api/live-prices`; Auth.js `GET/POST /api/auth/[...nextauth]`.
- External data comes from the NBU exchange-rate endpoints and Privat24 bond endpoints. Keep timeouts, response validation, and failure handling when changing these integrations.

## Local development and database changes

- Install dependencies with `npm install` (lockfile is `package-lock.json`). Required tools are Node.js, npm, and Docker Compose.
- Set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` in `.env.local`; `DATABASE_URL` defaults to the local Compose database when omitted by the migration script. Use `.env.example` and `README.md` for OAuth setup.
- `npm run dev` starts the database, applies migrations, then runs `next dev`. `npm run db:up` and `npm run db:down` manage PostgreSQL. The named volume persists data; `docker compose down -v` deletes that database volume.
- `npm run db:migrate` runs the custom migration script. Add schema changes as a new timestamped SQL file under `supabase/migrations/`; do not edit already-applied migrations as a substitute. The script applies each migration in a transaction and records it in `app_migrations`.
- The owner migration (`20260928120000_add_bond_owner.sql`) is destructive on local databases: the migration script clears existing bonds and coupons before adding ownership. It refuses to run against a non-local database because that data needs an explicit owner backfill. Do not bypass this guard or point local setup commands at production.
- Docker executes `db/init.sql` only when initializing an empty data volume. Ongoing schema updates must use `npm run db:migrate`.

## Conventions and verification

- Follow existing TypeScript/React function-component patterns, strict types, two-space indentation, double quotes, and semicolons. Use PascalCase for components/types, camelCase for values/functions, and lowercase hyphenated CSS class names.
- Prefer existing CSS, browser/platform APIs, and installed dependencies. Keep interactive state in client components, route handlers on the server, and shared metadata in `app/layout.tsx`.
- Keep UI responsive and accessible: use semantic buttons/labels, meaningful accessible names, and visible loading, empty, and error states. Dark and light themes are both supported through `data-theme` CSS selectors.
- There is no configured test script or test framework. For application changes, run `npm run build` to compile and type-check. For UI changes, also check the affected interaction and narrow-screen layout in a browser when available.
- Do not commit secrets, `.env*` files, local database data, or generated build output. Use short imperative commit subjects. PRs should summarize user-visible changes, list verification, and include screenshots for visual changes.
