# CDD Web UI - Gemini Instructions

## Building & Deploying to GitHub Pages (`offscale.github.io`)

When instructed to build and deploy the CDD Web UI to the `offscale.github.io` repository, you MUST follow this exact procedure:

1. **Build the App:**
   When building for GitHub Pages, you must use the correct base href so paths resolve correctly:
   `npx ng build --configuration production --base-href /cdd-web-ui/`

2. **Copy the Output (Crucial step):**
   Angular 17+ produces build outputs inside a nested `browser` folder when using the application builder.
   You must copy the contents of `dist/cdd-web-ui/browser/*` into the target `cdd-web-ui` directory in the `offscale.github.io` repo.
   **DO NOT** copy the `browser/` folder itself, only its contents.

   _Example copy command:_

   ```bash
   d="/Users/samuel/repos/offscale.github.io/cdd-web-ui" && rm -rf "$d"/* && cp -r dist/cdd-web-ui/browser/* "$d/"
   ```

3. **Remove WASM Binaries:**
   Never commit WASM binaries to `offscale.github.io`. They cause git history bloat and frequently trigger GitHub's file size limits (100MB).
   After copying the build output, immediately delete the `assets/wasm` folder in the target repo:
   ```bash
   rm -rf /Users/samuel/repos/offscale.github.io/cdd-web-ui/assets/wasm
   ```

## Angular & TypeScript Best Practices

You MUST follow these rules when writing or modifying code in this project:

### TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

### Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images. (Note: `NgOptimizedImage` does not work for inline base64 images.)

### Accessibility & i18n Requirements

- Implement standard i18n best practices as required.
- Code MUST pass all AXE checks.
- Code MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

### State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

### Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

### Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection
