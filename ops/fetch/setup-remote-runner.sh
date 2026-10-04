#!/usr/bin/env bash
# Provisions a clean box as a fetch runner. Run ON the new VPS as root.
#
# It installs only what the fetcher needs. Nothing here is an evasion measure:
# the User-Agent, the robots handling and the rate limits are identical to the
# origin box. The single variable under test is the source IP.
set -euo pipefail

echo "==> system packages"
apt-get update -qq
apt-get install -y -qq git curl ca-certificates

echo "==> node 22"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
apt-get install -y -qq nodejs

echo "==> repository"
git clone --depth 1 --branch feat/fetch-stage1 \
  https://github.com/xmpcross/strapi-originfacts.git /opt/fetch-runner
cd /opt/fetch-runner/ops/fetch

echo "==> dependencies and browser"
npm install --no-audit --no-fund
npx playwright install --with-deps chromium

echo "==> ready"
echo
echo "Run the reachability sweep:"
echo "    cd /opt/fetch-runner/ops/fetch && npx tsx sweep.ts"
echo
echo "Then copy the result back to the origin box:"
echo "    scp /opt/fetch-runner/data/captures/reachability.json \\"
echo "        root@51.161.208.188:/opt/worktrees/originfacts-fetch/data/captures/reachability.remote.json"
