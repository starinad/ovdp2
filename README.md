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

Open [http://localhost:3000](http://localhost:3000). PostgreSQL runs on port `5432`; its first startup creates the `bonds` table from `db/init.sql`. To stop the database, run `npm run db:down`. The named volume keeps data when the container stops. To recreate the database from scratch, remove the volume with `docker compose down -v`.

For an existing PostgreSQL server, create a database, apply `db/init.sql`, and set `DATABASE_URL` in `.env.local` to its connection string.

## Verify

Run `npm run build` to compile the production app and check TypeScript.

