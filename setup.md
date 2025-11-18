# Kung Food Panda – Environment Setup

This document walks a new contributor through preparing a workstation for both the TypeScript backend (`app/DBApp`) and the static frontend (`frontend`).

## 1. Prerequisites
- **Node.js 18+** (LTS recommended). Use `nvm` or your OS package manager.
- **npm 9+** (bundled with recent Node releases).
- **MySQL Server 8.x** (or a compatible MariaDB version). You need an account with privileges to create databases, tables, triggers, and events.
- **Git** for cloning the repository.

Verify versions:

```bash
node -v
npm -v
mysql --version
```

## 2. Clone the repository

```bash
git clone <your-fork-or-the-upstream-url>
cd kung-food-panda
```

All commands below assume you are at the repository root.

## 3. Install Node modules
Dependencies live in `app/DBApp`:

```bash
npm install --prefix app/DBApp
```

This installs TypeScript, ts-node, Knex, and database drivers (`mysql2`).

## 4. Configure database access

The backend loads credentials from `app/DBApp/config/database.json`. Update it (or copy it to keep environment-specific variants) with the MySQL instance you will use:

```json
{
  "client": "mysql",
  "connection": {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "root",
    "database": "kungfoodpanda_db"
  },
  "pool": { "min": 2, "max": 10 }
}
```

Alternatively set `DATABASE_URL` (standard MySQL URI) and/or `DB_CLIENT` in your environment; those take precedence over the JSON file.

## 5. Create and seed the database

Use the provided SQL files to bootstrap your schema, triggers, and sample data:

```bash
mysql -u <user> -p < schema.sql
mysql -u <user> -p < triggers.sql
mysql -u <user> -p < events.sql
mysql -u <user> -p < dummy.sql   # optional sample data
```

Replace `<user>` with the MySQL account you configured. These scripts expect the database specified in `database.json` to exist (create it beforehand if needed).

The backend auto-creates the `user_sessions` table, so no manual migration is required for it.

## 6. Optional environment variables

Most runtime settings have sane defaults but can be overridden:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port for the TS server |
| `HOST` | `0.0.0.0` | Bind address |
| `SESSION_COOKIE` | `kfp_session` | Name of the auth cookie |
| `SESSION_TTL_MS` | `8h` | Session lifetime |
| `ADMIN_ID` | `ADMIN-001` | Default admin identifier |
| `DATABASE_URL` | _unset_ | Overrides `config/database.json` connection |
| `DB_CLIENT` | `mysql` | Knex client if not using MySQL |

Export these before running scripts, or place them in a `.env` file and load them with your shell profile.

## 7. Run the backend

Development (ts-node, auto-compiles on each start):

```bash
npm run dev --prefix app/DBApp
```

Production-style build + run:

```bash
npm run build --prefix app/DBApp
npm start --prefix app/DBApp
```

The server (in `src/server.ts`) serves API endpoints and static files from the `frontend` directory; visit `http://localhost:3000/login.html` once it is running.

## 8. Useful scripts and workflows

- `npm run build` – Compiles TypeScript to `app/DBApp/dist`.
- `npm start` – Runs the compiled server (`dist/server.js`).
- `npm run dev` – Uses `ts-node` against `src/server.ts` for quicker iteration.
- Session cleanup runs automatically every 30 minutes, but you can manually truncate the `user_sessions` table if needed during testing.

## 9. Troubleshooting

- **Cannot connect to MySQL**: double-check `database.json`, ensure the user has privileges, and that the server accepts TCP connections from your host.
- **Static assets 404**: confirm files are in `frontend` and paths match. The static server defaults to `/login.html` for `/`.
- **TypeScript compile errors**: run `npm run build --prefix app/DBApp` to surface diagnostics; delete `app/DBApp/dist` if stale JS causes issues.

With these steps complete you should be able to modify both the frontend and backend, run the API locally, and contribute changes confidently.
