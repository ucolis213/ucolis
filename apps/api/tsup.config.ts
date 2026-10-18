import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // shared est consommé en TypeScript source : on l'embarque dans le bundle.
  noExternal: ['@ucolis/shared'],
});
