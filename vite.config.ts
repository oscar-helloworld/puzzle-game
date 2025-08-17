import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  server: { port: 5173 },
  build: { 
    target: "es2020",
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    minify: "esbuild"
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src")
    }
  },
  base: "/"
});
