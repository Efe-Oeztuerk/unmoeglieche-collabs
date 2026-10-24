// Gemeinsame Helfer für die Cloudflare-Workers-AI-Aufrufe.
// Dateien mit "_" am Anfang werden von Vercel nicht als eigene Route veröffentlicht.

export class ConfigError extends Error {}

export const TEXT_MODEL = process.env.CF_TEXT_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// input: ein JSON-Objekt oder FormData (für Modelle, die multipart erwarten)
export async function runModel(model, input) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !token) {
    throw new ConfigError("CLOUDFLARE_ACCOUNT_ID oder CLOUDFLARE_API_TOKEN fehlt in den Vercel-Umgebungsvariablen.");
  }
  const isForm = typeof FormData !== "undefined" && input instanceof FormData;
  const headers = { Authorization: `Bearer ${token}` };
  if (!isForm) headers["Content-Type"] = "application/json";
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
    method: "POST",
    headers,
    body: isForm ? input : JSON.stringify(input),
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

export function imageToDataUrl(out) {
  const b64 = out && (out.image || out.images?.[0]);
  if (typeof b64 !== "string" || b64.length < 100) throw new Error("Kein Bild erhalten.");
  if (b64.startsWith("data:")) return b64;
  const mime = b64.startsWith("iVBOR") ? "image/png" : b64.startsWith("UklGR") ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${b64}`;
}

export function fail(res, e) {
  if (e instanceof ConfigError) return res.status(500).json({ error: "missing_config", message: e.message });
  if (e.status === 429) return res.status(429).json({ error: "rate_limited", message: "Das Tageskontingent ist aufgebraucht oder es kamen zu viele Anfragen. Versuch es später noch mal." });
  return res.status(502).json({ error: "upstream", message: e.message || "Die KI hat nicht geantwortet." });
}
