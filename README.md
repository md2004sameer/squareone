# Squareone

Squareone is a free-to-use text editor with selection-based rich-text formatting, autosave, local draft recovery, search, and document export.

The workspace includes a home page with recently edited notes and favorites, sorting, expandable document trees, and Trash with restore and permanent deletion. Changes show whether they are saved on the server or only in this browser. Pending edits sync automatically when the browser reconnects; use **Retry sync** to retry manually. Archive keeps inactive notes accessible, version history previews and restores saved checkpoints, and document details let you set icons and covers. Writing preferences sync with registered accounts.

## PostgreSQL / Neon

Copy `.env.example` to `.env` and set the JDBC URL, database username, and password. The app reads this ignored local file on startup; deployment environment variables take precedence. Docker Compose also passes `.env` into the container. Never commit the real file.

For Neon, retain `sslmode=require&channelBinding=require&currentSchema=squareone` in the JDBC URL and set `DATABASE_SCHEMA=squareone` as shown in the example. Flyway creates the schema and applies versioned migrations; Hibernate validates the resulting schema. An existing pre-Flyway database requires a backup and a one-time baseline at version `0`; follow the [production upgrade instructions](docs/production.md) before starting the upgraded app. Hibernate explicitly qualifies table names with that schema, which also works through Neon's connection pooler. Other application tables are left untouched. PostgreSQL stores document bodies as `text`, including long rich-text notes.

Without database settings, Squareone falls back to the local H2 database at `./data/squareone`. Switching to PostgreSQL does not import or delete the H2 data. Stop the app before copying H2 files for a consistent backup. Use your database provider's backup and restore tools for PostgreSQL.

## Production

The deployment target is `https://docs.orbitbot.in` on Render. See the [production release and database upgrade guide](docs/production.md). Keep the production profile on the HTTPS host; use the default profile on HTTP localhost.

## Deploy with Docker Compose

Install Docker Engine with the Compose plugin, then build and start the service:

```sh
docker compose up --build -d
```

The app binds to `127.0.0.1:8080`, not to the public network interface. For an internet-facing deployment, put it behind a TLS reverse proxy and forward HTTPS traffic to `http://127.0.0.1:8080`. Do not expose the app directly over unencrypted public HTTP.

Check health and logs with:

```sh
docker compose ps
docker compose logs -f squareone
```

Set `APP_PORT` if port `8080` is already in use. Stop the service with `docker compose down`.

## Data and privacy

Squareone opens in a private guest workspace; signing up is optional. Guest documents are scoped to the browser's server session. Creating an account or logging in transfers that session's documents to the account. Registered users can only list, read, update, delete, export, and share their own documents. Sessions use HTTP-only, same-site cookies and CSRF protection. Set `SESSION_COOKIE_SECURE=true` when serving Squareone over HTTPS.

Documents are stored in the configured database and survive container recreation. With PostgreSQL, storage and backups are managed by the external database. With the default H2 configuration, the named `squareone-data` volume holds the database; stop the app before backing it up. `docker compose down -v` deletes that local volume and its H2 documents.

While editing, the browser also keeps a local copy of each document. Copies are scoped to the current guest session or account, refreshed as you type, and expire 30 days after the most recent edit. Unsynced edits or newer local copies are restored and synchronized when the app loads. Clearing browser site data removes these copies; the server database remains the primary persistent store. Account switching requires pending edits to sync first.

Moving a document to Trash preserves its content and favorites. Its children move to the workspace root. Restoring brings it back under its original parent if that parent is still available; promoted children stay at the root. Documents remain in Trash until their owner explicitly deletes them permanently. Trash is private to each guest or account and moves with guest notes when signing in.

Documents that existed before ownership was introduced are retained in the database with no owner and are deliberately excluded from every guest and account API. They are not assigned to the first user or guest. An operator must explicitly review and assign legacy rows before making them available. Local drafts created by older releases are likewise not auto-imported because they have no trustworthy owner identity.

Accounts are stored in the configured database. Guest access depends on the browser's server session; losing that session can remove access to guest notes. Create an account or log in to move guest notes into an account and access them from other browsers. Use HTTPS for network access. Sessions are stored in the configured database and survive application restarts. PostgreSQL instances can share these sessions. Do not run multiple replicas against the same H2 volume.

## Run locally without Docker

```sh
mkdir -p data
./gradlew bootRun
```

The app reads `.env` when present; otherwise the local H2 database is written to `./data/squareone`.

## Checks and editor bundle

Run backend checks and build the release with `./gradlew test bootJar`. Run restart and persistence checks with `npm run test:persistence` afterward.

The browser loads the editor from the included `static/vendor/editor.js` bundle. No external JavaScript CDN is needed to start or edit notes. After changing editor dependencies or `src/editor/index.js`, run `npm ci` and `npm run build:editor`, and include the updated bundle and license notices with the source changes.

Run browser checks with `npm ci`, `npx playwright install chromium`, then `npm run test:ui`. These start an isolated H2 test server on port 8081. Set `SQUAREONE_TEST_URL` to use an existing test server and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use an installed Chromium browser. Avoid pointing these checks at a live workspace.

## Developer documentation

- [System architecture diagrams](docs/architecture.md) — browser, backend, database, export, and sharing flows; rendered on GitHub and in the VS Code Markdown preview.
- [Persistence implementation](docs/persistence.md) — workspaces, preferences, concurrency, history, migrations and sessions.
- [Backend class diagram](docs/class-diagram.md) — classes and their relationships.
