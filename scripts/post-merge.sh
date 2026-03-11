#!/bin/bash
set -e

echo "[post-merge] Installing dependencies..."
npm install --legacy-peer-deps

echo "[post-merge] Running database migrations..."
npx drizzle-kit push --force

echo "[post-merge] Building project..."
npm run build

echo "[post-merge] Setup complete!"
