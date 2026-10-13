import { defineConfig } from 'vitest/config';

// Live carrier smoke tests (real network, real keys from .env.local). Cross-platform: no env-var prefix.
export default defineConfig({ test: { include: ['tests/live/**/*.test.ts'], environment: 'node' } });
