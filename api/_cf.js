// Gemeinsame Helfer für die Cloudflare-Workers-AI-Aufrufe.
// Dateien mit "_" am Anfang werden von Vercel nicht als eigene Route veröffentlicht.

export class ConfigError extends Error {}

export async function runModel(model, input) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) {
    throw new ConfigError("CLOUDFLARE_ACCOUNT_ID oder CLOUDFLARE_API_TOKEN fehlt in den Vercel-Umgebungsvariablen.");
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.success === false) {
    const msg = (body.errors && body.errors[0] && body.errors[0].message) || `HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  return body.result ?? body;
}

export function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
}

export function cleanText(v, max) {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}

export function fail(res, e) {
  if (e instanceof ConfigError) return res.status(500).json({ error: "missing_config", message: e.message });
  if (e.status === 429) return res.status(429).json({ error: "rate_limited", message: "Das Tageskontingent ist aufgebraucht oder es kamen zu viele Anfragen. Versuch es später noch mal." });
  return res.status(502).json({ error: "upstream", message: e.message || "Die KI hat nicht geantwortet." });
}
