/* Gemeinsame Bausteine: Listen, Helfer, Supabase, lokales Archiv und das Studio (Foto erzeugen + anpassen). */

const SUPABASE_URL = "https://pstornyexmnsfwmahkbs.supabase.co";
// Öffentlicher Publishable Key (darf im Browser stehen, Zugriff regeln die Datenbank-Regeln)
const SUPABASE_KEY = "sb_publishable_ee6Ww8PFLrEPHcaRbDyfIg_h_iRJ0UM";
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const BRANDS = ["Ferrari","Lamborghini","Porsche","Rolls-Royce","Bugatti","Tesla","IKEA","Apple","LEGO","Nike","Adidas","Gucci","Louis Vuitton","Chanel","Prada","Balenciaga","Supreme","Red Bull","Coca-Cola","McDonald's","Haribo","Milka","Nintendo","PlayStation","Dyson","Bosch","Miele","Victorinox","Rolex","NASA","Deutsche Bahn","Lufthansa","Jägermeister","Nutella","Barbie","Caterpillar","John Deere","Harley-Davidson","Moncler","Off-White","Tupperware","Crocs","BMW","Mercedes-AMG","Vespa","Hermès","Bang & Olufsen","Leica","Aston Martin","Ducati","Swarovski","Oakley","The North Face","Stihl","Teenage Engineering"];
const PRODUCTS = ["Heißluftfritteuse","Toaster","Toilettenbürste","Rasenmäher","Kinderwagen","Elektrische Zahnbürste","Bügeleisen","Staubsauger","Gartenzwerg","Regenschirm","Kühlschrank","Hundehütte","Waschmaschine","Mikrowelle","Badelatschen","Brotdose","Wäscheständer","Schubkarre","Mülltonne","Wasserkocher","Thermoskanne","Fahrradhelm","Schneeschaufel","Föhn","Laubbläser","Bürostuhl","Campingstuhl","Pfeffermühle","Kuckucksuhr","Kugelgrill","Eierkocher","Rollator","Schulranzen","Hängematte","Duschkopf","Kaffeemaschine","Kühlbox","Bierkrug","Tischtennisplatte","Standmixer","Picknickkorb","Gießkanne","Zelt","Schreibtischlampe","Babyphone","Saugroboter","Einkaufswagen","Kinderrutsche","Briefkasten","Sauna"];
const CHIPS = [
  ["Andere Farbe", "in einer anderen, markentypischen Farbvariante"],
  ["Von schräg oben", "aus einer Perspektive schräg von oben fotografiert"],
  ["Im Showroom", "im edlen Showroom der Marke statt im Studio"],
  ["Nahaufnahme", "als Nahaufnahme, die Materialien und Details zeigt"],
  ["Weißer Hintergrund", "freigestellt auf reinweißem Studiohintergrund"],
  ["Nacht & Neon", "bei Nacht mit Neonlicht und Spiegelungen"],
  ["Mehr Luxus", "noch luxuriöser, mit edleren Materialien und mehr Details"],
];

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function h(tag, props = {}, kids = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "attrs") for (const [a, av] of Object.entries(v)) e.setAttribute(a, av);
    else if (k === "on") for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
    else e[k] = v;
  }
  for (const k of [].concat(kids)) if (k != null && k !== false) e.append(k);
  return e;
}
function svg(markup) { const s = document.createElement("span"); s.innerHTML = markup; return s.firstElementChild; }
const ICONS = {
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>',
  reshoot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20V9"/><path d="M7 14l5-5 5 5"/><path d="M5 4h14"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-9.2-9A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.2 5c-2.2 4.6-9.2 9-9.2 9z"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>',
};

function pick(list, not) { let v; do { v = list[Math.floor(Math.random() * list.length)]; } while (v === not && list.length > 1); return v; }
function slug(s) { return String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function hueOf(s) { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) % 360; return x; }
function avatar(name, size) {
  const a = h("span", { className: "avatar", textContent: (name || "?").trim().charAt(0).toUpperCase() });
  a.style.background = `hsl(${hueOf(name)} 75% 72%)`;
  if (size) { a.style.width = a.style.height = size + "px"; }
  return a;
}

let toastTimer = null;
function toast(text) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const t = h("div", { className: "toast", textContent: text, attrs: { role: "status" } });
  document.body.append(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2600);
}

async function post(url, data) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(body.message || "Fehler " + r.status); e.code = body.error; throw e; }
  return body;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => resolve(img); img.onerror = reject; img.src = src;
  });
}
async function downscale(src, size, quality = 0.9) {
  const img = await loadImage(src);
  const c = document.createElement("canvas"); c.width = c.height = size;
  const s = Math.min(img.width, img.height);
  c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL("image/jpeg", quality);
}
async function dataUrlToBlob(dataUrl) { return (await fetch(dataUrl)).blob(); }

/* Lichtschein in der Farbe des Fotos */
async function ambientFrom(src) {
  try {
    const img = await loadImage(src);
    const c = document.createElement("canvas"); c.width = c.height = 24;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0, 24, 24);
    const d = x.getImageData(0, 0, 24, 24).data;
    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < d.length; i += 4) {
      const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
      const wt = (mx - mn) / 255 + 0.05;
      r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt;
    }
    r /= w; g /= w; b /= w;
    const k = 220 / (Math.max(r, g, b) || 1);
    document.documentElement.style.setProperty("--glow", `${Math.round(r * k)}, ${Math.round(g * k)}, ${Math.round(b * k)}`);
  } catch {}
}

/* ---------- Lokales Archiv (IndexedDB) ---------- */
let dbp = null;
function idb() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open("kollabs", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function store(mode) { return (await idb()).transaction("entries", mode).objectStore("entries"); }
function req2p(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function normalizeEntry(e) { if (!e.versions) { e.versions = [{ image: e.image, label: "Original" }]; e.active = 0; } return e; }
function currentVersion(e) { return e.versions[e.active] || e.versions[e.versions.length - 1]; }
const archiveListeners = new Set();
async function archiveSave(e) {
  try {
    const copy = JSON.parse(JSON.stringify(e)); if (copy.id == null) delete copy.id;
    e.id = await req2p((await store("readwrite")).put(copy));
    archiveListeners.forEach((fn) => fn());
  } catch {}
}
async function archiveAll() {
  try { return (await req2p((await store("readonly")).getAll())).map(normalizeEntry).sort((a, b) => b.t - a.t); } catch { return []; }
}
async function archiveClear() { try { await req2p((await store("readwrite")).clear()); } catch {} archiveListeners.forEach((fn) => fn()); }

/* ---------- Konto ---------- */
const auth = { user: null, profile: null, listeners: new Set() };
async function refreshAuth() {
  if (!sb) return;
  const { data } = await sb.auth.getSession();
  auth.user = data.session ? data.session.user : null;
  auth.profile = null;
  if (auth.user) {
    const { data: p } = await sb.from("profiles").select("id, username").eq("id", auth.user.id).maybeSingle();
    auth.profile = p || null;
  }
  auth.listeners.forEach((fn) => fn());
}

/* Ein Produkt in die eigene Vitrine hochladen */
async function uploadToShowcase({ image, brand, product, name, slogan }) {
  if (!auth.user) throw new Error("Melde dich im Profil an, um Produkte hochzuladen.");
  let url = image;
  if (image.startsWith("data:")) {
    const small = await downscale(image, 1024, 0.88);
    const path = `${auth.user.id}/${Date.now()}-${slug(brand)}-${slug(product)}.jpg`;
    const { error } = await sb.storage.from("showcase").upload(path, await dataUrlToBlob(small), { contentType: "image/jpeg" });
    if (error) throw new Error("Upload fehlgeschlagen: " + error.message);
    url = sb.storage.from("showcase").getPublicUrl(path).data.publicUrl;
  }
  const { error } = await sb.from("showcase").insert({ image_url: url, brand, product, name, slogan });
  if (error) throw new Error("Speichern fehlgeschlagen: " + error.message);
}

/* ---------- Studio: Foto erzeugen und per Prompt anpassen ---------- */
/*
  createStudio({ mount, specEl, getCombo, limits: { designs, edits } | null, onChange })
  - mount: Element, in das Bühne, Eingabefeld, Vorschläge und Versionen gerendert werden
  - specEl: Element für das Datenblatt
*/
function createStudio(opts) {
  const s = { entry: null, busy: false, designs: 0, edits: 0 };
  const stage = h("div", { className: "stage" });
  const input = h("input", { maxLength: 300, placeholder: "Etwas ändern? z. B. „in Mattschwarz“ oder „auf einer Rennstrecke“", disabled: true });
  const send = h("button", { className: "send", type: "submit", disabled: true, attrs: { "aria-label": "Änderung anwenden" } }, svg(ICONS.send));
  const form = h("form", { className: "panel composer", attrs: { autocomplete: "off" } }, [input, send]);
  const chips = h("div", { className: "chips", attrs: { "aria-label": "Schnelle Änderungen" } });
  const hint = h("p", { className: "hint" });
  const versions = h("div", { className: "versions", hidden: true });
  const notice = h("p", { className: "notice", hidden: true });
  opts.mount.replaceChildren(stage, form, chips, hint, versions, notice);

  CHIPS.forEach(([label, instr]) => chips.append(h("button", { className: "chip", type: "button", textContent: label, disabled: true, on: { click: () => edit(instr, label) } })));
  input.addEventListener("input", controls);
  form.addEventListener("submit", (ev) => { ev.preventDefault(); const t = input.value.trim(); if (t) edit(t); });

  function editsLeft() { return opts.limits ? Math.max(0, opts.limits.edits - s.edits) : Infinity; }
  function designsLeft() { return opts.limits ? Math.max(0, opts.limits.designs - s.designs) : Infinity; }

  function placeholder() {
    stage.replaceChildren(h("div", { className: "placeholder" }, [
      h("div", { className: "floor" }),
      h("strong", { textContent: "Die Bühne ist frei" }),
      h("span", { textContent: "Tipp auf „Entwerfen“. Nach 10 bis 20 Sekunden steht hier dein Produktfoto." }),
    ]));
  }
  function controls() {
    const can = !!s.entry && !s.busy && editsLeft() > 0;
    input.disabled = !can;
    send.disabled = !can || !input.value.trim();
    chips.querySelectorAll(".chip").forEach((c) => (c.disabled = !can));
    if (!s.entry) hint.textContent = "Optional: Nach dem ersten Foto kannst du es hier anpassen.";
    else if (opts.limits && editsLeft() === 0) hint.textContent = "Keine Anpassungen mehr in dieser Runde.";
    else hint.textContent = opts.limits
      ? `Noch ${editsLeft()} Anpassung${editsLeft() === 1 ? "" : "en"} in dieser Runde. Jede wird eine neue Version.`
      : "Schreib, was anders sein soll, oder tipp einen Vorschlag an. Jede Änderung wird eine neue Version.";
    opts.onChange && opts.onChange(api);
  }
  function setBusy(on, msg) {
    s.busy = on;
    const old = stage.querySelector(".busy"); if (old) old.remove();
    if (on) stage.append(h("div", { className: "busy" }, [h("div", { className: "orb" }), h("span", { className: "busy-msg", textContent: msg })]));
    controls();
  }
  function busyMsg(t) { const m = stage.querySelector(".busy-msg"); if (m) m.textContent = t; }
  function showError(e) {
    let text = (e && e.message) || "Da ist etwas schiefgelaufen.";
    if (e && e.code === "missing_config") text = "Die KI ist noch nicht verbunden: In Vercel fehlen CLOUDFLARE_ACCOUNT_ID und CLOUDFLARE_API_TOKEN.";
    notice.textContent = text; notice.hidden = false;
  }

  function render() {
    const e = s.entry;
    if (!e) { placeholder(); versions.hidden = true; renderSpec(); controls(); return; }
    const v = currentVersion(e);
    const tools = h("div", { className: "stage-tools" });
    if (!opts.limits || editsLeft() > 0) {
      tools.append(h("button", { className: "icon-btn", type: "button", title: "Neues Foto vom gleichen Konzept", attrs: { "aria-label": "Neues Foto vom gleichen Konzept" }, on: { click: reshoot } }, svg(ICONS.reshoot)));
    }
    if (auth.user && !opts.limits) {
      tools.append(h("button", { className: "icon-btn", type: "button", title: "In mein Profil hochladen", attrs: { "aria-label": "In mein Profil hochladen" }, on: { click: async () => {
        try { await uploadToShowcase({ image: v.image, brand: e.brand, product: e.product, name: e.name, slogan: e.slogan }); toast("In dein Profil hochgeladen"); }
        catch (err) { toast(err.message); }
      } } }, svg(ICONS.upload)));
    }
    tools.append(h("a", { className: "icon-btn", href: v.image, download: `${slug(e.brand)}-${slug(e.product)}-v${e.active + 1}.jpg`, title: "Bild speichern", attrs: { "aria-label": "Bild speichern" } }, svg(ICONS.download)));
    stage.replaceChildren(
      h("img", { className: "photo", src: v.image, alt: `${e.name}: ${e.product} im Stil von ${e.brand}` }),
      h("span", { className: "badge", textContent: "KI-Entwurf · nicht real" }),
      tools
    );
    ambientFrom(v.image);
    versions.hidden = e.versions.length < 2;
    versions.replaceChildren(...e.versions.map((ver, i) => h("button", {
      className: "ver", type: "button", attrs: { "aria-current": String(i === e.active), title: ver.label },
      on: { click: () => { if (s.busy) return; e.active = i; render(); opts.onSave && opts.onSave(e); } },
    }, [h("img", { src: ver.image, alt: "" }), h("span", { textContent: i === 0 ? "Original" : ver.label })])));
    renderSpec(); controls();
  }
  function renderSpec() {
    if (!opts.specEl) return;
    const e = s.entry;
    const combo = e ? e : opts.getCombo();
    if (!e) {
      opts.specEl.replaceChildren(
        h("div", { className: "head" }, h("span", { className: "collab", textContent: `${combo.brand} × ${combo.product}` })),
        h("p", { className: "empty-note", textContent: "Die KI erfindet Name, Slogan, Preis und Features und fotografiert das Produkt wie für einen echten Launch." })
      );
      return;
    }
    const kids = [h("div", { className: "head" }, [
      h("span", { className: "collab", textContent: `${e.brand} × ${e.product}` }),
      e.price ? h("span", { className: "price", textContent: e.price }) : null,
    ]), h("h2", { textContent: e.name })];
    if (e.slogan) kids.push(h("p", { className: "slogan", textContent: `„${e.slogan}“` }));
    if (e.description) kids.push(h("p", { className: "desc", textContent: e.description }));
    if (e.features && e.features.length) kids.push(h("ul", { className: "features" }, e.features.map((f, i) => h("li", {}, [h("b", { textContent: String(i + 1).padStart(2, "0") }), f]))));
    opts.specEl.replaceChildren(...kids);
  }

  async function design() {
    if (s.busy || designsLeft() <= 0) return;
    const { brand, product } = opts.getCombo();
    notice.hidden = true; setBusy(true, "Konzept wird geschrieben …");
    try {
      const concept = await post("/api/concept", { brand, product });
      busyMsg(`„${concept.name}“ wird fotografiert …`);
      const img = await post("/api/image", { prompt: concept.image_prompt });
      s.designs++;
      s.entry = { ...concept, brand, product, versions: [{ image: img.image, label: "Original" }], active: 0, t: Date.now() };
      s.busy = false; render(); opts.onSave && opts.onSave(s.entry);
    } catch (e) { showError(e); }
    finally { setBusy(false); }
  }
  async function reshoot() {
    const e = s.entry; if (!e || s.busy || editsLeft() <= 0) return;
    notice.hidden = true; setBusy(true, "Neues Foto wird gemacht …");
    try {
      const img = await post("/api/image", { prompt: e.image_prompt });
      s.edits++;
      e.versions.push({ image: img.image, label: "Neues Foto" }); e.active = e.versions.length - 1; e.t = Date.now();
      s.busy = false; render(); opts.onSave && opts.onSave(e);
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  }
  async function edit(instruction, label) {
    const e = s.entry; if (!e || s.busy || !instruction || editsLeft() <= 0) return;
    notice.hidden = true; setBusy(true, "Wird angepasst …");
    try {
      const small = await downscale(currentVersion(e).image, 504);
      const r = await post("/api/edit", { image: small, instruction, brand: e.brand, product: e.product, image_prompt: e.image_prompt });
      s.edits++;
      e.versions.push({ image: r.image, label: label || instruction }); e.active = e.versions.length - 1; e.t = Date.now();
      input.value = "";
      s.busy = false; render(); opts.onSave && opts.onSave(e);
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  }

  const api = {
    design, render,
    get entry() { return s.entry; },
    get busy() { return s.busy; },
    get designsLeft() { return designsLeft(); },
    get editsLeft() { return editsLeft(); },
    setEntry(e) { s.entry = e; render(); },
    reset() { s.entry = null; s.designs = 0; s.edits = 0; notice.hidden = true; input.value = ""; render(); },
    lock(on) { s.locked = on; },
  };
  render();
  auth.listeners.add(() => { if (s.entry) render(); });
  return api;
}
