# OBLIG

Next.js frontend for tracking Ukrainian government bonds. The Bonds tab stores instrument details in PostgreSQL and supports adding, editing, searching, filtering, and deleting positions.

## Run locally

Requirements: Node.js, npm, and Docker Compose.

```sh
npm install
npm run db:up
cp .env.example .env.local
npm run dev
```

Before signing in, set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` in `.env.local`. Create a Google OAuth web client and add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. Generate a secret with `npx auth secret`. Open [http://localhost:3000](http://localhost:3000); the app starts on the Bonds tab after Google sign-in.

PostgreSQL runs on port `5432`; `npm run dev` starts it and applies pending SQL migrations. The ownership migration deletes local test bonds and coupons. It will not delete rows from a non-local database; existing production bonds need an owner backfill before that migration can be applied. To stop the database, run `npm run db:down`. The named volume keeps data when the container stops. To recreate the database from scratch, remove the volume with `docker compose down -v`.

For an existing PostgreSQL server, create a database, apply `db/init.sql`, and set `DATABASE_URL` in `.env.local` to its connection string.

## Verify

Run `npm run build` to compile the production app and check TypeScript.
