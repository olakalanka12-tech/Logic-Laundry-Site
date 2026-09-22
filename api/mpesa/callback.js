// Vercel serverless function: receives the M-Pesa STK Push result callback.
// Safaricom POSTs the transaction outcome here. Acknowledge with ResultCode 0.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" })
    return
  }
  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {}
    console.log("[v0] M-Pesa callback received:", JSON.stringify(body))
    // Persist / reconcile the payment here (e.g. update the order in Firestore).
  } catch (err) {
    console.log("[v0] M-Pesa callback parse error:", err.message)
  }
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" })
}
