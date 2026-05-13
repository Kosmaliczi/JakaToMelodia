# syntax=docker/dockerfile:1.7

# ============================================================
# Stage 1: build frontendu (React + Vite + Tailwind)
# Wyjście trafia do /workspace/src/main/resources/static/
# (zgodnie z outDir w frontend/vite.config.js)
# ============================================================
FROM node:20-alpine AS frontend
WORKDIR /workspace/frontend

# Najpierw same deklaracje paczek — dzięki temu Docker cache'uje warstwę npm install
COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
        npm ci --no-audit --no-fund; \
    else \
        npm install --no-audit --no-fund; \
    fi

# Reszta źródeł + build produkcyjny
COPY frontend/ ./
RUN npm run build

# ============================================================
# Stage 2: pakowanie backendu (Spring Boot) z gotowym frontendem
# ============================================================
FROM maven:3.9-eclipse-temurin-21 AS backend
WORKDIR /workspace

# Cache zależności Maven (osobna warstwa od źródeł)
COPY pom.xml ./
RUN mvn -B -q dependency:go-offline

# Źródła + zbudowany frontend ze stage'u 1
COPY src/ ./src/
COPY --from=frontend /workspace/src/main/resources/static/ ./src/main/resources/static/

# JAR (bez testów — testy odpalaj lokalnie albo w CI)
RUN mvn -B -q -DskipTests package \
    && cp target/melodia-*.jar /workspace/app.jar

# ============================================================
# Stage 3: runtime
# ============================================================
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Nie biegamy jako root
RUN addgroup -S app && adduser -S app -G app
COPY --from=backend /workspace/app.jar /app/app.jar
USER app

EXPOSE 8080

ENV JAVA_OPTS="-Xmx512m -XX:+UseG1GC -XX:MaxRAMPercentage=75"

ENTRYPOINT ["sh","-c","exec java $JAVA_OPTS -jar /app/app.jar"]
