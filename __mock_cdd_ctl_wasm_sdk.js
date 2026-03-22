export class CddWasmSdk {
  static async fromOpenApi(options) {
    if (options.ecosystem === 'cdd-go' || options.ecosystem === 'go') {
      return [];
    }
    if (options.ecosystem === 'cdd-python' && options.specContent === 'success-spec') {
      return [
        {
          path: 'success.py',
          content: new TextEncoder().encode('Generated content for success'),
        },
      ];
    }
    throw new Error('WASM error');
  }
}
