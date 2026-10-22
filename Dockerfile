FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /workspace

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew

COPY src ./src
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

RUN addgroup -S spring && adduser -S spring -G spring && mkdir -p /data && chown spring:spring /data
COPY --from=build --chown=spring:spring /workspace/app.jar /app/app.jar

USER spring:spring

ENV SPRING_DATASOURCE_URL=jdbc:h2:file:/data/squareone

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "/app/app.jar"]
