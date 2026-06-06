import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.js', 'tests/**/*.test.ts'],
    // tsx handles TypeScript resolution transparently
    server: {
      deps: {
        inline: [/xlsx/, /@nexus\/schema/],
      },
    },
  },
});
