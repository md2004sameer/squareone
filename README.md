# Squareone

Squareone is a free-to-use text editor with selection-based rich-text formatting, autosave, local draft recovery, search, and document export.

The workspace includes a home page with recently edited notes and favorites, sorting, expandable document trees, and Trash with restore and permanent deletion. Changes show whether they are saved on the server or only in this browser. Pending edits sync automatically when the browser reconnects; use **Retry sync** to retry manually. Archive keeps inactive notes accessible, version history previews and restores saved checkpoints, and document details let you set icons and covers. Writing preferences sync with registered accounts.

## PostgreSQL / Neon

Copy `.env.example` to `.env` and set the JDBC URL, database username, and password. The app reads this ignored local file on startup; deployment environment variables take precedence. Docker Compose requires this file and passes it into the container. Never commit the real file.

For Neon, retain `sslmode=require&channelBinding=require&currentSchema=squareone` in the JDBC URL and set `DATABASE_SCHEMA=squareone` as shown in the example. Flyway creates the schema and applies versioned migrations; Hibernate validates the resulting schema. An existing pre-Flyway database requires a backup and a one-time baseline at version `0`; follow the [production upgrade instructions](docs/production.md) before starting the upgraded app. Hibernate explicitly qualifies table names with that schema, which also works through Neon's connection pooler. Other application tables are left untouched. PostgreSQL stores document bodies as `text`, including long rich-text notes.

Neon is the primary store for authentication and user data, including document text. Normal startup requires a PostgreSQL JDBC URL, username, and password; missing settings or an H2 URL stop startup. H2 remains available for isolated automated tests under the explicit `h2-test` profile. Production rejects H2 even when that test profile is active. Existing local H2 files are retained and are not automatically imported into Neon.

Login retrieves the account by email from `squareone.app_users` and verifies its BCrypt password hash on the server. Signup, profile changes and password changes write back to Neon. Plaintext passwords and database credentials are never saved in browser storage.

| User data | Neon tables |
| --- | --- |
| Account profile, email, password hash and account status | `app_users` |
| Workspace names, ownership and descriptions | `workspaces` |
| Document HTML/JSON, hierarchy, favorites, archive, Trash, icons and cover references | `documents` |
| Saved revisions and restore checkpoints | `document_versions` |
| Registered users' theme, writing and sidebar preferences | `user_preferences` |
| Account and guest sessions | `spring_session`, `spring_session_attributes` |

Browser document drafts and preference caches support recovery and pending synchronization. Neon holds the persistent server records; guest display preferences remain browser-scoped.

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

Documents are stored in Neon and survive container recreation. Storage and backups are managed by Neon. Docker Compose does not create a separate local database or data volume. Local H2 files or volumes from older releases remain available for an explicit, reviewed migration; changing the connection does not copy their contents.

While editing, the browser also keeps a local copy of each document. Copies are scoped to the current guest session or account, refreshed as you type, and expire 30 days after the most recent edit. Unsynced edits or newer local copies are restored and synchronized when the app loads. Clearing browser site data removes these copies; the server database remains the primary persistent store. Account switching requires pending edits to sync first.

Moving a document to Trash preserves its content and favorites. Its children move to the workspace root. Restoring brings it back under its original parent if that parent is still available; promoted children stay at the root. Documents remain in Trash until their owner explicitly deletes them permanently. Trash is private to each guest or account and moves with guest notes when signing in.

Documents that existed before ownership was introduced are retained in the database with no owner and are deliberately excluded from every guest and account API. They are not assigned to the first user or guest. An operator must explicitly review and assign legacy rows before making them available. Local drafts created by older releases are likewise not auto-imported because they have no trustworthy owner identity.

Accounts are stored in the configured database. Guest access depends on the browser's server session; losing that session can remove access to guest notes. Create an account or log in to move guest notes into an account and access them from other browsers. Use HTTPS for network access. Sessions are stored in the configured database and survive application restarts. PostgreSQL instances can share these sessions. Do not run multiple replicas against the same H2 volume.

## Run locally without Docker

```sh
./gradlew bootRun
```

The app reads Neon settings from the ignored `.env` or deployment environment. Keep the `production` profile for the HTTPS host and use the default profile for HTTP localhost. Database settings are required in both cases.

In VS Code, select **Squareone (Gradle runtime)** in Run and Debug, then press **F5**. Its pre-launch task builds the application classes and copies Gradle's resolved runtime dependencies to `build/vscode-runtime`. This includes the PostgreSQL driver, Flyway database support, and JDBC sessions even if VS Code's imported Gradle model is stale. Stop any existing Squareone process on port 8080 before starting another instance.

## Checks and editor bundle

Run backend checks and build the release with `./gradlew test bootJar`. Run restart and persistence checks with `npm run test:persistence` afterward.

The browser loads the editor from the included `static/vendor/editor.js` bundle. No external JavaScript CDN is needed to start or edit notes. After changing editor dependencies or `src/editor/index.js`, run `npm ci` and `npm run build:editor`, and include the updated bundle and license notices with the source changes.

Run browser checks with `npm ci`, `npx playwright install chromium`, then `npm run test:ui`. These start an isolated H2 test server on port 8081. Set `SQUAREONE_TEST_URL` to use an existing test server and `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use an installed Chromium browser. Avoid pointing these checks at a live workspace.

## Developer documentation

- [System architecture diagrams](docs/architecture.md) — browser, backend, database, export, and sharing flows; rendered on GitHub and in the VS Code Markdown preview.
- [Persistence implementation](docs/persistence.md) — workspaces, preferences, concurrency, history, migrations and sessions.
- [Backend class diagram](docs/class-diagram.md) — classes and their relationships.
