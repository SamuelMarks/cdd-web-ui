# CDD Docs UI Expansion Plan

This document outlines the exhaustive plan to transform `cdd-docs-ui` from a minimal stub into a fully-featured, production-ready API documentation generator and viewer. It encompasses Ahead-of-Time (AOT) static generation, a dynamic Web Component, strict accessibility adherence, responsive mobile-first design, comprehensive documentation, and 100% test coverage.

## 1. Project Architecture & Setup (`cdd-docs-ui`)

- [x] **Monorepo / Workspace Alignment**
  - [x] Ensure `cdd-docs-ui` is set up with a modern bundler (e.g., Vite or Webpack) capable of library builds and SSG (Static Site Generation).
  - [x] Configure `package.json` to expose multiple entry points:
    - [x] CLI for AOT generation (`bin` executable).
    - [x] ES Module for the dynamic Web Component (`main`/`module`/`exports`).
    - [x] Vanilla JS/CSS bundle for script tag injection.
- [x] **Core Dependencies**
  - [x] Add OpenAPI parsing and resolving libraries (e.g., `@stoplight/prism-core`, `@apidevtools/swagger-parser`, or custom lightweight parser).
  - [x] Add markdown rendering (e.g., `marked` or `markdown-it`).
  - [x] Add Web Component base library (e.g., `Lit` or vanilla `HTMLElement`) for the dynamic mode.
  - [x] Add templating engine (e.g., `Handlebars`, `EJS`, or `Pug`) or leverage a framework like 11ty/Astro for the AOT static generation.
- [x] **Tooling & CI/CD**
  - [x] Integrate formatting and linting (Prettier, ESLint).
  - [x] Set up CI pipelines for automated testing, build verification, and coverage reporting.

## 2. Core Parsing & Data Normalization

- [x] **OpenAPI Normalizer**
  - [x] Implement an internal data model that normalizes OpenAPI 3.x and 2.0 (Swagger) into a consistent, easily renderable format.
  - [x] Resolve `$ref` references accurately (local and remote).
  - [x] Extract and normalize metadata (Info, Servers).
  - [x] Group operations by Tags.
  - [x] Parse Request Bodies, Parameters (Query, Path, Header, Cookie).
  - [x] Parse Responses, Status Codes, and Schemas.
  - [x] Extract and format Examples and Schemas for rendering.
- [x] **SDK Code Examples Integration**
  - [x] Define a standard payload interface for passing generated SDK files (e.g., `{ language: string, filepath: string, content: string }[]`).
  - [x] Implement logic to map generated SDK files to their corresponding OpenAPI operations (via `operationId` or path/method matching).

## 3. UI/UX Design & Responsive Layout

- [x] **Responsive Architecture (Mobile-First)**
  - [x] **Mobile Breakpoint (< 768px):** Single-column layout. Sidebar becomes a modal/off-canvas drawer with a hamburger menu toggle. Code examples stack below schemas.
  - [x] **Tablet Breakpoint (768px - 1024px):** Two-column layout. Sidebar is visible, but code pane is integrated into the main flow or accessible via tabs.
  - [x] **Desktop Breakpoint (> 1024px):** Three-column layout (Sidebar, Main Content, Code Pane).
  - [x] Implement fluid typography that scales with viewport size.
  - [x] Ensure all touch targets (buttons, links, dropdowns) are at least 44x44px to meet iOS/WCAG mobile standards.
  - [x] Protect against horizontal scrolling issues on mobile (especially for `<pre>` code blocks and large tables).
- [x] **Theming Engine**
  - [x] Implement CSS Variables (`--var`) for all colors, typography, and spacing.
  - [x] Create default Light and Dark themes.
  - [x] Support custom theme overrides via CSS variable injection.
  - [x] Respect user system preferences (`@media (prefers-color-scheme)`).

## 4. Accessibility (A11y) Features

- [x] **Keyboard Navigation & Focus Management**
  - [x] Ensure all interactive elements are reachable via `Tab` key.
  - [x] Implement visible focus rings for all interactive elements.
  - [x] Implement focus trapping for modals (e.g., mobile sidebar, dialogs).
  - [x] Add keyboard support for custom components (e.g., Arrow keys for tabs, `Escape` to close drawers, `Enter`/`Space` to toggle accordions).
  - [x] Include "Skip to main content" links for screen reader and keyboard users.
- [x] **Screen Reader Support (ARIA)**
  - [x] Use semantic HTML5 elements (`<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`).
  - [x] Apply `aria-expanded` and `aria-controls` to collapsible schema sections and dropdowns.
  - [x] Apply `aria-live="polite"` to regions that update dynamically (e.g., search results, loading states, dynamic SDK file loading).
  - [x] Ensure all buttons and icons have accessible labels (e.g., `aria-label` or visually hidden text).
- [x] **Visual Accessibility**
  - [x] Audit and guarantee WCAG 2.1 AA (and preferably AAA) color contrast ratios across both Light and Dark themes.
  - [x] Support Windows High Contrast Mode / forced-colors media queries.
  - [x] Respect `@media (prefers-reduced-motion)` by disabling or minimizing CSS transitions and animations when requested.

## 5. Ahead-of-Time (AOT) Static Generation (No-JS Mode)

- [x] **CLI Implementation (`cdd-docs-cli`)**
  - [x] Create a Node.js CLI script that accepts an OpenAPI file path and an optional directory of SDK code examples.
- [x] **HTML/CSS Generation**
  - [x] Implement a templating system that iterates through the normalized API data and generates pure HTML.
  - [x] Inline critical CSS or emit a single `style.css` file.
  - [x] Ensure all layout features (3-column, responsive) work purely with CSS (e.g., using flexbox/grid, media queries).
  - [x] Implement CSS-only interactivity (e.g., using `<details>` and `<summary>` for schema expansion, CSS `:target` or radio-button hacks for tabs/drawers).
- [x] **AOT Accessibility & SEO**
  - [x] Generate proper `<meta>` tags, canonical URLs, and `<title>` based on the OpenAPI info object.
  - [x] Ensure CSS-only interactive elements (like `<details>`) are inherently accessible without JS.

## 6. Fully Dynamic Mode (Web Component)

- [x] **Web Component Implementation (`<cdd-api-docs>`)**
  - [x] Create a custom element (e.g., using `Lit` or standard `HTMLElement`).
  - [x] Define properties/attributes: `spec-url`, `spec-content` (stringified JSON/YAML), `theme` (light/dark).
  - [x] Implement a setter for dynamically injecting SDK examples.
- [x] **Dynamic Interactivity**
  - [x] Implement client-side fuzzy search/filtering in the navigation.
  - [x] Implement interactive language tabs in the Code Examples pane.
  - [x] Implement smooth scrolling and `IntersectionObserver` to highlight the active operation in the sidebar as the user scrolls.
- [x] **Framework Wrappers (Optional but Recommended)**
  - [x] Generate an Angular wrapper/directive for seamless two-way binding.
  - [x] Generate a React wrapper (handling custom events and props).
  - [x] Generate a Vue component wrapper.

## 7. Integration with `cdd-web-ui`

- [x] **Dependency Update**
  - [x] Update `cdd-web-ui` to consume the new `cdd-docs-ui` Web Component package instead of the stubbed iframe.
- [x] **Angular Component Refactoring (`ApiDocsViewerComponent`)**
  - [x] Remove the `<iframe>` implementation.
  - [x] Register the custom element (`<cdd-api-docs>`) in Angular (using `CUSTOM_ELEMENTS_SCHEMA`).
  - [x] Bind `selectOpenApiSpecContent` directly to the web component's `spec-content` property.
  - [x] Bind theme signals to the web component's `theme` property.
- [x] **SDK Examples Sync**
  - [x] Create an effect or service in `cdd-web-ui` that listens to `FileTreeState` (`selectGeneratedFiles`).
  - [x] Whenever files are generated, format them and pass them down to the `<cdd-api-docs>` component.

## 8. Full Documentation Coverage

- [x] **Code-Level Documentation**
  - [x] Add JSDoc/TSDoc comments to 100% of exported functions, classes, interfaces, and types.
  - [x] Configure `compodoc` or `TypeDoc` to generate developer API documentation automatically.
- [x] **Component Documentation (Storybook)**
  - [x] Set up Storybook to document the isolated UI components (Buttons, Tabs, Schema Viewers, Sidebar).
  - [x] Create stories for different states (loading, error, empty, deeply nested schemas, light/dark themes, various viewports).
- [x] **User & Integration Guides**
  - [x] Write a comprehensive `README.md` covering installation, usage, and CLI flags.
  - [x] Create specific integration guides for Angular, React, Vue, and Vanilla JS.
  - [x] Create an architecture decision record (ADR) detailing the hybrid AOT/Dynamic approach.

## 9. Full Test Coverage (Target: 100%)

- [x] **Unit Tests (Vitest/Jest)**
  - [x] Test 100% of the OpenAPI parser, normalizer, and utility functions.
  - [x] Test edge cases for `$ref` resolution (circular references, invalid paths).
  - [x] Test AOT CLI argument parsing and file I/O mocking.
- [x] **Component/Integration Tests**
  - [x] Test the Web Component lifecycle (mounting, updating `spec-content`, theme changes).
  - [x] Test DOM emissions and reactivity (e.g., clicking a tab changes the visible code block).
- [x] **End-to-End (E2E) Tests (Playwright)**
  - [x] Verify core user journeys: Searching for an endpoint, expanding a schema, toggling SDK tabs, copying code.
  - [x] **Responsive Tests:** Emulate mobile devices (e.g., iPhone 12) to ensure the hamburger menu works and layout stacks correctly. Emulate tablet and desktop layouts.
  - [x] Verify integration within `cdd-web-ui` (OpenAPI edits reflect in the viewer).
- [x] **Visual Regression Testing**
  - [x] Implement Playwright visual comparisons (screenshots) for critical components in both Light and Dark modes.
- [x] **Accessibility (A11y) Testing**
  - [x] Integrate `axe-core` into Playwright to automatically audit all views for WCAG compliance during E2E runs.
- [x] **Mutation Testing**
  - [x] Set up Stryker Mutator (or similar) to test the robustness of the test suite itself, ensuring tests actually catch logic changes.