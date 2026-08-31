#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
INFRA_DIR="${REPO_ROOT}/infra"
ENV_FILE="${ENV_FILE:-${INFRA_DIR}/.env}"
IMAGES_FILE="${INFRA_DIR}/.images.env"
STATE_FILE="${INFRA_DIR}/.deploy-state/previous.env"
ORIGIN_URL="${ORIGIN_URL:-}"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ -f "${ENV_FILE}" ]] || fail "Missing ${ENV_FILE}."
[[ -f "${STATE_FILE}" ]] || fail "No previous release state is available."

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
# shellcheck disable=SC1090
source "${STATE_FILE}"
set +a
ORIGIN_URL="${ORIGIN_URL:-http://127.0.0.1:${SHIFTPROOF_ORIGIN_PORT:-18043}}"

[[ "${SHIFTPROOF_API_IMAGE:-}" == shiftproof-api:* ]] || fail "Invalid API rollback image."
[[ "${SHIFTPROOF_WEB_IMAGE:-}" == shiftproof-web:* ]] || fail "Invalid web rollback image."
docker image inspect "${SHIFTPROOF_API_IMAGE}" >/dev/null
docker image inspect "${SHIFTPROOF_WEB_IMAGE}" >/dev/null

compose() {
  docker compose --project-directory "${INFRA_DIR}" --env-file "${ENV_FILE}" -f "${INFRA_DIR}/compose.yaml" "$@"
}

printf 'Rolling back to %s and %s\n' "${SHIFTPROOF_API_IMAGE}" "${SHIFTPROOF_WEB_IMAGE}"
compose up -d --no-build api web gateway || fail "Compose could not start the previous images."

for _ in $(seq 1 40); do
  if curl --fail --silent --show-error "${ORIGIN_URL}/healthz" >/dev/null \
    && curl --fail --silent --show-error "${ORIGIN_URL}/api/health" >/dev/null; then
    cat > "${IMAGES_FILE}.tmp" <<EOF
SHIFTPROOF_API_IMAGE=${SHIFTPROOF_API_IMAGE}
SHIFTPROOF_WEB_IMAGE=${SHIFTPROOF_WEB_IMAGE}
EOF
    chmod 600 "${IMAGES_FILE}.tmp"
    mv "${IMAGES_FILE}.tmp" "${IMAGES_FILE}"
    printf 'Rollback is healthy at %s\n' "${ORIGIN_URL}"
    exit 0
  fi
  sleep 3
done

fail "Rollback containers did not become healthy; inspect docker compose logs immediately."
