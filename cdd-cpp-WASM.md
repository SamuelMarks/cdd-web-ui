> **Filename:** `cdd-cpp-WASM.md`
> **Purpose:** Tracks the WebAssembly (WASM) support status and build instructions for integrating the `cdd-cpp` compiler into the CDD Web UI.
> **Current State:** Supported. The Web UI currently provides an offline-first browser execution environment that runs `cdd-cpp` completely client-side.

# WASM Support for cdd-cpp

## Status: Supported ✅

This allows the unified CLI and Web UI to run completely in CDN-only mode (no backend server).
This allows the unified CLI and Web UI to run `cdd-cpp` entirely within the browser without any backend server (i.e., CDN-only mode).

The centralized build script (`../cdd-ctl/scripts/build-wasm-all.mjs`) properly integrates with this language's toolchain to produce the required binaries.

