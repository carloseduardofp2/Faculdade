import { defineConfig } from "vite";

export default defineConfig({
  publicDir: "static",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
