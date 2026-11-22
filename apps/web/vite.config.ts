import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const fromRoot = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));

// Workspace packages are consumed as source (their package.json `exports` point at src/index.ts),
// so there is no build step between packages. The aliases mirror tsconfig.base.json `paths`.
export default defineConfig({
  // VITE_BASE is set when the app is served from a sub-path (GitHub Pages: /Pro-Studio-/).
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@pro-studio/shared': fromRoot('packages/shared/src/index.ts'),
      '@pro-studio/engine': fromRoot('packages/engine/src/index.ts'),
      '@pro-studio/ui/styles': fromRoot('packages/ui/src/styles'),
      '@pro-studio/ui': fromRoot('packages/ui/src/index.ts'),
    },
  },
  // module workers, so the export worker can import the engine like any other module
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
});
