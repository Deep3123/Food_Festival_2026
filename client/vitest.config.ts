import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Client-specific Vitest configuration.
 *
 * The root vitest config excludes `client/**` and `*.tsx`, so the React client
 * owns this config. It runs component tests in a jsdom environment with globals
 * enabled and jest-dom matchers registered via the setup file, matching the
 * `*.test.tsx` files co-located with the client source.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.tsx", "src/**/*.test.ts"],
  },
});
