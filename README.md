<!-- prettier-ignore -->
cdd-web-ui
==========

![Doc Coverage](https://img.shields.io/badge/Doc_Coverage-100%25-brightgreen.svg)
![Test Coverage](https://img.shields.io/badge/Test_Coverage-100%25-brightgreen.svg)

[![License](https://img.shields.io/badge/license-Apache--2.0%20OR%20MIT-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**CDD Web UI** is the central graphical interface for the Compiler Driven Development (CDD) ecosystem.

Compiler Driven Development is a methodology of rapid application development that focuses on producing _more_ code, not less. Rather than relying on a general-purpose language, DSL, or "generated DO NOT TOUCH" directories, CDD generates idiomatic native code (e.g., Python `class`es, SQL `CREATE TABLE`s, Rust `struct`s) directly into your workspace.

This repository coordinates all known CDD implementations (`cdd-python`, `cdd-rust`, `cdd-typescript`, etc.) into a cohesive, offline-first web interface powered by WebAssembly (WASM).

## Features

### Offline-First Architecture

The entire application runs fully offline inside your browser. It utilizes standard browser APIs (`localStorage`) to persist your data locally.

- **Data Model:** Aligns seamlessly with the GitHub API schema (`User` -> `Organization` -> `Repository`) in preparation for future online synchronization and 'Login with GitHub' capabilities.
- **WASM Powered:** Code generation logic is intended to be executed natively in the browser via WebAssembly, removing the need for cloud backends or external APIs. _Currently implemented with static WASM generation stubs._

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

| Repository                                                           | Language   | Status          | OpenAPI Standard          |
| -------------------------------------------------------------------- | ---------- | --------------- | ------------------------- |
| [`cdd-python-client`](https://github.com/offscale/cdd-python-client) | Python     | Client          | OpenAPI 3.2.0             |
| [`cdd-rust`](https://github.com/SamuelMarks/cdd-rust)                | Rust       | Client & Server | OpenAPI 3.2.0             |
| [`cdd-web-ng`](https://github.com/offscale/cdd-web-ng)               | TypeScript | Client          | OpenAPI 3.2.0 & Swagger 2 |
| ... and many more.                                                   |            |                 |                           |

_See `cdd_docs_prompt.md` and `TO_DOCS_JSON.md` in this repository for the system prompts used to unify documentation and CLI interfaces across the entire `cdd-_` ecosystem.\*
