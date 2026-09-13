# ── staff-service Dockerfile ────────────────────────────────────────────────
# Multi-stage: Maven build → slim JRE runtime
# Usage (from backend/ directory):
#   docker build -f staff-service/Dockerfile -t rm-staff-service:latest .
# ─────────────────────────────────────────────────────────────────────────

FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

# Copy parent POM, wrapper scripts, and all module POMs first
COPY pom.xml .
COPY mvnw .
COPY .mvn .mvn
COPY common/pom.xml common/
COPY gateway/pom.xml gateway/
COPY identity-service/pom.xml identity-service/
COPY property-service/pom.xml property-service/
COPY billing-service/pom.xml billing-service/
COPY ops-service/pom.xml ops-service/
COPY staff-service/pom.xml staff-service/
COPY commerce-service/pom.xml commerce-service/
COPY notification-service/pom.xml notification-service/
COPY report-service/pom.xml report-service/

# Copy source (common + staff-service needed)
COPY common/src common/src
COPY staff-service/src staff-service/src

# Resolve dependencies offline
RUN ./mvnw -pl common,staff-service -am dependency:go-offline -q 2>/dev/null || true

# Build
RUN ./mvnw -pl common,staff-service -am package -DskipTests -q --no-transfer-progress

# ── Runtime stage ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine AS runtime

RUN addgroup -S rmapp && adduser -S rmapp -G rmapp
USER rmapp

WORKDIR /app
COPY --from=build /workspace/staff-service/target/rentmanager-staff-service-*.jar app.jar

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD wget -qO- http://localhost:8085/actuator/health || exit 1

EXPOSE 8085

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
