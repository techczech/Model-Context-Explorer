#!/usr/bin/env bash
# Deploy contextexplorer/ (static, no build) to Cloudflare Pages project "contextexplorer"
# (custom domain contextexplorer.semanticmachines.fyi). The old React app is separate.
set -euo pipefail
cd "$(dirname "$0")/.."
CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-b6ae5bced06492ee6f0c8f92776804da}" \
npx wrangler pages deploy contextexplorer --project-name contextexplorer --branch main \
  --commit-hash "$(git rev-parse HEAD)" --commit-message "$(git log -1 --format=%s)"
