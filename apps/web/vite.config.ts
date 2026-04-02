import { vitePlugin as reactRouter } from "@react-router/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: "ES2022",
  },
});
