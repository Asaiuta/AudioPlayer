import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import unocssPlugin from "unocss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [unocssPlugin(), solidPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    target: "esnext",
    sourcemap: true
  }
});
