#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# RentManager — Full Stack Local Deployment Script
# Spins up PostgreSQL, Infrastructure, Spring Boot Microservices, Gateway & Next.js Frontend
# ──────────────────────────────────────────────────────────────────────────────

set -e

echo "🚀 Starting RentManager Full Stack Deployment..."
echo "📦 Building & Launching Docker Containers..."

docker compose up --build -d

echo ""
echo "✅ RentManager Stack Successfully Started!"
echo "------------------------------------------------------------------------"
echo "🌐 Next.js Frontend App:     http://localhost:3000"
echo "🔀 API Gateway:              http://localhost:8080"
echo "📖 Swagger UI (All APIs):    http://localhost:8080/swagger-ui.html"
echo "📊 Prometheus Metrics:       http://localhost:9090"
echo "🧭 Nacos Console:            http://localhost:8848/nacos (user: nacos / pass: nacos)"
echo "🔑 Keycloak Admin:           http://localhost:7080 (user: admin / pass: admin)"
echo "💬 Kafka UI:                 http://localhost:8090"
echo "------------------------------------------------------------------------"
echo "💡 To check status:  npm run docker:status"
echo "💡 To view logs:     npm run docker:logs"
echo "💡 To stop stack:    npm run docker:down"
