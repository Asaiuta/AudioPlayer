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
    sourcemap: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks: {
          solid: ["solid-js"],
          tauri: [
            "@tauri-apps/api/core",
            "@tauri-apps/api/dpi",
            "@tauri-apps/api/event",
            "@tauri-apps/api/image",
            "@tauri-apps/api/window"
          ]
        }
      }
    }
  }
});
