> **Filename:** `cdd-python-all-WASM.md`
> **Purpose:** Tracks the WebAssembly (WASM) support status and build instructions for integrating the `cdd-python-all` compiler into the CDD Web UI.
> **Current State:** Supported. The Web UI currently provides an offline-first browser execution environment that runs `cdd-python-all` completely client-side.

# WASM Support for cdd-python-all

## Status: Supported ✅

This allows the unified CLI and Web UI to run `cdd-python-all` entirely within the browser without any backend server (i.e., CDN-only mode).

The centralized build script (`../cdd-ctl/scripts/build-wasm-all.mjs`) properly integrates with this language's toolchain to produce the required binaries.
