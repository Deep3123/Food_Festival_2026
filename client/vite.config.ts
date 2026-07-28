import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite dev/build config for the ByteBites client.
 *
 * The API client calls same-origin `/api/...` paths (see src/api/client.ts).
 * In development, those requests are proxied to the Express API so the SPA and
 * the API can run on separate ports without CORS. Point `VITE_API_TARGET` at a
 * different API origin if needed (defaults to http://localhost:3001).
 */
const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
