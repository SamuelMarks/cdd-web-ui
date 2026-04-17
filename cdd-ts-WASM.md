# WASM Support for cdd-ts

## Status: Supported ✅

A WASM (or equivalent Pyodide bundle) is now successfully produced for `cdd-ts`.
This allows the unified CLI and Web UI to run `cdd-ts` entirely within the browser without any backend server (i.e., CDN-only mode).

The centralized build script (`../cdd-ctl/scripts/build-wasm-all.mjs`) properly integrates with this language's toolchain to produce the required binaries.

