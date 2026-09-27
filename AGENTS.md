# Repository Guidelines

## Project Structure

This repository is a small Next.js App Router frontend for tracking a Ukrainian government bond portfolio.

- `app/page.tsx` contains the dashboard and client-side navigation between Analytics, Bonds, Coupons, and Cashflow. `app/BondsTab.tsx` implements the database-backed bond list and editor.
- `app/api/bonds/` contains the PostgreSQL CRUD endpoints. `lib/bond-types.ts` defines and validates bond data; `lib/db.ts` provides the PostgreSQL connection pool.
- `db/init.sql` defines the bonds table, and `docker-compose.yml` starts a local PostgreSQL database.
- `app/layout.tsx` defines the root layout and page metadata.
- `app/globals.css` contains the shared responsive styling.
- `package.json` and `package-lock.json` define scripts and dependencies. `tsconfig.json` configures TypeScript.

There are currently no test files or separate asset directories. Keep dashboard-only components and sample data in `app/page.tsx` unless the app grows enough to justify extracting them.

## Development Commands

- `npm install` installs the locked dependencies.
- `npm run dev` starts the local Next.js development server.
- `npm run build` creates a production build and checks TypeScript validity.
- `npm start` serves the production build; run `npm run build` first.
- `npm run db:up` and `npm run db:down` start and stop the local PostgreSQL service.

## Coding Style

Use TypeScript and React function components. Follow the existing two-space indentation, double-quoted TypeScript strings, and semicolons. Use PascalCase for components and types (`PortfolioCard`, `Tab`), camelCase for variables and functions, and lowercase CSS class names with hyphens. Prefer existing CSS and dependencies over adding a library for a small UI need. Keep interactive state in client components and shared page metadata in the root layout.

## Testing

No testing framework or test script is configured yet. For frontend changes, run `npm run build` to catch compilation and type errors, and check responsive behavior in the browser when the change affects layout or interaction. If tests are introduced, use the framework's standard command and colocate tests with the feature or under a clearly named `tests/` directory.

## Commits and Pull Requests

The available history has one imperative commit (`Create OVDP portfolio frontend`). Use short imperative commit subjects, for example `Add coupon schedule view`. Pull requests should explain the user-visible change, note verification (`npm run build`), and include screenshots for visual changes. Link related issues when applicable.

## Configuration and Data

Do not commit secrets or local environment files. `.env*` files are ignored; `.env.example` documents the required `DATABASE_URL`. The Bonds tab reads and writes PostgreSQL records. Analytics, Coupons, and Cashflow still show sample frontend data.
