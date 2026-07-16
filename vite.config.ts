import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";
import { readFileSync } from "fs";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [vue()],

  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },

  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  optimizeDeps: {
    include: [
      "vue",
      "@vue-flow/core",
      "@vue-flow/background",
      "@vue-flow/controls",
      "@vue-flow/minimap",
      "elkjs",
      "element-plus",
      "lucide-vue-next",
    ],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 48732,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 48733,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vue-vendor": [
            "vue",
            "@vue-flow/core",
            "@vue-flow/background",
            "@vue-flow/controls",
            "@vue-flow/minimap",
          ],
          "elk-vendor": ["elkjs"],
          "ui-vendor": ["element-plus"],
          "icons-vendor": ["lucide-vue-next"],
          "tauri-vendor": ["@tauri-apps/api"],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
