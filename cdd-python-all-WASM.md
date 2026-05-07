# WASM Support for cdd-python-all

## Status: Supported ✅

This allows the unified CLI and Web UI to run `cdd-python-all` entirely within the browser without any backend server (i.e., CDN-only mode).

The centralized build script (`../cdd-ctl/scripts/build-wasm-all.mjs`) properly integrates with this language's toolchain to produce the required binaries.
