import { fileURLToPath } from "node:url";

import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  resolve: {
    alias: {
      "@shopify-import/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url)
      ),
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: ["isocratic-gauntly-deane.ngrok-free.dev"],
  },
  build: {
    target: "ES2022",
  },
});
