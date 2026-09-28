# Repository Guidelines

## Project

This is a Next.js App Router portfolio app for Ukrainian government bonds. The app requires Google sign-in; bonds, generated coupons, and cached Privat24 live prices use PostgreSQL.

- `app/page.tsx` owns the dashboard shell, tab navigation, and sample Analytics/Cashflow views.
- `app/BondsTab.tsx`, `app/CouponsTab.tsx`, and `app/LivePricesTab.tsx` are the client-side feature views.
- `app/api/` contains the Auth.js route and bond, coupon, and live-price endpoints. Keep ownership checks on user data through `lib/require-user.ts`.
- `lib/bond-types.ts` validates bond input; `lib/coupons.ts` builds coupon schedules; `lib/db.ts` provides the PostgreSQL pool.
- `auth.ts`, `middleware.ts`, `app/login/`, and `app/SignOutButton.tsx` implement Google sign-in and page access control.
- `supabase/migrations/` contains timestamped SQL migrations, applied locally by `scripts/migrate.mjs`. `db/init.sql` is a schema snapshot/bootstrap SQL, not the migration runner.
- `app/globals.css` contains shared styling. There is no separate asset directory or configured test framework.

## Development

- `npm install` installs locked dependencies.
- `npm run dev` starts PostgreSQL, applies pending migrations, and starts Next.js.
- `npm run db:up` and `npm run db:down` start and stop the local PostgreSQL service.
- `npm run db:migrate` applies pending migrations using `DATABASE_URL` or `.env.local`.
- `npm run build` checks and builds the production app; `npm start` serves that build.
- Local setup and Google OAuth configuration are documented in `README.md`; `.env.example` lists required variables.

## Conventions

Use TypeScript and React function components. Follow the existing two-space indentation, double-quoted strings, and semicolons. Use PascalCase for components and types, camelCase for values and functions, and lowercase hyphenated CSS classes. Prefer existing CSS, platform features, and dependencies over adding a library for a small UI need. Keep interactive state in client components and shared metadata in `app/layout.tsx`.

Validate request bodies at API boundaries, use parameterized SQL, and scope bond/coupon queries to the authenticated owner. Bond edits and their regenerated coupon schedules should remain in the same database transaction.

## Verification and changes

There is no test script or test framework. Run `npm run build` for app changes. For UI changes, also check the affected interaction and responsive layout in a browser when available.

Use short imperative commit subjects. Pull requests should summarize user-visible changes, list verification, and include screenshots for visual changes. Do not commit secrets or local environment files; `.env*` files are ignored.
