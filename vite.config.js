import { defineConfig, loadEnv } from "vite"
import { resolve } from "node:path"
import { mpesaPlugin } from "./vite-plugin-mpesa.js"

// Multi-page static site. `index.html` is the default entry served at "/",
// with the admin and rider pages exposed as additional build inputs.
export default defineConfig(({ mode }) => {
  // Load ALL env vars (empty prefix) from .env files and mirror any that are
  // missing into process.env so the M-Pesa dev middleware can read `key`/`secret`.
  const env = loadEnv(mode, process.cwd(), "")
  for (const k of Object.keys(env)) {
    if (process.env[k] === undefined) process.env[k] = env[k]
  }

  return {
    root: ".",
    plugins: [mpesaPlugin()],
    server: {
      host: true,
      port: 3000,
      allowedHosts: true,
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
  }
})
