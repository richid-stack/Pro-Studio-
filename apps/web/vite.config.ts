import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const fromRoot = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));

// Workspace packages are consumed as source (their package.json `exports` point at src/index.ts),
// so there is no build step between packages. The aliases mirror tsconfig.base.json `paths`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@forge/shared': fromRoot('packages/shared/src/index.ts'),
      '@forge/ui/styles': fromRoot('packages/ui/src/styles'),
      '@forge/ui': fromRoot('packages/ui/src/index.ts'),
    },
  },
  build: { target: 'es2022', sourcemap: true },
});
