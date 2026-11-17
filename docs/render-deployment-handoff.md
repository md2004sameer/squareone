# Resume the Squareone database deployment

The user has requested that the existing live service use Neon so accounts and documents survive deployments, and has installed Render. The current conversation confirms Render is installed, but has no Render service-management tools. Continue from a new conversation with Render available.

## Confirmed findings

- The production domain is `https://docs.orbitbot.in`. Its uncached HTML and JavaScript matched commit `20f9a77` during the audit on 18 November 2026. That release's Docker image defaults to `jdbc:h2:file:/data/squareone`.
- A new live guest workspace was absent from the Neon database configured in this project. The live session cookie also lacked `Secure`. Inspect the actual Render environment before concluding which database it currently uses.
- A read-only Neon audit found five accounts, seven documents, preferences, history, workspaces and JDBC session records in schema `squareone`. All five account passwords are BCrypt hashes. Flyway migrations 1–3 and baseline 0 are already present and successful.
- Current `main` removes the Docker H2 default and requires explicit PostgreSQL credentials outside isolated tests. It also contains the toolbar and mobile fixes. Check the latest pushed commit when resuming.

## Prepared configuration and verification

- `.env.render` contains the actual Neon settings, `SPRING_PROFILES_ACTIVE=production`, `DATABASE_SCHEMA=squareone`, disabled SQL initialization, Hibernate validation and secure session cookies. It is Git-ignored and owner-readable only. Read it without printing credentials. Do not commit it.
- `docs/production.md` explains deployment and legacy H2 recovery.
- `scripts/verify-persistence.mjs` now checks saved content/JSON, metadata, preferences and history after restart, persistent cookie flags, and login from a fresh browser using the original credentials without signup. It passed against isolated PostgreSQL using the production profile, and against temporary H2. Backend tests and packaging also passed.
- These documentation and test changes are uncommitted. Preserve them.

## Remaining live work

1. Identify the existing Render service attached to `docs.orbitbot.in`; inspect its release, environment, disk and database configuration. Do not create another service.
2. Before changing environment variables or deploying, preserve and verify a consistent backup/export of any data still in a local H2 database. Changing the connection does not import those records. Preserve existing Neon accounts and documents when planning an import. Do not reset or recreate the Neon schema.
3. Apply the prepared settings to that existing service and deploy the verified current `main` commit. Do not enable the one-time Flyway baseline flag for the already migrated Neon database.
4. Verify the live database connection and deployed release, HTTPS cookie flags, and retained account/document access. A plain `OK` health response alone does not prove which database is in use.
5. Do not run the persistence test suite against the live Neon database; it writes test records. Use its temporary database or a disposable PostgreSQL database.

No live deployment or database migration has been performed yet.
