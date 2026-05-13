#!/usr/bin/env bash
set -Eeuo pipefail

OWNER="tlmkira"
TAG=""
COMPOSE_FILE=".docker/selfhost/compose.yml"
ENV_FILE=".docker/selfhost/.env"
HEALTH_URL="http://127.0.0.1:3010/"

usage() {
  cat <<'EOF'
Usage:
  bash .docker/selfhost/deploy-ghcr.sh --tag <image-tag> [--owner tlmkira]

Options:
  --tag       Required image tag built by GitHub Actions.
  --owner     GHCR owner or organization. Default: tlmkira.
  --env-file  Compose env file. Default: .docker/selfhost/.env.
  --compose   Compose file. Default: .docker/selfhost/compose.yml.
  --url       Local health URL. Default: http://127.0.0.1:3010/.
  -h, --help  Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="${2:-}"
      shift 2
      ;;
    --owner)
      OWNER="${2:-}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --compose)
      COMPOSE_FILE="${2:-}"
      shift 2
      ;;
    --url)
      HEALTH_URL="${2:-}"
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$TAG" ]]; then
  echo "Missing required --tag." >&2
  usage
  exit 2
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  echo "Create it from .docker/selfhost/.env.example first." >&2
  exit 1
fi

AFFINE_IMAGE="ghcr.io/${OWNER}/kite-affine:${TAG}"
NOTEBOOK_IMAGE="ghcr.io/${OWNER}/kite-affine-notebook:${TAG}"

replace_or_append_env() {
  local key="$1"
  local value="$2"
  local escaped
  escaped="$(printf '%s\n' "$value" | sed 's/[\/&]/\\&/g')"

  if grep -qE "^${key}=" "$ENV_FILE"; then
    sed -i "s/^${key}=.*/${key}=${escaped}/" "$ENV_FILE"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

echo "Using AFFiNE image:   $AFFINE_IMAGE"
echo "Using Notebook image: $NOTEBOOK_IMAGE"

replace_or_append_env "AFFINE_IMAGE" "$AFFINE_IMAGE"
replace_or_append_env "NOTEBOOK_IMAGE" "$NOTEBOOK_IMAGE"

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

echo "Pulling updated images..."
compose pull affine affine_migration notebook

echo "Starting dependencies..."
compose up -d postgres redis
compose up -d --no-deps --force-recreate notebook

echo "Running migration..."
compose rm -sf affine_migration >/dev/null 2>&1 || true
compose up --force-recreate affine_migration

echo "Restarting AFFiNE server..."
compose up -d --no-deps --force-recreate affine

echo "Container status:"
compose ps

echo "Checking local HTTP endpoint: $HEALTH_URL"
if command -v curl >/dev/null 2>&1; then
  curl -I --max-time 15 "$HEALTH_URL" || true
else
  echo "curl is not installed; skipped local HTTP check."
fi

echo "Deployment finished."
