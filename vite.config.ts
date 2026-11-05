import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Binding to 0.0.0.0 (host: true) is what makes this reachable from other
// devices on your Tailscale network. Ports are one above transmission-ui's
// (5173/4173) so both UIs can run side by side on the same box.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5174,
  },
  preview: {
    host: true,
    port: 4174,
  },
});
