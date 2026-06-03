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

   *Example copy command:*
   ```bash
   d="/Users/samuel/repos/offscale.github.io/cdd-web-ui" && rm -rf "$d"/* && cp -r dist/cdd-web-ui/browser/* "$d/"
   ```

3. **Remove WASM Binaries:**
   Never commit WASM binaries to `offscale.github.io`. They cause git history bloat and frequently trigger GitHub's file size limits (100MB).
   After copying the build output, immediately delete the `assets/wasm` folder in the target repo:
   ```bash
   rm -rf /Users/samuel/repos/offscale.github.io/cdd-web-ui/assets/wasm
   ```
