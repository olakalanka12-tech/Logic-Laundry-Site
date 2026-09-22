// Vercel serverless function: initiates an M-Pesa STK Push in production.
import { initiateSTKPush } from "../../server/mpesa.js"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}
    const data = await initiateSTKPush(body)
    res.status(200).json(data)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
}
