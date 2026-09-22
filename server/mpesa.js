// Shared M-Pesa Daraja (STK Push / Lipa na M-Pesa Online) logic.
// Used by both the Vite dev-server middleware (preview) and the Vercel
// serverless functions in /api (production). Keeps the consumer secret,
// OAuth token, and STK password strictly server-side.

// Well-known Safaricom sandbox test passkey. Override in production via env.
const SANDBOX_PASSKEY =
  "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"

function getConfig() {
  const env = (process.env.MPESA_ENV || "sandbox").toLowerCase()
  const base =
    env === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke"

  return {
    env,
    base,
    consumerKey: process.env.key,
    consumerSecret: process.env.secret,
    // Sandbox test paybill defaults; override for a real till/paybill.
    shortcode: process.env.MPESA_SHORTCODE || "174379",
    passkey: process.env.MPESA_PASSKEY || SANDBOX_PASSKEY,
    // Safaricom must be able to reach this in production. In sandbox/preview
    // the callback simply may not arrive, but the STK prompt still shows.
    callbackUrl:
      process.env.MPESA_CALLBACK_URL ||
      "https://example.com/api/mpesa/callback",
  }
}

// Normalize a Kenyan number to the 2547XXXXXXXX / 2541XXXXXXXX MSISDN format.
export function normalizePhone(input) {
  let p = String(input || "").replace(/\D/g, "")
  if (p.startsWith("0")) p = "254" + p.slice(1)
  else if (p.startsWith("254")) {
    // already in MSISDN form
  } else if (p.startsWith("7") || p.startsWith("1")) p = "254" + p
  return p
}

function timestamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, "0")
  return (
    `${d.getFullYear()}` +
    `${pad(d.getMonth() + 1)}` +
    `${pad(d.getDate())}` +
    `${pad(d.getHours())}` +
    `${pad(d.getMinutes())}` +
    `${pad(d.getSeconds())}`
  )
}

// Fetch a short-lived OAuth access token using the consumer key/secret.
export async function getAccessToken() {
  const { base, consumerKey, consumerSecret } = getConfig()
  if (!consumerKey || !consumerSecret) {
    throw new Error(
      "M-Pesa is not configured: missing consumer key/secret env vars.",
    )
  }
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
    "base64",
  )
  const res = await fetch(
    `${base}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Could not authenticate with Safaricom (${res.status}). ` +
        `Check your consumer key/secret.`,
    )
  }
  return data.access_token
}

// Trigger an STK Push (M-Pesa Express) to the customer's phone.
export async function initiateSTKPush({
  phone,
  amount,
  accountReference = "LogicLaundry",
  description = "Laundry payment",
} = {}) {
  const cfg = getConfig()

  const msisdn = normalizePhone(phone)
  if (!/^254(7|1)\d{8}$/.test(msisdn)) {
    throw new Error("Invalid phone number. Use a Safaricom number like 07XXXXXXXX.")
  }

  const amt = Math.round(Number(amount))
  if (!Number.isFinite(amt) || amt < 1) {
    throw new Error("Invalid amount. Enter a whole number of KSH (min 1).")
  }

  const token = await getAccessToken()
  const ts = timestamp()
  const password = Buffer.from(
    `${cfg.shortcode}${cfg.passkey}${ts}`,
  ).toString("base64")

  const payload = {
    BusinessShortCode: cfg.shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: amt,
    PartyA: msisdn,
    PartyB: cfg.shortcode,
    PhoneNumber: msisdn,
    CallBackURL: cfg.callbackUrl,
    AccountReference: String(accountReference).slice(0, 12) || "LogicLaundry",
    TransactionDesc: String(description).slice(0, 13) || "Payment",
  }

  const res = await fetch(`${cfg.base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      data.errorMessage || `STK push request failed (${res.status}).`,
    )
  }
  return data
}

// Query the status of a previously initiated STK Push. Used by the client to
// poll for a completed (or failed) payment when no public callback URL is
// reachable (e.g. in the preview/sandbox).
export async function querySTKStatus({ checkoutRequestId } = {}) {
  const cfg = getConfig()
  if (!checkoutRequestId) {
    throw new Error("Missing checkoutRequestId.")
  }

  const token = await getAccessToken()
  const ts = timestamp()
  const password = Buffer.from(
    `${cfg.shortcode}${cfg.passkey}${ts}`,
  ).toString("base64")

  const res = await fetch(`${cfg.base}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: cfg.shortcode,
      Password: password,
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    }),
  })
  const data = await res.json().catch(() => ({}))
  // While the customer hasn't acted yet Safaricom returns a 500 with
  // errorCode 500.001.1001 ("transaction is being processed"). Surface that
  // as a "pending" state rather than an error so the client can keep polling.
  if (!res.ok) {
    if (data.errorCode === "500.001.1001") {
      return { pending: true, ResultCode: null, ResultDesc: "Processing" }
    }
    throw new Error(
      data.errorMessage || `STK query failed (${res.status}).`,
    )
  }
  return data
}
