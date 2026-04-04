#!/bin/bash
set -e

echo "=== Building farmops-landing ==="
BASE_PATH=/farmops/ pnpm --filter @workspace/farmops-landing run build

echo "=== Building api-server ==="
pnpm --filter @workspace/api-server run build

echo "=== Production build complete ==="
