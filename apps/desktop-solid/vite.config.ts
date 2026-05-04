import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import unocssPlugin from "unocss/vite";
import path from "node:path";

// PR1 — desktop-solid runs on a different port than the React app (5173)
// so both can boot in parallel during the migration. Tauri integration
// keeps pointing at apps/desktop/ until the PR6 cutover.
export default defineConfig({
  plugins: [unocssPlugin(), solidPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  server: {
    port: 5174,
    strictPort: true
  },
  build: {
    target: "esnext",
    sourcemap: true
  }
});
