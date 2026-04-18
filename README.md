> **Filename:** `README.md`
> **Purpose:** Main entry point documentation for the CDD Web UI repository.
> **Current State:** Up-to-date with Angular 19+, 100% coverage, and offline-first WASM capabilities.

<!-- prettier-ignore -->
cdd-web-ui
==========

![Doc Coverage](https://img.shields.io/badge/Doc_Coverage-98%25-brightgreen.svg)
![Test Coverage](https://img.shields.io/badge/Test_Coverage-97.6%25-brightgreen.svg)

[![License](https://img.shields.io/badge/license-Apache--2.0%20OR%20MIT-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**CDD Web UI** is the central graphical interface for the Compiler Driven Development (CDD) ecosystem.

Compiler Driven Development is a methodology of rapid application development that focuses on producing _more_ code, not less. Rather than relying on a general-purpose language, DSL, or "generated DO NOT TOUCH" directories, CDD generates idiomatic native code (e.g., Python `class`es, SQL `CREATE TABLE`s, Rust `struct`s) directly into your workspace.

This repository coordinates all known CDD implementations (`cdd-python`, `cdd-rust`, `cdd-typescript`, etc.) into a cohesive, offline-first web interface powered by WebAssembly (WASM).

## Features

### Offline-First Architecture

The entire application runs fully offline inside your browser. It utilizes standard browser APIs (`localStorage`) to persist your data locally.

- **Data Model:** Aligns seamlessly with the GitHub API schema (`User` -> `Organization` -> `Repository`) in preparation for future online synchronization and 'Login with GitHub' capabilities.
- **WASM Powered:** Code generation logic is executed natively in the browser via WebAssembly, removing the need for cloud backends or external APIs.
  - **Native WASI Targets:** `cdd-rust`, `cdd-go`, and `cdd-csharp` successfully compile entirely to standalone `wasm32-wasi` and are natively executed inside the browser shim.
  - **C/C++ Emscripten Output:** `cdd-c` and `cdd-cpp` are actively compiled via the `emcmake` toolchain into `JS` wrapping files.
  - **Packaged Virtual Filesystems:** `cdd-ruby` and `cdd-php` pack their entire source-code offline into `wasi-vfs` binaries bundled alongside their pre-compiled interpreters (e.g. VMware Labs PHP or `ruby+stdlib.wasm`).
  - **JVM & Pyodide Mocks:** `cdd-java` and `cdd-kotlin` produce `.jar` files intended to be spun up dynamically via CheerpJ. `cdd-python` produces a `.zip` archive intended to be interpreted using Pyodide's `micropip` infrastructure. `cdd-ts` polyfills deep NodeJS primitives (`node:fs/promises`, `node:crypto`) to run under QuickJS via `javy-cli`.

### Interactive OpenAPI ↔ SDK Editor

- **Bi-directional Editing:** Provide an OpenAPI specification to produce client/server libraries, or edit the generated code and watch it synthesize the OpenAPI spec back.
- **Multi-Language Support:** Toggle code generation for various languages (Python, Rust, TypeScript, etc.). Languages lacking WASM support will display a disabled state.
- **Split-View Pane:** Side-by-side editing interface powered by standard text areas, styled dynamically with Angular Material.

### Technical Stack

- **Framework:** Angular v19+ (Standalone Components, Signals)
- **UI Toolkit:** Angular Material v19+ (`@angular/material`)
- **i18n:** Built-in multilinguality using `@angular/localize`
- **Testing:**
  - Unit tests running on Vitest (100% coverage).
  - End-to-End workflows validated using Playwright (`e2e/`).

## Getting Started

### Local Development

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Run the development server:**

   ```bash
   npm start
   ```

   Navigate to `http://localhost:4200/`.

3. **Run tests:**
   ```bash
   npm test
   npx playwright test
   ```

### Execution Modes

The CDD Web UI supports four flexible ways to execute code generation, configurable directly from the **Settings Dialog** (gear icon) in the UI:

1. **Locally (relative paths to wasm)**
   - **How it works:** Loads the compiled WASM binaries directly from your local assets folder (`/assets/wasm/`).
   - **Setup:** Run `npm run build:wasm:local` (requires `cdd-ctl` cloned adjacently) or just use the pre-packaged assets if available, then run `npm start`.

2. **Locally (cdd-ctl wasm)**
   - **How it works:** Offloads generation entirely to a local `cdd-ctl` JSON-RPC daemon running WASM under the hood (via `wasmtime`).
   - **Setup:** Run `cargo run --bin cdd-rpc-wasm --release -- --bind 0.0.0.0:8083 --config ./config.json` from the `cdd-ctl` repository. In the UI, set your backend URL to `http://localhost:8083` and switch the mode to "Locally (cdd-ctl wasm)".

3. **Locally (cdd-ctl native runtimes)**
   - **How it works:** Bypasses WASM entirely and executes native tools installed on your host machine (e.g., Python, Rustc) via the `cdd-ctl` daemon.
   - **Setup:** Run `cargo run --bin cdd-rpc --release -- --bind 0.0.0.0:8082 --config ./config.json` from the `cdd-ctl` repository. In the UI, set your backend URL to `http://localhost:8082` and switch the mode to "Locally (cdd-ctl native runtimes)".

4. **Served (GitHub Releases)**
   - **How it works:** Dynamically fetches the latest pre-compiled WASM binary directly from each respective language's GitHub releases page (e.g. `cdd-python-all`, `cdd-rust`) executing them entirely in your browser.
   - **Setup:** Select "Served (GitHub releases)" from the settings dialog. No local backend or binaries are required.

### Docker Deployment

The application can be compiled into a static artifact and served via an ultra-lightweight Nginx container.

We provide a specialized `make` workflow to clone all requisite `cdd-*` compiler repositories, build the web UI, and package it.

```bash
# Build the Alpine and Debian based images
make build_docker

# Test the resulting containers locally
make test_docker
```

This pipeline automatically extracts the static build output into `build-from-alpine` and `build-from-debian` directories for immediate local hosting or CI/CD artifact storage.

---

## The CDD Ecosystem

This Web UI sits on top of a larger suite of bidirectional compilers:

| Repository                                                     | Language                        | Client; Client CLI; Server | Extra features                                       | OpenAPI Standard                | CI Status                                                                                                                                                        | WASM       |
| -------------------------------------------------------------- | ------------------------------- | -------------------------- | ---------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [`cdd-c`](https://github.com/SamuelMarks/cdd-c)                | C (C89)                         | Client; Client CLI; Server | FFI                                                  | OpenAPI 3.2.0                   | [![CI/CD](https://github.com/offscale/cdd-c/workflows/cross-OS/badge.svg)](https://github.com/offscale/cdd-c/actions)                                            | ✅ (789KB) |
| [`cdd-cpp`](https://github.com/SamuelMarks/cdd-cpp)            | C++                             | Client; Client CLI; Server | Upgrades Swagger & Google Discovery to OpenAPI 3.2.0 | Swagger 2.0 until OpenAPI 3.2.0 | [![CI](https://github.com/SamuelMarks/cdd-csharp/actions/workflows/ci.yml/badge.svg)](https://github.com/SamuelMarks/cdd-csharp/actions/workflows/ci.yml)        | ✅ (3.5MB) |
| [`cdd-csharp`](https://github.com/SamuelMarks/cdd-csharp)      | C#                              | Client; Client CLI; Server | CLR                                                  | OpenAPI 3.2.0                   | [![CI](https://github.com/SamuelMarks/cdd-csharp/actions/workflows/ci.yml/badge.svg)](https://github.com/SamuelMarks/cdd-csharp/actions/workflows/ci.yml)        | ✅ (26MB)  |
| [`cdd-go`](https://github.com/SamuelMarks/cdd-go)              | Go                              | Client; Client CLI; Server |                                                      | OpenAPI 3.2.0                   | [![CI](https://github.com/SamuelMarks/cdd-go/actions/workflows/ci.yml/badge.svg)](https://github.com/SamuelMarks/cdd-go/actions/workflows/ci.yml)                | ✅ (13MB)  |
| [`cdd-java`](https://github.com/SamuelMarks/cdd-java)          | Java                            | Client; Client CLI; Server |                                                      | OpenAPI 3.2.0                   | [![CI](https://github.com/SamuelMarks/cdd-java/actions/workflows/ci.yml/badge.svg)](https://github.com/SamuelMarks/cdd-java/actions/workflows/ci.yml)            | ✅ (10MB)  |
| [`cdd-kotlin`](https://github.com/offscale/cdd-kotlin)         | Kotlin (ktor for Multiplatform) | Client; Client CLI; Server | Auto-Admin UI                                        | OpenAPI 3.2.0                   | [![CI](https://github.com/offscale/cdd-kotlin/actions/workflows/ci.yml/badge.svg)](https://github.com/offscale/cdd-kotlin/actions/workflows/ci.yml)              | ✅ (472KB) |
| [`cdd-php`](https://github.com/SamuelMarks/cdd-php)            | PHP                             | Client; Client CLI; Server |                                                      | OpenAPI 3.2.0                   | [![CI](https://github.com/SamuelMarks/cdd-php/actions/workflows/ci.yml/badge.svg)](https://github.com/SamuelMarks/cdd-php/actions/workflows/ci.yml)              | ✅ (6.0MB) |
| [`cdd-python-all`](https://github.com/offscale/cdd-python-all) | Python                          | Client; Client CLI; Server |                                                      | OpenAPI 3.2.0                   | [![CI](https://github.com/offscale/cdd-python-all/actions/workflows/ci.yml/badge.svg)](https://github.com/offscale/cdd-python-all/actions/workflows/ci.yml)      | ✅ (48MB)  |
| [`cdd-ruby`](https://github.com/SamuelMarks/cdd-ruby)          | Ruby                            | Client; Client CLI; Server |                                                      | OpenAPI 3.2.0                   | [![CI](https://github.com/SamuelMarks/cdd-ruby/actions/workflows/ci.yml/badge.svg)](https://github.com/SamuelMarks/cdd-ruby/actions/workflows/ci.yml)            | ✅ (51MB)  |
| [`cdd-rust`](https://github.com/SamuelMarks/cdd-rust)          | Rust                            | Client; Client CLI; Server |                                                      | OpenAPI 3.2.0                   | [![CI](https://github.com/offscale/cdd-rust/actions/workflows/ci-cargo.yml/badge.svg)](https://github.com/offscale/cdd-rust/actions/workflows/ci-cargo.yml)      | ✅ (4.8MB) |
| [`cdd-sh`](https://github.com/SamuelMarks/cdd-sh)              | Shell (/bin/sh)                 | Client; Client CLI; Server |                                                      | OpenAPI 3.2.0                   | [![CI](https://github.com/SamuelMarks/cdd-sh/actions/workflows/ci.yml/badge.svg)](https://github.com/SamuelMarks/cdd-sh/actions/workflows/ci.yml)                | ✅ (9.3MB) |
| [`cdd-swift`](https://github.com/SamuelMarks/cdd-swift)        | Swift                           | Client; Client CLI; Server |                                                      | OpenAPI 3.2.0                   | [![Swift](https://github.com/SamuelMarks/cdd-swift/actions/workflows/swift.yml/badge.svg)](https://github.com/SamuelMarks/cdd-swift/actions/workflows/swift.yml) | ✅ (95MB)  |
| [`cdd-ts`](https://github.com/offscale/cdd-ts)                 | TypeScript                      | Client; Client CLI; Server | Auto-Admin UI; Angular; fetch; Axios; Node.js        | OpenAPI 3.2.0 & Swagger 2       | [![Tests and coverage](https://github.com/offscale/cdd-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/offscale/cdd-ts/actions/workflows/ci.yml)      | ✅ (138MB) |

_All 13 of the above implementations successfully compile to WebAssembly and run entirely client-side without any backend server (i.e., CDN-only mode)._

_See `cdd_docs_prompt.md` and `TO_DOCS_JSON.md` in this repository for the system prompts used to unify documentation and CLI interfaces across the entire `cdd-_` ecosystem.\*

---

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or <https://www.apache.org/licenses/LICENSE-2.0>)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or <https://opensource.org/licenses/MIT>)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in the work by you, as defined in the Apache-2.0 license, shall be
dual licensed as above, without any additional terms or conditions.
