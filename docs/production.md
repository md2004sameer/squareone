# Release to docs.orbitbot.in

The public domain currently responds through Render. The repository includes a Docker build and `render.yaml` with the `production` profile, database health checks, HTTPS session cookies and manual deployments. Apply these settings to the **existing** Render service. Check its service name before importing the Blueprint; creating a second service does not update the existing domain.

## Before the first upgraded deployment

1. Back up the existing Neon/PostgreSQL database, including large objects (`pg_dump --format=custom` includes them by default for a full database dump). Restore the backup to a separate database and rehearse this release there. Keep the old deployment available until the rehearsal passes.
2. Set the Render environment to:

   ```properties
   SPRING_PROFILES_ACTIVE=production
   SPRING_DATASOURCE_URL=jdbc:postgresql://YOUR_HOST/neondb?sslmode=require&channelBinding=require&currentSchema=squareone
   SPRING_DATASOURCE_USERNAME=YOUR_DATABASE_USER
   SPRING_DATASOURCE_PASSWORD=YOUR_DATABASE_PASSWORD
   DATABASE_SCHEMA=squareone
   SPRING_SQL_INIT_MODE=never
   ```

   Keep credentials in Render's environment settings. `PORT` comes from Render and is supported by the application. The production profile requires PostgreSQL and enables Secure cookies. Use a separate database for local development.
3. If the existing `squareone` schema has application tables but no `flyway_schema_history`, set `FLYWAY_BASELINE_ON_MIGRATE=true` **for the first upgraded startup only**, after the backup and rehearsal. Baseline version is deliberately `0`, so all three migrations run. Remove the flag after a successful deployment. Leave it unset for an empty database or one already managed by Flyway. Do not change the baseline version or enable Hibernate schema updates.
4. Configure `/api/documents/health` as the Render health check. It returns `200 OK` only when the database responds and `503` on a connection failure. Retain the custom domain `docs.orbitbot.in`; Render handles its TLS certificate.

The migrations add missing legacy organization columns, convert PostgreSQL large-object note bodies to UTF-8 text, create workspaces/preferences/history, and install JDBC session tables. Original large objects are retained for recovery. Documents with no account or guest owner remain private and unassigned. Existing sessions from the old in-memory implementation cannot survive this first upgrade; subsequent sessions persist across restarts. Do not clear browser cookies during the upgrade. Register and sync important guest notes before upgrading the old server.

## Validate and deploy

```sh
npm ci
npm audit
npm run build:editor
./gradlew test bootJar
npm run test:persistence
npx playwright install chromium
npm run test:ui
```

The persistence check starts and stops an isolated server twice, using a temporary H2 file. It checks account and guest session recovery, content/JSON, preferences, workspace isolation, revision conflicts, archive/history, CSRF and response headers. To run it on PostgreSQL, supply `SQUAREONE_TEST_DATABASE_URL`, `SQUAREONE_TEST_DATABASE_USERNAME`, `SQUAREONE_TEST_DATABASE_PASSWORD`, `SQUAREONE_TEST_DATABASE_SCHEMA=squareone`, and `SQUAREONE_TEST_PROFILE=production`, pointing only to a disposable test database. The migration test also supports these test database credentials and creates its own legacy schema. These checks write test data; never run them against the live database.

The GitHub Actions workflow repeats the checks with H2 and PostgreSQL and builds the Docker image. The Docker build regenerates the editor bundle from the lockfile and runs backend tests before packaging. Automatic deployments are disabled in the supplied Blueprint; deploy the verified commit through the existing Render service.

After deployment, check `https://docs.orbitbot.in/api/documents/health`, create and reload a note in a test account, confirm history and Archive restoration, and restart the service to confirm the account remains signed in. Check the deployment logs for completed migrations. Remove the one-time baseline flag if it was used.

The current schema upgrade is additive but changes the document content mapping. Rolling the old binary back against the upgraded database is unsafe. Roll back the application and restore the pre-upgrade database backup together during a maintenance window if required.

## Localhost

Use the default profile for HTTP localhost:

```sh
mkdir -p data
./gradlew bootRun
```

Open `http://localhost:8080`. The ignored `.env` is read when present; without database settings the app uses `./data/squareone`. To explicitly use local H2 while ignoring `.env`:

```sh
./gradlew bootRun --args='--spring.config.import= --spring.datasource.url=jdbc:h2:file:./data/squareone --spring.datasource.username=sa --spring.datasource.password= --DATABASE_SCHEMA=PUBLIC'
```

An existing pre-Flyway H2 file needs the same backup and one-time baseline procedure. Keep `SPRING_PROFILES_ACTIVE=production` and `SESSION_COOKIE_SECURE=true` out of HTTP localhost configuration. The hostname and cookie scopes keep localhost and the public domain separate.
