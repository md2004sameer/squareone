# Squareone

Squareone is a free-to-use, simple text editor.

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

Documents are stored in an H2 database on the named `squareone-data` volume and survive container recreation. Back up the database regularly; stop the app before copying the volume to ensure a consistent backup. `docker compose down -v` deletes the volume and all stored documents.

There is no authentication or per-user data separation: everyone who can reach the app can view, create, edit, and delete the same documents. Do not store private or sensitive content or expose this instance as a shared public service unless shared documents are intentional. This setup is for a single application instance; do not run multiple replicas against the H2 volume.

## Run locally without Docker

```sh
mkdir -p data
./gradlew bootRun
```

The local H2 database is written to `./data/squareone`.
