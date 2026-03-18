#!/usr/bin/env bash
# Syncs web/.env.local → Railway environment variables.
# Skips blank values, comments, and FB_SESSION_B64 (managed via Firebase RTDB).
#
# Usage:
#   railway login
#   railway link        # link to your Railway project once
#   bash scripts/sync-env-to-railway.sh

set -e
cd "$(dirname "$0")/.."

ENV_FILE="web/.env.local"
SKIP_KEYS=("FB_SESSION_B64")

if ! command -v railway &>/dev/null; then
  echo "Error: Railway CLI not found. Install it first:"
  echo "  npm i -g @railway/cli"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

echo "Syncing $ENV_FILE → Railway..."
COUNT=0

while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip comments and blank lines
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue

  KEY="${line%%=*}"
  VAL="${line#*=}"

  # Skip blank values
  [[ -z "$VAL" ]] && echo "  Skipping $KEY (empty)" && continue

  # Skip blocked keys
  for skip in "${SKIP_KEYS[@]}"; do
    if [[ "$KEY" == "$skip" ]]; then
      echo "  Skipping $KEY (managed via Firebase RTDB)"
      continue 2
    fi
  done

  echo "  Setting $KEY"
  railway variables set "$KEY=$VAL"
  ((COUNT++))
done < "$ENV_FILE"

echo ""
echo "Done — $COUNT variables synced to Railway."
