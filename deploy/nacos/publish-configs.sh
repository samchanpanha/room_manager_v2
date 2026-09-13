#!/usr/bin/env bash
# Publish all RentManager config to Nacos (dev: standalone, no auth).
#
# Data-ids pushed:
#   shared-common.yml            — shared infra (db, kafka, keycloak, outbox)
#   gateway.yml + rentmanager-gateway.yml — gateway routes/security (extension + name)
#   <service>.yml (x8)           — each service's full application config
#
# Run from repo root:  ./deploy/nacos/publish-configs.sh
set -euo pipefail

NACOS_URL="${NACOS_URL:-http://localhost:8848}"
GROUP="${NACOS_GROUP:-DEFAULT_GROUP}"
CONFIG_DIR="$(cd "$(dirname "$0")/config" && pwd)"
BACKEND_DIR="$(cd "$(dirname "$0")/../../backend" && pwd)"
SERVICES=(identity property billing ops staff commerce notification report)

publish() {
  local data_id="$1" file="$2"
  [ -f "$file" ] || { echo "skip  $data_id  (missing $file)"; return 0; }
  resp="$(curl -s --fail-with-body -X POST "$NACOS_URL/nacos/v1/cs/configs" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "dataId=$data_id" \
    --data-urlencode "group=$GROUP" \
    --data-urlencode "type=yaml" \
    --data-urlencode "content@$file")"
  echo "pushed $data_id  ->  $resp"
}

echo "NACOS_URL=$NACOS_URL group=$GROUP"

# 1) shared infra
publish shared-common.yml "$CONFIG_DIR/shared-common.yml"

# 2) gateway (extension data-id used by the gateway, plus its name-based id)
cp -f "$BACKEND_DIR/gateway/src/main/resources/application.yml" "$CONFIG_DIR/gateway.yml"
publish gateway.yml "$CONFIG_DIR/gateway.yml"
publish rentmanager-gateway.yml "$CONFIG_DIR/gateway.yml"

# 3) one data-id per microservice, generated from each local application.yml
for svc in "${SERVICES[@]}"; do
  src="$BACKEND_DIR/${svc}-service/src/main/resources/application.yml"
  dst="$CONFIG_DIR/${svc}-service.yml"
  cp -f "$src" "$dst"
  publish "${svc}-service.yml" "$dst"
done

echo "done — all RentManager config is now in Nacos"