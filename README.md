# Squareone

## Run with Docker

Build the application image and start the service:

```sh
docker compose up --build -d
```

Open [http://localhost:8080](http://localhost:8080). Check container health and logs with:

```sh
docker compose ps
docker compose logs -f squareone
```

To use a different host port, set `APP_PORT` when starting Compose:

```sh
APP_PORT=9090 docker compose up --build -d
```

Stop the service with `docker compose down`.

## Build and run the image directly

```sh
docker build -t squareone .
docker run --rm -p 8080:8080 squareone
```

The image builds and tests the project with Gradle, then runs the executable JAR on Java 21 as a non-root user. The container exposes port `8080` and includes a health check.

## Run locally

```sh
./gradlew bootRun
```

## Storage note

Documents are currently held in application memory. They are lost when the application stops or the container is recreated; the current implementation does not provide persistent document storage.
