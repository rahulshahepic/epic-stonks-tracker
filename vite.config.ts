/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

function getCommitHash(): string {
  if (process.env.COMMIT_HASH) return process.env.COMMIT_HASH;
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

const commitHash = getCommitHash();

/** Replaces __COMMIT_HASH__ in the copied public/sw.js after build. */
function swVersionPlugin() {
  return {
    name: 'sw-version',
    writeBundle() {
      const swPath = resolve(__dirname, 'dist/sw.js');
      try {
        const content = readFileSync(swPath, 'utf-8');
        writeFileSync(swPath, content.replace(/__COMMIT_HASH__/g, commitHash));
      } catch {
        // sw.js may not exist during test runs
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), swVersionPlugin()],
  base: '/epic-stonks-tracker/',
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/version.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
