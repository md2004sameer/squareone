# Squareone

Squareone is a free-to-use text editor with selection-based rich-text formatting, autosave, local draft recovery, search, and document export.

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

Documents are stored in an H2 database on the named `squareone-data` volume and survive container recreation. Back up the database regularly; stop the app before copying the volume to ensure a consistent backup. `docker compose down -v` deletes the volume and all stored documents.

While editing, the browser also keeps a local copy of each document. Copies are scoped to the current guest session or account, refreshed as you type, and expire 30 days after the most recent edit. If a local copy is newer than the H2 version, it is restored and synchronized when the app loads. Clearing browser site data removes these copies; the H2 database remains the primary persistent store.

Documents that existed before ownership was introduced are retained in the database with no owner and are deliberately excluded from every guest and account API. They are not assigned to the first user or guest. An operator must explicitly review and assign legacy rows before making them available. Local drafts created by older releases are likewise not auto-imported because they have no trustworthy owner identity.

Accounts are shared across this single application instance. Use HTTPS for network access, and do not run multiple replicas against the same H2 volume.

## Run locally without Docker

```sh
mkdir -p data
./gradlew bootRun
```

The local H2 database is written to `./data/squareone`.

## Developer documentation

- [System architecture diagrams](docs/architecture.md) — browser, backend, database, export, and sharing flows; rendered on GitHub and in the VS Code Markdown preview.\n- [Backend class diagram](docs/class-diagram.md) — classes and their relationships.
