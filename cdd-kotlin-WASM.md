> **Filename:** `cdd-kotlin-WASM.md`
> **Purpose:** Tracks the WebAssembly (WASM) support status and build instructions for integrating the `cdd-kotlin` compiler into the CDD Web UI.
> **Current State:** Supported. The Web UI currently provides an offline-first browser execution environment that runs `cdd-kotlin` completely client-side.

# WASM Support for cdd-kotlin

## Status: Supported ✅

This allows the unified CLI and Web UI to run completely in CDN-only mode (no backend server).
This allows the unified CLI and Web UI to run `cdd-kotlin` entirely within the browser without any backend server (i.e., CDN-only mode).

The centralized build script (`../cdd-ctl/scripts/build-wasm-all.mjs`) properly integrates with this language's toolchain to produce the required binaries.
