# ---- build stage ----
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY src ./src
# кэшируем локальный репозиторий maven
RUN --mount=type=cache,target=/root/.m2 mvn -DskipTests clean package

# ---- runtime stage ----
FROM eclipse-temurin:21-jre
WORKDIR /app

# (опционально) запустить не под root
RUN useradd -u 10001 -m appuser
USER appuser

# куда будем складывать аватары в контейнере
ENV APP_FILES_ROOT=/data
VOLUME ["/data"]

COPY --from=build /build/target/sportlink-app-*.jar /app/app.jar

# JVM тюнинг как было
ENV JAVA_OPTS="-XX:+UseG1GC -XX:MaxRAMPercentage=75"

EXPOSE 8080

# healthcheck (опционально)
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app/app.jar"]
