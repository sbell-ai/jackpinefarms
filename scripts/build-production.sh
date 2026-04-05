#!/bin/bash
set -e

echo "=== Building farmops-landing ==="
BASE_PATH=/farmops-landing/ pnpm --filter @workspace/farmops-landing run build

echo "=== Embedding farmops-landing into store static output ==="
rm -rf artifacts/store/dist/public/farmops-landing
cp -r artifacts/farmops-landing/dist artifacts/store/dist/public/farmops-landing

echo "=== Building api-server ==="
pnpm --filter @workspace/api-server run build

echo "=== Production build complete ==="
