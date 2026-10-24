import { runModel, readBody, cleanText, fail } from "./_cf.js";

const IMAGE_MODEL = process.env.CF_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method", message: "Nur POST." });
  const body = readBody(req);
  const prompt = cleanText(body.prompt, 2000);
  if (!prompt) return res.status(400).json({ error: "input", message: "Bildbeschreibung fehlt." });

  try {
    const out = await runModel(IMAGE_MODEL, { prompt, steps: 6 });
    const b64 = out.image;
    if (typeof b64 !== "string" || b64.length < 100) throw new Error("Kein Bild erhalten.");
    const mime = b64.startsWith("iVBOR") ? "image/png" : "image/jpeg";
    return res.status(200).json({ image: `data:${mime};base64,${b64}` });
  } catch (e) {
    return fail(res, e);
  }
}
