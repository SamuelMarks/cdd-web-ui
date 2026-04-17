# WASM Support for cdd-c

## Status: Supported ✅

A WASM (or equivalent Pyodide bundle) is now successfully produced for `cdd-c`.
This allows the unified CLI and Web UI to run `cdd-c` entirely within the browser without any backend server (i.e., CDN-only mode).

The centralized build script (`../cdd-ctl/scripts/build-wasm-all.mjs`) properly integrates with this language's toolchain to produce the required binaries.

