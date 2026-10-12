import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER_URL = process.env.VITE_SERVER_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Expose on the LAN so phones on the same network can test (mobile-first).
    host: true,
    proxy: {
      "/health": SERVER_URL,
      "/socket.io": { target: SERVER_URL, ws: true },
    },
  },
  build: {
    sourcemap: true,
  },
});
