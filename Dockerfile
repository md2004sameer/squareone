FROM node:24-alpine AS editor
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY scripts ./scripts
COPY src/editor ./src/editor
RUN mkdir -p src/main/resources/static/vendor && npm run build:editor

FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /workspace

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew

COPY src ./src
COPY --from=editor /workspace/src/main/resources/static/vendor ./src/main/resources/static/vendor
RUN ./gradlew --no-daemon build \
    && set -- build/libs/*.jar \
    && for artifact in "$@"; do \
        case "$artifact" in \
            *-plain.jar) ;; \
            *) cp "$artifact" /workspace/app.jar && break ;; \
        esac; \
    done \
    && test -f /workspace/app.jar

FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

RUN addgroup -S spring && adduser -S spring -G spring
COPY --from=build --chown=spring:spring /workspace/app.jar /app/app.jar

USER spring:spring

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=20s --start-period=60s --retries=3 \
    CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-8080}/api/documents/health" || exit 1

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
