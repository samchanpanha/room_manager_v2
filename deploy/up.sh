#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# RentManager — One-Shot Local Deployment
#   builds/start the whole stack, waits for Nacos, imports all configs,
#   waits for every service to become healthy, and verifies the Nacos console.
#
# Usage (from repo root):
#   ./deploy/up.sh              # start with existing images (fast)
#   ./deploy/up.sh --build      # rebuild images, then deploy
#   ./deploy/up.sh --split      # use deploy/docker-compose.{infra,services}.yml
#
# Nacos console:  http://localhost:8848/nacos  (auth disabled in dev)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
EXTRA_ARGS=()
DOCTL=()
MODEL="unified"
for arg in "$@"; do
  case "$arg" in
    --build) EXTRA_ARGS+=(--build) ;;
    --split)
      MODEL="split"
      COMPOSE_FILE=""
      DOCTL=(-f deploy/docker-compose.infra.yml -f deploy/docker-compose.services.yml)
      ;;
    --no-push) : ;; # reserved
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

NACOS_URL="http://localhost:8848"
NACOS_READY_ENDPOINT="/nacos/v1/console/health/readiness"
NACOS_TIMEOUT=900          # Nacos is slow to boot on a loaded machine
NACOS_EXPECTED_CONFIGS=12  # shared-common + services + gateway + rentmanager-gateway + 8 services

echo "== deploying (model=$MODEL) =="

echo ">> docker compose up -d${EXTRA_ARGS[*]:+ ${EXTRA_ARGS[*]}}"
docker compose ${DOCTL[@]+"${DOCTL[@]}"} up -d ${EXTRA_ARGS[@]+"${EXTRA_ARGS[@]}"}

echo ">> waiting for Nacos config API at ${NACOS_URL} ..."
deadline=$(( $(date +%s) + NACOS_TIMEOUT ))
until curl -sf --max-time 5 "$NACOS_URL$NACOS_READY_ENDPOINT" >/dev/null 2>&1; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "!! Nacos did not become ready within ${NACOS_TIMEOUT}s." >&2
    echo "   check: docker compose logs -f nacos"; exit 1
  fi
  printf '.'
  sleep 10
done
echo "  Nacos ready."

echo ">> importing all configs into Nacos ..."
./deploy/nacos/publish-configs.sh

echo ">> waiting for remaining services to become healthy ..."
docker compose ${DOCTL[@]+"${DOCTL[@]}"} up -d --wait 2>/dev/null || true

echo ">> verifying Nacos config store ..."
total="$(curl -sf --max-time 10 \
  "$NACOS_URL/nacos/v1/cs/configs?search=blur&dataId=&group=${GROUP:-DEFAULT_GROUP}&pageNo=1&pageSize=30" \
  | sed -nE 's/.*"totalCount"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' | head -1)"
echo "  configs in Nacos: ${total:-?} (expected ${NACOS_EXPECTED_CONFIGS})"
if [ "${total:-0}" -lt "$NACOS_EXPECTED_CONFIGS" ]; then
  echo "!! Some configs may be missing from Nacos." >&2
fi

echo
echo "  ── dashboard ────────────────────────────────────────────────────"
echo "  App:        http://localhost:3000"
echo "  Nacos:      ${NACOS_URL}/nacos   (configs should now be listed)"
echo "  Gateway:    http://localhost:8080"
echo "  Keycloak:   http://localhost:7080"
echo "  Rootprint:  http://localhost:8282"
echo "  ── logs (Rootprint) ────────────────────────────────────────────"
echo "  1. Open http://localhost:8282, create admin account"
echo "  2. Settings → API keys → create ingest token for index 'otel-logs-v0_9'"
echo "  3. Add ROOTPRINT_INGEST_TOKEN=<paste-token-here> to .env"
echo "  4. docker compose up -d            # applies the token"
echo "     (logs export 403 until the token is set)"
echo "  ────────────────────────────────────────────────────────────────"
echo "done."
