/**
 * Mock implementation of CddWasmSdk for testing purposes
 */
export const CddWasmSdk = {
  fromOpenApi: (): Promise<{ path: string; content: Uint8Array }[]> => Promise.resolve([]),
};

/**
 * Mock type for Ecosystem for testing purposes
 */
export type Ecosystem = string;
