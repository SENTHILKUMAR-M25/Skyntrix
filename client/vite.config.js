import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Dev-only proxy target (local backend). The app never uses this URL directly;
// it calls relative /api and /uploads paths which this dev server forwards here.
const DEV_API_TARGET = process.env.DEV_API_TARGET || "http://localhost:5001";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: DEV_API_TARGET,
        changeOrigin: true,
      },
      "/uploads": {
        target: DEV_API_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          animation: ["framer-motion", "gsap"],
        },
      },
    },
  },
});