import { runModel, readBody, cleanText, fail, ConfigError, TEXT_MODEL } from "./_cf.js";

const SYSTEM = `You are the creative director of a high-end industrial design studio.
A brand is releasing a product that has nothing to do with its usual business. Treat it completely seriously, like a real luxury collaboration launch, and push the brand's design language as far as it goes: signature materials, colours, shapes, details, finishes and attitude.

Reply with ONLY one JSON object, no other text:
{
  "name": "product name, max 4 words",
  "slogan": "German advertising slogan, max 9 words",
  "description": "German, 2 short sentences: what it looks like and what makes it special",
  "features": ["3 German features, max 7 words each"],
  "price": "German price string, e.g. \\"2.490 €\\"",
  "image_prompt": "English prompt for a photorealistic product photo, 60-110 words"
}

Rules for the German texts: be genuinely funny and specific. The slogan is a clever pun that mixes the brand's famous attitude or claim with what the product does (good: "Von 0 auf knusprig in 2,9 Sekunden." for a Ferrari air fryer; bad: generic lines like "Klein aber fein" or "Qualität, die begeistert"). The name sounds like a real model name of that brand. Features name concrete, brand-typical technology applied absurdly to the product (good: "Launch Control für Pommes"). Write natural German with correct umlauts.

Rules for image_prompt: professional commercial product photography of the single product, clearly recognisable as the product type, fully designed in the brand's style (name the concrete materials, colours, design cues and the brand emblem placement). Describe a fitting premium setting (studio sweep or a brand-typical showroom), lighting (softbox, rim light, reflections), camera (85mm, shallow depth of field), "ultra realistic, 8k, sharp focus". One product only, no people, no text overlays.`;

function parseJson(text) {
  if (text && typeof text === "object") return text;
  if (typeof text !== "string") return null;
  try { return JSON.parse(text); } catch {}
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch {} }
  return null;
}

function fallbackConcept(brand, product) {
  return {
    name: `${brand} ${product}`,
    slogan: "",
    description: "",
    features: [],
    price: "",
    image_prompt: `Professional commercial product photography of a ${product} designed by ${brand}, fully in ${brand}'s signature design language, materials, colours and emblem, premium studio sweep background, softbox lighting with rim light and subtle reflections, 85mm lens, shallow depth of field, ultra realistic, 8k, sharp focus, single product, no people, no text`,
    fallback: true,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method", message: "Nur POST." });
  const body = readBody(req);
  const brand = cleanText(body.brand, 60);
  const product = cleanText(body.product, 60);
  if (!brand || !product) return res.status(400).json({ error: "input", message: "Marke und Produkt fehlen." });

  try {
    const out = await runModel(TEXT_MODEL, {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Brand: ${brand}\nProduct: ${product}` },
      ],
      max_tokens: 700,
      temperature: 0.9,
    });
    const d = parseJson(out.response ?? out);
    if (!d || typeof d.image_prompt !== "string") return res.status(200).json(fallbackConcept(brand, product));
    return res.status(200).json({
      name: cleanText(d.name, 60) || `${brand} ${product}`,
      slogan: cleanText(d.slogan, 120),
      description: cleanText(d.description, 400),
      features: Array.isArray(d.features) ? d.features.slice(0, 3).map((f) => cleanText(String(f), 80)).filter(Boolean) : [],
      price: cleanText(d.price, 30),
      image_prompt: cleanText(d.image_prompt, 1800),
    });
  } catch (e) {
    if (e instanceof ConfigError || e.status === 429) return fail(res, e);
    // Textmodell nicht erreichbar: trotzdem ein Bild ermöglichen
    return res.status(200).json(fallbackConcept(brand, product));
  }
}
