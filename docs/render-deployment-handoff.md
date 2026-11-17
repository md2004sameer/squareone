# Squareone database deployment — completed

Completed on 18 November 2026. The existing Squareone service at `https://docs.orbitbot.in` now runs commit `d4a178764c971f970e31a98535e2d0d91fad58d0` from `main` using Neon/PostgreSQL. Render OAuth access was established through the local Codex MCP client; no additional plugin installation is needed.

## Confirmed findings

- Before the fix, uncached live HTML and JavaScript matched files last changed in commit `20f9a77`. The active Render deployment was `7f24191`, whose Docker image defaults to `jdbc:h2:file:/data/squareone`.
- Before the fix, a live guest workspace was absent from the configured Neon database, and the session cookie lacked `Secure`.
- Render logs confirmed why newer releases failed: the datasource URL did not start with `jdbc`. The previously live service was on the free compute plan, which provides neither SSH nor dashboard shell access.
- A read-only Neon audit found five accounts, seven documents, preferences, history, workspaces and JDBC session records in schema `squareone`. All five account passwords are BCrypt hashes. Flyway migrations 1–3 and baseline 0 are already present and successful.
- Current `main` removes the Docker H2 default and requires explicit PostgreSQL credentials outside isolated tests. It also contains the toolbar and mobile fixes. Check the latest pushed commit when resuming.

## Prepared configuration and verification

- `.env.render` contains the actual Neon settings, `SPRING_PROFILES_ACTIVE=production`, `DATABASE_SCHEMA=squareone`, disabled SQL initialization, Hibernate validation and secure session cookies. It is Git-ignored and owner-readable only. Read it without printing credentials. Do not commit it.
- `docs/production.md` explains deployment and legacy H2 recovery.
- `scripts/verify-persistence.mjs` now checks saved content/JSON, metadata, preferences and history after restart, persistent cookie flags, and login from a fresh browser using the original credentials without signup. It passed against isolated PostgreSQL using the production profile, and against temporary H2. Backend tests and packaging also passed.
- A real browser check on the public deployment saved and reloaded a temporary note. Read-only SQL verified its HTML/JSON, workspace and session in Neon. Cookies were Secure, HTTP-only, SameSite=Lax and persistent for 14 days. The temporary note and its versions were then removed through its own guest-scoped API.

## Completed live work

1. Used the existing service `srv-dbd6dgm7bikc73f97is0`, named `squareone`, in its existing owner workspace. No replacement service was created and its free compute plan was retained.
2. Created `data/backups/neon-squareone-20261117T195446Z.dump`, with an accompanying SHA-256 manifest. A full restore into isolated local PostgreSQL succeeded, recovering five accounts, seven documents, nine history records and twelve sessions. Backup files are owner-readable and Git-ignored.
3. The user explicitly authorized discarding the old live instance's local H2 data after being informed that its free plan prevented a database-file backup. That local data was not migrated. Existing Neon records were preserved.
4. Merged the eight settings from `.env.render` into the existing service's environment without replacing other environment variables. This set the correct PostgreSQL JDBC URL, credentials, production profile, schema, validation, SQL initialization and secure-cookie settings. It did not reset the database or enable the one-time Flyway baseline flag.
5. The environment update triggered deployment `dep-dbub2pp5efls739qd1qg` for commit `d4a178764c971f970e31a98535e2d0d91fad58d0`. Render marked it live at 01:29 IST on 18 November 2026. Logs confirm the production profile, PostgreSQL 18.7 and successful Flyway validation of the existing migration history.
6. Public health returned HTTP 200, the page served the current `v=29` bootstrap, and browser save/reload plus direct Neon storage checks passed. Five existing accounts with BCrypt password hashes remained present. Verification results are in the private, ignored file `data/backups/live-deployment-verification.json`.

## Subsequent deployments

The existing service retains automatic deployments from `main`; the repository Blueprint's manual-deployment setting was not applied to this service. Keep its Neon connection and schema stable. Credentials and backups must remain out of Git. Do not run the persistence suite against the live database; use its temporary database or an explicitly supplied disposable PostgreSQL database.
