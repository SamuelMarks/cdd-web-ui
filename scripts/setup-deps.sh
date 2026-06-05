#!/usr/bin/env bash
set -e

echo "Setting up sibling dependencies..."

cd ..

echo "Building cdd-docs-ui..."
cd cdd-docs-ui
npm install
npm run build
cd ..

echo "Building cdd-browser-sdk..."
cd cdd-browser-sdk
npm install
npm run build
cd ..

echo "Dependencies setup complete."
