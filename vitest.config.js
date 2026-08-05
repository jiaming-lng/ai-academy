import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['js/logger.js', 'js/icons.js', 'js/config/**/*.js'],
    },
  },
});
