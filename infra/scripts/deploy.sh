#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
INFRA_DIR="${REPO_ROOT}/infra"
ENV_FILE="${ENV_FILE:-${INFRA_DIR}/.env}"
IMAGES_FILE="${INFRA_DIR}/.images.env"
STATE_DIR="${INFRA_DIR}/.deploy-state"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
ORIGIN_URL="${ORIGIN_URL:-}"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
require() { command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"; }

require docker
require git
require curl
require gzip
require flock
[[ -f "${ENV_FILE}" ]] || fail "Missing ${ENV_FILE}; copy infra/.env.example and set real secrets first."

cd "${REPO_ROOT}"
[[ -z "$(git status --porcelain)" ]] || fail "Refusing to deploy a dirty working tree."
REVISION="$(git rev-parse --verify HEAD)"
SHORT_REVISION="$(git rev-parse --short=12 HEAD)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "${STATE_DIR}" "${BACKUP_DIR}"
chmod 700 "${STATE_DIR}" "${BACKUP_DIR}"
exec 9>"${STATE_DIR}/deploy.lock"
flock -n 9 || fail "Another ShiftProof deployment is running."

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a
ORIGIN_URL="${ORIGIN_URL:-http://127.0.0.1:${SHIFTPROOF_ORIGIN_PORT:-18043}}"

compose() {
  docker compose --project-directory "${INFRA_DIR}" --env-file "${ENV_FILE}" -f "${INFRA_DIR}/compose.yaml" "$@"
}

compose config --quiet

PREVIOUS_API="$(compose ps -q api | xargs -r docker inspect --format '{{.Config.Image}}' 2>/dev/null || true)"
PREVIOUS_WEB="$(compose ps -q web | xargs -r docker inspect --format '{{.Config.Image}}' 2>/dev/null || true)"

if [[ -n "$(compose ps -q db)" ]]; then
  BACKUP_PATH="${BACKUP_DIR}/shiftproof-${STAMP}.sql.gz"
  printf 'Backing up PostgreSQL to %s\n' "${BACKUP_PATH}"
  compose exec -T db pg_dump --clean --if-exists --no-owner \
    -U "${POSTGRES_USER:-shiftproof}" -d "${POSTGRES_DB:-shiftproof}" | gzip -9 > "${BACKUP_PATH}"
  chmod 600 "${BACKUP_PATH}"
fi

NEW_API="shiftproof-api:${SHORT_REVISION}"
NEW_WEB="shiftproof-web:${SHORT_REVISION}"
export SHIFTPROOF_API_IMAGE="${NEW_API}"
export SHIFTPROOF_WEB_IMAGE="${NEW_WEB}"

printf 'Building revision %s\n' "${REVISION}"
compose build --pull api web
started=true
if ! compose up -d --remove-orphans db api web gateway; then
  started=false
fi

healthy=false
if [[ "${started}" == true ]]; then
  for _ in $(seq 1 40); do
    if curl --fail --silent --show-error "${ORIGIN_URL}/healthz" >/dev/null \
      && curl --fail --silent --show-error "${ORIGIN_URL}/api/health" >/dev/null; then
      healthy=true
      break
    fi
    sleep 3
  done
fi

if [[ "${healthy}" != true ]]; then
  printf 'New release failed health checks.\n' >&2
  if [[ -n "${PREVIOUS_API}" && -n "${PREVIOUS_WEB}" ]]; then
    printf 'Restoring previous images: %s and %s\n' "${PREVIOUS_API}" "${PREVIOUS_WEB}" >&2
    export SHIFTPROOF_API_IMAGE="${PREVIOUS_API}"
    export SHIFTPROOF_WEB_IMAGE="${PREVIOUS_WEB}"
    if ! compose up -d --no-build api web gateway; then
      printf 'Automatic container rollback also failed; inspect Compose logs immediately.\n' >&2
    fi
  fi
  fail "Deployment did not become healthy. Database backup was preserved."
fi

cat > "${IMAGES_FILE}.tmp" <<EOF
SHIFTPROOF_API_IMAGE=${NEW_API}
SHIFTPROOF_WEB_IMAGE=${NEW_WEB}
EOF
chmod 600 "${IMAGES_FILE}.tmp"
mv "${IMAGES_FILE}.tmp" "${IMAGES_FILE}"

if [[ -n "${PREVIOUS_API}" && -n "${PREVIOUS_WEB}" ]]; then
  cat > "${STATE_DIR}/previous.env.tmp" <<EOF
SHIFTPROOF_API_IMAGE=${PREVIOUS_API}
SHIFTPROOF_WEB_IMAGE=${PREVIOUS_WEB}
DEPLOYED_FROM_REVISION=${REVISION}
EOF
  chmod 600 "${STATE_DIR}/previous.env.tmp"
  mv "${STATE_DIR}/previous.env.tmp" "${STATE_DIR}/previous.env"
fi

printf 'ShiftProof %s is healthy at %s\n' "${SHORT_REVISION}" "${ORIGIN_URL}"
