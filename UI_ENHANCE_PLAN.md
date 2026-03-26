# UI Enhancement Plan: Embedded API Documentation (Exhaustive)

This document outlines an exhaustive, production-ready checklist of features, edge cases, and architectural tasks required to robustly embed `cdd-docs-ui` as a preview pane below the main editor workspace.

## 1. Architecture & State Management

- [x] **Core State (NgRx)**
  - [x] Add `isApiDocsVisible` (boolean) to the core `AppState`.
  - [x] Add `apiDocsPaneHeight` (number) to track user-preferred vertical split size (default: 300px).
  - [x] Add `apiDocsLoadState` (enum: 'IDLE', 'LOADING', 'LOADED', 'ERROR').
- [x] **State Actions**
  - [x] `[Workspace] Toggle API Docs Pane`
  - [x] `[Workspace] Set API Docs Visibility (visible: boolean)`
  - [x] `[Workspace] Resize Bottom Pane (height: number)`
  - [x] `[ApiDocs] Iframe Loaded Successfully`
  - [x] `[ApiDocs] Iframe Load Failed (error: string)`
- [x] **State Selectors**
  - [x] `selectIsApiDocsVisible`
  - [x] `selectApiDocsPaneHeight`
  - [x] `selectApiDocsLoadState`
- [x] **Persistence & Routing**
  - [x] Sync `isApiDocsVisible` to `localStorage` (so the layout survives page refreshes).
  - [x] Sync `apiDocsPaneHeight` to `localStorage`.
  - [ ] (Optional) Bind pane visibility to a URL query parameter (e.g., `?preview=docs`).

## 2. Environment & Build Integration

- [x] **Development Proxy Configuration**
  - [x] Create/Update `proxy.conf.json` to proxy `/docs-ui` requests to the local `cdd-docs-ui` dev server (e.g., `http://localhost:420x`) during local development.
- [x] **Production Assets Strategy**
  - [x] Determine distribution strategy: if `cdd-docs-ui` is built separately, ensure CI/CD scripts copy its output to `dist/cdd-web-ui/browser/docs-ui`.
  - [x] Alternatively, configure `angular.json` assets array to map `../cdd-docs-ui/dist` to `/docs-ui` if within the same monorepo.
- [x] **Environment Variables**
  - [x] Add `docsUiBaseUrl` to `src/environments/environment.ts` (`/docs-ui/index.html`).

## 3. Component Implementation (`ApiDocsViewerComponent`)

- [x] **Scaffolding**
  - [x] Generate `ApiDocsViewerComponent` (standalone).
  - [x] Implement `ChangeDetectionStrategy.OnPush`.
- [x] **Iframe Integration**
  - [x] Embed `<iframe>` using Angular's `DomSanitizer.bypassSecurityTrustResourceUrl()`.
  - [x] Set iframe attributes: `width="100%"`, `height="100%"`, `frameborder="0"`.
  - [x] Add performance attributes: `loading="lazy"`.
- [x] **Lifecycle & Error Handling**
  - [x] Bind iframe `(load)` event to dispatch `[ApiDocs] Iframe Loaded Successfully`.
  - [x] Implement a timeout mechanism: if `(load)` doesn't fire within 10s, dispatch `[ApiDocs] Iframe Load Failed`.
- [x] **UI Polish & States**
  - [x] **Loading State:** Display a skeleton loader or `mat-spinner` overlay while `apiDocsLoadState === 'LOADING'`.
  - [x] **Error State:** Display a user-friendly error message with a "Retry" button if the iframe fails to load.
  - [x] **Header Bar:** Add a thin header inside the pane (e.g., "API Docs Preview").
  - [x] Add a "Pop Out" button (`mat-icon-button` with `open_in_new`) to open the docs in a separate browser tab.
  - [x] Add a "Close" button to dismiss the pane.

## 4. Layout Updates & Resizing Mechanics

- [x] **Workspace Container Refactor**
  - [x] Refactor `workspace-content` to use CSS Flexbox/Grid for a vertical split (Top: Editors, Bottom: Docs).
  - [x] Wrap existing layout (`app-split-pane`) in a `.top-pane` container (`flex-grow: 1`).
  - [x] Wrap `app-api-docs-viewer` in a `.bottom-pane` container, bound to `*ngIf="isApiDocsVisible()"`.
- [x] **Custom Vertical Resizer**
  - [x] Create a horizontal divider (`.vertical-resizer`) between top and bottom panes.
  - [x] Style with `cursor: row-resize`, hover effects, and active/dragging states.
  - [x] Implement drag logic using RxJS `fromEvent` for `mousedown`, `mousemove`, `mouseup` on the `document` to smoothly update `apiDocsPaneHeight`.
  - [x] Enforce min/max constraints (e.g., minimum height 150px, maximum 80% of viewport).
  - [x] Add double-click handler on the resizer to snap the pane back to its default height (e.g., 300px).
- [x] **Animations & Transitions**
  - [x] Use Angular Animations (`@angular/animations`) to slide the bottom pane up/down smoothly when toggling visibility.
- [x] **Responsive Design (Mobile)**
  - [x] Hide the split resizer on small screens.
  - [x] On mobile, display the docs pane as a full-screen overlay (modal/bottom sheet) rather than a docked pane.

## 5. Cross-Frame Communication (`DocsSyncService`)

- [x] **Service Setup**
  - [x] Create an injectable `DocsSyncService`.
  - [x] Listen to `window.addEventListener('message')` to receive events from `cdd-docs-ui`.
- [x] **Handshake Protocol**
  - [x] Wait for a `{ type: 'DOCS_UI_READY' }` message from the iframe before sending any payload.
  - [x] Queue updates if the spec changes before the iframe is ready.
- [x] **One-Way Sync (Editor -> Docs)**
  - [x] Subscribe to `selectOpenApiSpecContent` from the NgRx store.
  - [x] Apply debounce (e.g., 500ms) to prevent freezing the iframe while the user types continuously.
  - [x] Send `{ type: 'UPDATE_SPEC', payload: rawSpecString }` via `postMessage`.
  - [x] Skip sending if the OpenAPI spec has syntax/validation errors (`selectOpenApiValidationErrors`).
- [x] **Theme Synchronization**
  - [x] Subscribe to the application's active theme (dark/light mode).
  - [x] Send `{ type: 'SET_THEME', payload: 'dark' | 'light' }` to the iframe so the docs instantly match the editor's aesthetic.
- [x] **Advanced Features (Optional/Stretch)**
  - [ ] **Scroll Sync:** If the user clicks an operation path in Monaco, send a `SCROLL_TO_OPERATION` message to the docs.
  - [ ] **Two-Way Sync:** Listen for `{ type: 'TRY_IT_OUT_EXECUTED' }` from the docs iframe to log metrics or show toasts in the main app.

## 6. Toolbar & UX Enhancements

- [x] **Toolbar Controls**
  - [x] Add a "Docs Preview" toggle button to the main toolbar in `WorkspaceComponent` (using an icon like `menu_book` or `preview`).
  - [x] Apply `color="accent"` or active CSS classes when the pane is visible.
- [x] **Keyboard Accessibility**
  - [x] Global shortcut: `Ctrl+Shift+D` / `Cmd+Shift+D` to toggle docs visibility.
  - [x] Make the `.vertical-resizer` focusable (`tabindex="0"`) and controllable via Arrow Up / Arrow Down keys for screen reader / keyboard-only users.
- [x] **Aria/Accessibility**
  - [x] Ensure iframe has a descriptive `title` attribute (`title="API Documentation Preview"`).
  - [x] Use `aria-expanded` and `aria-controls` on the toggle button linking it to the bottom pane ID.

## 7. Security & Performance Verification

- [x] **Content Security Policy (CSP)**
  - [ ] Ensure `frame-src` or `child-src` CSP directives allow the local/production URLs of `cdd-docs-ui`.
  - [x] Add `sandbox="allow-scripts allow-same-origin allow-popups"` to the iframe to strictly control its capabilities while allowing it to function.
- [x] **Memory Management**
  - [x] Ensure `DocsSyncService` subscriptions and `window` message event listeners are properly torn down/destroyed if the component is unmounted.
  - [x] Handle potential memory bloat from continuous rapid `postMessage` calls of large spec files.

## 8. User Information & Contextual Messaging

- [x] **Docs UI Footprint Disclaimer**
  - [x] Add an info tooltip or a small footer banner within the `ApiDocsViewerComponent` header.
  - [x] Display the following clear messaging: _"Note: While this studio environment requires several megabytes to run locally, the rendered API documentation (`cdd-docs-ui`) is highly optimized (under 100KB) and functions entirely without JavaScript."_
- [x] **Online/Offline Language Support Clarification**
  - [x] Update the `LanguageSelectorComponent` to provide clearer guidance on disabled languages.
  - [x] Add a persistent help icon or an informational banner near the language dropdown with the following text: _"Languages shown as disabled are not available in the current offline-only environment. To enable generation for all supported languages, configure the application for 'Online Mode' by following the backend setup instructions on our GitHub repository."_
  - [x] Update individual disabled option tooltips to reinforce this message and direct the user to the GitHub documentation.

## 9. Comprehensive Testing

- [x] **Unit Tests**
  - [x] `DocsSyncService`: Test handshake logic, message debouncing, and store subscriptions (using RxJS Marbles or spy setups).
  - [x] NgRx: Test all new actions, reducers, and selectors.
- [x] **Component Tests**
  - [x] `ApiDocsViewerComponent`: Mock `DomSanitizer`, simulate iframe `load` event, verify loading/error state transitions.
  - [x] `SplitPane` / Layout: Simulate dragging events on the resizer and verify height boundary clamping.
- [x] **E2E Tests (Playwright)**
  - [x] Assert clicking the "Docs Preview" button opens the bottom pane.
  - [x] Assert the vertical resizer drag action changes the height of the `.bottom-pane`.
  - [ ] Assert that typing in the Monaco editor eventually updates the iframe (mocking `postMessage` listener or checking inner frame DOM if same-origin).
  - [x] Assert the keyboard shortcut (`Ctrl+Shift+D`) works.
