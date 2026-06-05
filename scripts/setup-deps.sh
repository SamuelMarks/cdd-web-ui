#!/usr/bin/env bash
set -e

echo "Setting up sibling dependencies..."

cd ..

echo "Building cdd-docs-ui..."
cd cdd-docs-ui
npm install
npm run build
cd ..

echo "Building cdd-java-cli..."
cd cdd-openapi-test-harness/cdd-java/package
npm install || true # it has no dependencies but just in case
npm run build
cd ../../..

echo "Building cdd-ctl-wasm-sdk..."
cd cdd-ctl/cdd-ctl-wasm-sdk
npm install
npm run build
cd ../..

echo "Dependencies setup complete."
