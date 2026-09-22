import { defineConfig } from "vite"
import { resolve } from "node:path"

// Multi-page static site. `index.html` is the default entry served at "/",
// with the admin and rider pages exposed as additional build inputs.
export default defineConfig({
  root: ".",
  server: {
    host: true,
    port: 3000,
    allowedHosts: true
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html"),
        rider: resolve(__dirname, "rider.html"),
      },
    },
  },
})
