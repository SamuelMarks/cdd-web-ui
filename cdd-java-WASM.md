> **Filename:** `cdd-java-WASM.md`
> **Purpose:** Tracks the WebAssembly (WASM) support status and build instructions for integrating the `cdd-java` compiler into the CDD Web UI.
> **Current State:** Supported. The Web UI currently provides an offline-first browser execution environment that runs `cdd-java` completely client-side.

# WASM Support for cdd-java

## Status: Supported ✅

A WASM (or equivalent Pyodide bundle) is now successfully produced for `cdd-java`.
This allows the unified CLI and Web UI to run `cdd-java` entirely within the browser without any backend server (i.e., CDN-only mode).

The centralized build script (`../cdd-ctl/scripts/build-wasm-all.mjs`) properly integrates with this language's toolchain to produce the required binaries.

