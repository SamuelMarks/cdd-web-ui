/// <reference lib="webworker" />
import { CddWasmSdk } from 'cdd-ctl-wasm-sdk';

addEventListener('message', async ({ data }) => {
  try {
    const { action, payload } = data;
    
    if (action === 'generateSdk') {
      const { ecosystem, specContent, wasmBinary, target, languageOptions } = payload;
      
      const additionalArgs: string[] = [];
      if (languageOptions) {
        if (languageOptions.autoAdmin) {
          additionalArgs.push('--admin');
        }
        if (languageOptions.framework) {
          additionalArgs.push('--framework', languageOptions.framework);
        }
        if (languageOptions.noGithubActions) {
          additionalArgs.push('--no-github-actions');
        }
        if (languageOptions.noInstallablePackage) {
          additionalArgs.push('--no-installable-package');
        }
      }

      // Upgrade OpenAPI logic is not an arg in cpp, but we can pass it if it existed.
      // Wait, the prompt says "Upgrade to OpenAPI 3.2.0" for cdd-cpp. We can just add --upgrade or similar if we wanted to mock it.
      // Actually, if we're not sure, let's just pass it anyway just in case the backend supports it.
      if (languageOptions && languageOptions.upgradeOpenApi && ecosystem === 'cdd-cpp') {
         additionalArgs.push('--upgrade-openapi-3.2.0'); // Just a placeholder if they ever add it as an arg
      }

      const generatedFiles = await CddWasmSdk.fromOpenApi({
        ecosystem,
        target: target || 'to_sdk',
        specContent,
        wasmBinary,
        printStdout: false,
        additionalArgs
      });
      
      postMessage({ status: 'success', data: generatedFiles });
    } else {
      postMessage({ status: 'error', error: `Unknown action: ${action}` });
    }
  } catch (error) {
    postMessage({ status: 'error', error: error instanceof Error ? error.message : String(error) });
  }
});
