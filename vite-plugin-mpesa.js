// Vite dev-server plugin that exposes the M-Pesa API routes during preview,
// mirroring the Vercel serverless functions in /api. This lets the STK Push
// flow work in the v0 preview without a separate backend process.
import { initiateSTKPush, querySTKStatus } from "./server/mpesa.js"

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.on("data", (chunk) => (body += chunk))
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on("error", reject)
  })
}

function sendJson(res, status, data) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(data))
}

export function mpesaPlugin() {
  return {
    name: "mpesa-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next()
        const path = req.url.split("?")[0]

        if (path === "/api/mpesa/stkpush") {
          if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" })
          try {
            const body = await readJson(req)
            const data = await initiateSTKPush(body)
            return sendJson(res, 200, data)
          } catch (err) {
            return sendJson(res, 400, { error: err.message })
          }
        }

        if (path === "/api/mpesa/stkquery") {
          if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" })
          try {
            const body = await readJson(req)
            const data = await querySTKStatus(body)
            return sendJson(res, 200, data)
          } catch (err) {
            return sendJson(res, 400, { error: err.message })
          }
        }

        if (path === "/api/mpesa/callback") {
          if (req.method !== "POST") return sendJson(res, 405, { error: "Method not allowed" })
          const body = await readJson(req).catch(() => ({}))
          console.log("[v0] M-Pesa callback received:", JSON.stringify(body))
          return sendJson(res, 200, { ResultCode: 0, ResultDesc: "Accepted" })
        }

        next()
      })
    },
  }
}
