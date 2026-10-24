import { runModel, readBody, cleanText, fail, imageToDataUrl, TEXT_MODEL, ConfigError } from "./_cf.js";

// FLUX.2 Klein kann ein Referenzbild (input_image_0) gezielt verändern.
const EDIT_MODEL = process.env.CF_EDIT_MODEL || "@cf/black-forest-labs/flux-2-klein-4b";

const EDIT_SYSTEM = `You turn a user's requested change into ONE instruction for an image-editing model.
The model receives the current product photo as image 0.
Rules:
- Start with "Edit image 0:".
- Describe the requested change precisely and concretely in English (the user may write German).
- Then say to keep everything else unchanged (the product, its shape and brand details, camera angle, background, lighting and photorealism), except what the change explicitly asks for.
- Keep it under 90 words. Reply with only the instruction, nothing else.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method", message: "Nur POST." });
  const body = readBody(req);
  const instruction = cleanText(body.instruction, 300);
  const brand = cleanText(body.brand, 60);
  const product = cleanText(body.product, 60);
  const original = cleanText(body.image_prompt, 1200);
  const image = typeof body.image === "string" ? body.image : "";
  const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!instruction) return res.status(400).json({ error: "input", message: "Schreib kurz, was geändert werden soll." });
  if (!m || m[2].length > 1_500_000) return res.status(400).json({ error: "input", message: "Das Ausgangsbild fehlt oder ist zu groß." });

  // 1. Wunsch in eine präzise englische Bearbeitungsanweisung übersetzen
  let prompt = `Edit image 0: ${instruction}. Keep the product, its brand details, camera angle, background, lighting and photorealism otherwise unchanged.`;
  try {
    const out = await runModel(TEXT_MODEL, {
      messages: [
        { role: "system", content: EDIT_SYSTEM },
        { role: "user", content: `Product: a ${product} designed by ${brand}.\nHow the current photo was described: ${original}\nRequested change: ${instruction}` },
      ],
      max_tokens: 220,
      temperature: 0.3,
    });
    const text = typeof out.response === "string" ? out.response.trim() : "";
    if (text.length > 20) prompt = text.replace(/^["']|["']$/g, "").slice(0, 1500);
  } catch (e) {
    if (e instanceof ConfigError || e.status === 429) return fail(res, e);
  }

  // 2. Bild mit Referenz bearbeiten
  try {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", "1024");
    form.append("height", "1024");
    form.append("input_image_0", new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), "input.jpg");
    const out = await runModel(EDIT_MODEL, form);
    return res.status(200).json({ image: imageToDataUrl(out) });
  } catch (e) {
    return fail(res, e);
  }
}
