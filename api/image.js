import { runModel, readBody, cleanText, fail, imageToDataUrl } from "./_cf.js";

const IMAGE_MODEL = process.env.CF_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method", message: "Nur POST." });
  const body = readBody(req);
  const prompt = cleanText(body.prompt, 2000);
  if (!prompt) return res.status(400).json({ error: "input", message: "Bildbeschreibung fehlt." });

  try {
    const out = await runModel(IMAGE_MODEL, { prompt, steps: 6 });
    return res.status(200).json({ image: imageToDataUrl(out) });
  } catch (e) {
    return fail(res, e);
  }
}
