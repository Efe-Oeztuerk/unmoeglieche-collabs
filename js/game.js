/* Mehrspieler: Lobby, Runden, Bewertung, Ergebnis */
(function () {
  const root = $("gameRoot");
  const SESSION_KEY = "kollabs-game";
  const NAME_KEY = "kollabs-name";
  const ERRORS = {
    game_not_found: "Kein Spiel mit diesem Code gefunden.",
    game_started: "Dieses Spiel läuft schon, Beitreten geht nur in der Lobby.",
    game_full: "Die Lobby ist voll.",
    name_required: "Gib einen Spitznamen ein.",
    need_two_players: "Ihr braucht mindestens 2 Spieler.",
    not_host: "Nur der Host kann das.",
    round_over: "Die Runde ist schon vorbei.",
    not_in_game: "Du bist nicht mehr in diesem Spiel.",
    own_submission: "Deinen eigenen Beitrag kannst du nicht bewerten.",
  };

  let session = readSession();
  let st = null;              // letzter Zustand vom Server
  let offset = 0;             // Serverzeit - lokale Zeit
  let phaseKey = null;
  let pollTimer = null, tickTimer = null;
  let ui = {};                // Elemente/Daten der aktuellen Phase

  function readSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } }
  function saveSession(s) { session = s; try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch {} }
  function savedName() { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } }
  function rememberName(n) { try { localStorage.setItem(NAME_KEY, n); } catch {} }
  function errText(error) {
    const m = String((error && error.message) || error || "");
    const key = Object.keys(ERRORS).find((k) => m.includes(k));
    return key ? ERRORS[key] : "Da ist etwas schiefgelaufen. Versuch es noch mal.";
  }
  async function rpc(fn, args) {
    if (!sb) throw new Error("Keine Verbindung zum Spielserver.");
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(errText(error));
    return data;
  }
  function auth3() { return { p_code: session.code, p_player: session.player_id, p_secret: session.secret }; }
  function remaining() { return st && st.game.phase_ends_at ? Math.max(0, Math.round((new Date(st.game.phase_ends_at) - (Date.now() + offset)) / 1000)) : null; }
  function fmt(sec) { return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; }
  function seg(values, current, label, onPick) {
    const wrap = h("div", { className: "seg", attrs: { role: "group", "aria-label": label } });
    values.forEach((v) => wrap.append(h("button", { type: "button", textContent: typeof v === "number" && label === "Zeit pro Runde" ? fmt(v) : String(v), attrs: { "aria-pressed": String(v === current) }, on: { click: () => {
      wrap.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", "false"));
      wrap.querySelector(`button:nth-child(${values.indexOf(v) + 1})`).setAttribute("aria-pressed", "true");
      onPick(v);
    } } })));
    return wrap;
  }

  /* ---------- Startseite ---------- */
  function renderHome(prefillCode, message) {
    stopPolling(); phaseKey = "home";
    const settings = { rounds: 5, seconds: 120, max: 8, edits: 3 };
    const defaultName = savedName() || (auth.profile && auth.profile.username) || "";
    const createName = h("input", { className: "field", id: "createName", maxLength: 20, placeholder: "Dein Spitzname", value: defaultName, autocomplete: "nickname" });
    const joinName = h("input", { className: "field", id: "joinName", maxLength: 20, placeholder: "Dein Spitzname", value: defaultName, autocomplete: "nickname" });
    const joinCode = h("input", { className: "field code-input", id: "joinCode", maxLength: 5, placeholder: "CODE", value: prefillCode || "", autocomplete: "off" });
    const createMsg = h("p", { className: "notice", hidden: true });
    const joinMsg = h("p", { className: "notice", hidden: !message, textContent: message || "" });

    const createBtn = h("button", { className: "btn primary", type: "submit" }, [svg(ICONS.spark), "Lobby erstellen"]);
    const joinBtn = h("button", { className: "btn primary", type: "submit" }, "Beitreten");

    const createForm = h("form", { className: "panel game-card", on: { submit: async (ev) => {
      ev.preventDefault(); createMsg.hidden = true;
      const name = createName.value.trim(); if (!name) { createMsg.textContent = ERRORS.name_required; createMsg.hidden = false; return; }
      rememberName(name); createBtn.disabled = true;
      const used = new Set(); const combos = [];
      while (combos.length < settings.rounds) {
        const c = { brand: pick(BRANDS), product: pick(PRODUCTS) };
        if (!used.has(c.brand) && !used.has(c.product)) { used.add(c.brand); used.add(c.product); combos.push(c); }
      }
      try {
        const r = await rpc("create_game", { p_name: name, p_rounds: settings.rounds, p_seconds: settings.seconds, p_max: settings.max, p_edit_limit: settings.edits, p_combos: combos });
        saveSession(r); startPolling();
      } catch (e) { createMsg.textContent = e.message; createMsg.hidden = false; }
      finally { createBtn.disabled = false; }
    } } }, [
      h("h2", { textContent: "Spiel erstellen" }),
      h("label", { className: "field-label" }, ["Spitzname", createName]),
      h("div", { className: "field-label" }, ["Runden", seg([3, 5, 7, 10], settings.rounds, "Runden", (v) => (settings.rounds = v))]),
      h("div", { className: "field-label" }, ["Zeit pro Runde", seg([60, 90, 120, 180], settings.seconds, "Zeit pro Runde", (v) => (settings.seconds = v))]),
      h("div", { className: "field-label" }, ["Max. Spieler", seg([2, 4, 6, 8, 10, 12], settings.max, "Max. Spieler", (v) => (settings.max = v))]),
      h("div", { className: "field-label" }, ["Anpassungen pro Runde", seg([1, 2, 3], settings.edits, "Anpassungen pro Runde", (v) => (settings.edits = v))]),
      createMsg, h("div", { className: "row" }, createBtn),
    ]);

    const joinForm = h("form", { className: "panel game-card", on: { submit: async (ev) => {
      ev.preventDefault(); joinMsg.hidden = true;
      const name = joinName.value.trim(), code = joinCode.value.trim().toUpperCase();
      if (!name) { joinMsg.textContent = ERRORS.name_required; joinMsg.hidden = false; return; }
      if (code.length !== 5) { joinMsg.textContent = "Der Code hat 5 Zeichen."; joinMsg.hidden = false; return; }
      rememberName(name); joinBtn.disabled = true;
      try { const r = await rpc("join_game", { p_code: code, p_name: name }); saveSession(r); startPolling(); }
      catch (e) { joinMsg.textContent = e.message; joinMsg.hidden = false; }
      finally { joinBtn.disabled = false; }
    } } }, [
      h("h2", { textContent: "Beitreten" }),
      h("label", { className: "field-label" }, ["Lobby-Code", joinCode]),
      h("label", { className: "field-label" }, ["Spitzname", joinName]),
      joinMsg, h("div", { className: "row" }, joinBtn),
      h("p", { className: "muted small", textContent: "Den Code bekommst du vom Host. Ein Konto brauchst du zum Spielen nicht." }),
    ]);

    root.replaceChildren(h("div", { className: "wrap game-home" }, [
      h("div", { className: "game-hero" }, [
        h("span", { className: "label", textContent: "Mehrspieler · 2 bis 12 Leute" }),
        h("h1", { className: "h-display", textContent: "Wer baut den besten Unsinn?" }),
        h("p", { className: "muted", textContent: "Jede Runde bekommen alle dieselbe Marke und dasselbe Produkt. Jeder lässt seine Version entwerfen und feilt per Prompt nach. Am Ende bewertet ihr alles anonym von 1 bis 10." }),
      ]),
      createForm, joinForm,
      h("div", { className: "how" }, [
        h("div", {}, [h("b", { textContent: "01 Lobby" }), h("span", { textContent: "Host erstellt, Freunde treten per Code bei." })]),
        h("div", {}, [h("b", { textContent: "02 Runden" }), h("span", { textContent: "Gleiche Kombi für alle, 1 Entwurf plus Anpassungen." })]),
        h("div", {}, [h("b", { textContent: "03 Bewertung" }), h("span", { textContent: "Alle Beiträge anonym, Punkte von 1 bis 10." })]),
        h("div", {}, [h("b", { textContent: "04 Siegerehrung" }), h("span", { textContent: "Podium, Rangliste und Lieblinge speichern." })]),
      ]),
    ]));
    if (prefillCode) joinName.focus();
  }

  /* ---------- Polling ---------- */
  function startPolling() {
    stopPolling();
    poll();
    pollTimer = setInterval(poll, 1500);
    tickTimer = setInterval(tick, 250);
  }
  function stopPolling() { clearInterval(pollTimer); clearInterval(tickTimer); pollTimer = tickTimer = null; }
  let polling = false;
  async function poll() {
    if (!session || polling) return;
    polling = true;
    try {
      const s = await rpc("get_state", auth3());
      offset = new Date(s.now) - Date.now();
      st = s; update();
    } catch (e) {
      if (String(e.message).includes(ERRORS.not_in_game)) { saveSession(null); renderHome("", ERRORS.not_in_game); }
    } finally { polling = false; }
  }
  function tick() {
    const r = remaining();
    document.querySelectorAll("[data-timer]").forEach((el) => { el.textContent = r == null ? "–" : fmt(r); el.classList.toggle("low", r != null && r <= 15); });
    // Kurz vor Schluss automatisch abgeben, wenn ein Foto da ist
    if (st && st.game.status === "playing" && ui.studio && ui.studio.entry && !ui.submitted && !ui.submitting && r != null && r <= 5) submit(true);
  }

  function update() {
    const g = st.game;
    const key = g.status === "playing" ? `playing-${g.current_round}` : g.status;
    if (key !== phaseKey) {
      phaseKey = key; ui = {};
      if (g.status === "lobby") renderLobby();
      else if (g.status === "playing") renderRound();
      else if (g.status === "voting") renderVoting();
      else renderResults();
    }
    refresh();
    tick();
  }
  function refresh() {
    if (ui.refresh) ui.refresh();
  }

  function leaveButton() {
    let armed = false;
    const b = h("button", { className: "linkish", type: "button", textContent: "Spiel verlassen" });
    b.addEventListener("click", () => {
      if (!armed) { armed = true; b.textContent = "Wirklich verlassen?"; setTimeout(() => { armed = false; b.textContent = "Spiel verlassen"; }, 3500); return; }
      saveSession(null); st = null; renderHome();
    });
    return b;
  }

  /* ---------- Lobby ---------- */
  function renderLobby() {
    const g = st.game;
    const link = `${location.origin}${location.pathname}?code=${g.code}#spielen`;
    const list = h("ul", { className: "player-list" });
    const startBtn = h("button", { className: "btn primary", type: "button" }, [svg(ICONS.spark), "Spiel starten"]);
    const msg = h("p", { className: "notice", hidden: true });
    const count = h("span", { className: "pill" });
    startBtn.addEventListener("click", async () => {
      startBtn.disabled = true; msg.hidden = true;
      try { await rpc("start_game", auth3()); poll(); } catch (e) { msg.textContent = e.message; msg.hidden = false; startBtn.disabled = false; }
    });
    const copy = h("button", { className: "btn small", type: "button", textContent: "Einladungslink kopieren" });
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(link); toast("Link kopiert"); }
      catch { toast(link); }
    });
    root.replaceChildren(h("div", { className: "wrap lobby" }, [
      h("section", { className: "panel lobby-code" }, [
        h("span", { className: "label", textContent: "Lobby-Code" }),
        h("div", { className: "big-code", textContent: g.code }),
        h("p", { className: "muted", textContent: "Schick den Code oder den Link an deine Freunde. Sobald alle drin sind, startet der Host." }),
        h("div", { className: "row" }, [copy]),
        h("div", { className: "row" }, [
          h("span", { className: "pill", textContent: `${g.rounds} Runden` }),
          h("span", { className: "pill", textContent: `${fmt(g.round_seconds)} pro Runde` }),
          h("span", { className: "pill", textContent: `${g.edit_limit} Anpassungen` }),
        ]),
      ]),
      h("section", { className: "panel players" }, [
        h("div", { className: "row" }, [h("h2", { className: "h-display", textContent: "Spieler", style: "font-size:24px" }), h("span", { className: "spacer" }), count]),
        list, msg,
        h("div", { className: "row", id: "lobbyActions" }),
        h("div", { className: "row" }, [leaveButton()]),
      ]),
    ]));
    ui.refresh = () => {
      list.replaceChildren(...st.players.map((p) => h("li", { className: p.online ? "" : "offline" }, [
        avatar(p.name), h("span", { textContent: p.name + (p.id === st.me.id ? " (du)" : "") }),
        h("span", { className: "tag", textContent: p.is_host ? "Host" : p.online ? "bereit" : "offline" }),
      ])));
      count.textContent = `${st.players.length} / ${st.game.max_players}`;
      const actions = $("lobbyActions");
      if (st.game.is_host) {
        startBtn.disabled = st.players.length < 2;
        actions.replaceChildren(startBtn, h("span", { className: "muted small", textContent: st.players.length < 2 ? "Warte auf mindestens einen Mitspieler …" : "Alle da? Dann los!" }));
      } else {
        actions.replaceChildren(h("span", { className: "pill live", textContent: "Warte auf den Host …" }));
      }
    };
  }

  /* ---------- Runde ---------- */
  function renderRound() {
    const g = st.game, r = st.round;
    const studioMount = h("div", { className: "studio" });
    const specEl = h("section", { className: "panel spec" });
    const status = h("p", { className: "muted" });
    const limits = h("div", { className: "limits" });
    const designBtn = h("button", { className: "btn primary", type: "button" }, [svg(ICONS.spark), "Entwerfen"]);
    const submitBtn = h("button", { className: "btn", type: "button", textContent: "Abgeben" });
    const mini = h("div", { className: "mini-players" });
    const msg = h("p", { className: "notice", hidden: true });

    root.replaceChildren(h("div", { className: "wrap" }, [
      h("div", { className: "panel round-bar" }, [
        h("span", { className: "pill", textContent: `Runde ${r.no} / ${g.rounds}` }),
        h("span", { className: "combo" }, [r.brand, h("em", { textContent: "×" }), r.product]),
        h("span", { className: "spacer" }),
        h("span", { className: "timer", attrs: { "data-timer": "" }, textContent: "–" }),
      ]),
      h("div", { className: "round-grid" }, [
        h("div", { className: "round-side" }, [
          h("section", { className: "panel submit-box" }, [status, limits, h("div", { className: "actions" }, [designBtn, submitBtn]), msg, mini, h("div", { className: "row" }, [leaveButton()])]),
          specEl,
        ]),
        studioMount,
      ]),
    ]));

    ui.submitted = !!st.my_submission;
    ui.studio = createStudio({
      mount: studioMount, specEl,
      getCombo: () => ({ brand: r.brand, product: r.product }),
      limits: { designs: 1, edits: g.edit_limit },
      onSave: () => { ui.dirty = true; },
      onChange: () => paint(),
    });
    designBtn.addEventListener("click", () => ui.studio.design());
    submitBtn.addEventListener("click", () => submit(false));

    function paint() {
      const s = ui.studio; if (!s) return;
      designBtn.disabled = s.busy || s.designsLeft <= 0;
      submitBtn.disabled = s.busy || !s.entry || ui.submitting;
      submitBtn.textContent = ui.submitting ? "Wird abgegeben …" : ui.submitted && !ui.dirty ? "Abgegeben ✓" : ui.submitted ? "Neue Version abgeben" : "Abgeben";
      submitBtn.className = ui.submitted && !ui.dirty ? "btn" : s.entry ? "btn primary" : "btn";
      if (s.entry) designBtn.className = "btn";
      limits.replaceChildren(
        h("span", { className: "pill", textContent: `Entwurf: ${s.designsLeft > 0 ? "frei" : "genutzt"}` }),
        h("span", { className: "pill", textContent: `Anpassungen übrig: ${s.editsLeft}` }),
      );
      status.textContent = !s.entry
        ? `Alle bauen gerade: ${r.brand} × ${r.product}. Tipp auf „Entwerfen“.`
        : ui.submitted
          ? "Abgegeben. Du kannst bis zum Ende der Runde noch nachbessern und neu abgeben."
          : "Zufrieden? Dann gib die angezeigte Version ab. Kurz vor Schluss wird sie automatisch abgegeben.";
    }
    ui.paint = paint;
    ui.msg = msg;
    ui.refresh = () => {
      if (st.my_submission && !ui.submitted) { ui.submitted = true; }
      const done = st.players.filter((p) => p.submitted).length;
      mini.replaceChildren(h("span", { textContent: `${done} / ${st.players.length} abgegeben` }), ...st.players.map((p) => h("span", { className: p.submitted ? "ok" : "", textContent: (p.submitted ? "✓ " : "") + p.name })));
      paint();
    };
  }

  async function submit(auto) {
    const s = ui.studio; if (!s || !s.entry || ui.submitting || s.busy) return;
    const e = s.entry, v = currentVersion(e);
    ui.submitting = true; ui.paint && ui.paint(); if (ui.msg) ui.msg.hidden = true;
    try {
      const small = await downscale(v.image, 768, 0.86);
      const path = `${session.code}/r${st.game.current_round}-${session.player_id}-${Date.now()}.jpg`;
      const { error } = await sb.storage.from("game-images").upload(path, await dataUrlToBlob(small), { contentType: "image/jpeg" });
      if (error) throw new Error("Upload fehlgeschlagen: " + error.message);
      const url = sb.storage.from("game-images").getPublicUrl(path).data.publicUrl;
      await rpc("submit_entry", { ...auth3(), p_image_url: url, p_name: e.name || "", p_slogan: e.slogan || "" });
      ui.submitted = true; ui.dirty = false;
      toast(auto ? "Automatisch abgegeben" : "Abgegeben");
      poll();
    } catch (err) {
      if (ui.msg) { ui.msg.textContent = err.message; ui.msg.hidden = false; }
    } finally { ui.submitting = false; ui.paint && ui.paint(); }
  }

  /* ---------- Bewertung ---------- */
  function renderVoting() {
    const wrap = h("div", { className: "wrap vote-wrap" });
    root.replaceChildren(wrap);
    ui.scores = {};      // lokal abgegebene Punkte
    ui.current = null;
    function items() { return (st.ballot || []).filter((b) => !b.mine); }
    function scoreOf(b) { return ui.scores[b.id] ?? b.my_score; }
    function next() { return items().find((b) => scoreOf(b) == null); }

    function draw() {
      const list = items();
      const b = next();
      const dots = h("div", { className: "dots" }, list.map((x) => h("i", { className: x === b ? "now" : scoreOf(x) != null ? "done" : "" })));
      const head = h("div", { className: "row" }, [
        h("span", { className: "pill", textContent: "Bewertungsrunde" }),
        h("span", { className: "spacer" }),
        h("span", { className: "timer", attrs: { "data-timer": "" }, textContent: "–" }),
      ]);
      if (!b) {
        ui.current = "done";
        const prog = st.voting_progress || { done_players: 0 };
        const kids = [head, h("section", { className: "panel submit-box center" }, [
          h("h2", { className: "h-display", textContent: list.length ? "Alles bewertet!" : "Nichts zu bewerten", style: "font-size:30px" }),
          h("p", { className: "muted", textContent: `${prog.done_players} von ${st.players.length} Spielern sind fertig. Gleich gibt es die Siegerehrung.` }),
        ]), dots];
        if (st.game.is_host) {
          const endBtn = h("button", { className: "btn", type: "button", textContent: "Abstimmung jetzt beenden" });
          endBtn.addEventListener("click", async () => { endBtn.disabled = true; try { await rpc("end_voting", auth3()); poll(); } catch (e) { toast(e.message); endBtn.disabled = false; } });
          kids.push(h("div", { className: "row", style: "justify-content:center" }, endBtn));
        }
        wrap.replaceChildren(...kids);
        return;
      }
      ui.current = b.id;
      const scores = h("div", { className: "scores", attrs: { role: "group", "aria-label": "Punkte von 1 bis 10" } });
      for (let n = 1; n <= 10; n++) {
        scores.append(h("button", { type: "button", textContent: String(n), attrs: { "aria-label": `${n} Punkte` }, on: { click: async () => {
          ui.scores[b.id] = n; draw();
          try { await rpc("cast_vote", { ...auth3(), p_submission: b.id, p_score: n }); }
          catch (e) { delete ui.scores[b.id]; toast(e.message); draw(); }
        } } }));
      }
      const img = h("img", { src: b.image_url, alt: `${b.name || b.product}, ${b.product} im Stil von ${b.brand}` });
      wrap.replaceChildren(
        head,
        h("article", { className: "panel vote-card" }, [img, h("div", { className: "vote-body" }, [
          h("span", { className: "collab", textContent: `Runde ${b.round_no} · ${b.brand} × ${b.product}` }),
          h("h2", { className: "h-display", textContent: b.name || "Ohne Namen", style: "font-size:28px" }),
          b.slogan ? h("p", { className: "slogan", textContent: `„${b.slogan}“` }) : null,
          scores,
          h("div", { className: "scale-labels" }, [h("span", { textContent: "1 · naja" }), h("span", { textContent: "10 · genial" })]),
        ])]),
        dots,
        h("p", { className: "muted small center", textContent: "Wer was gemacht hat, siehst du erst bei der Siegerehrung. Deine eigenen Beiträge werden übersprungen." })
      );
      ambientFrom(b.image_url);
    }
    ui.refresh = () => {
      const b = next();
      const want = b ? b.id : "done";
      if (want !== ui.current || want === "done") draw();
    };
    draw();
  }

  /* ---------- Ergebnis ---------- */
  function renderResults() {
    const res = st.results || { ranking: [], entries: [] };
    const rk = res.ranking;
    const podium = h("div", { className: "podium" });
    [[1, "p2"], [0, "p1"], [2, "p3"]].forEach(([i, cls]) => {
      const p = rk[i];
      podium.append(h("div", { className: `place ${cls}` }, p ? [
        avatar(p.name, 48), h("span", { className: "who", textContent: p.name }), h("span", { className: "pts", textContent: `${p.total} Punkte` }),
        h("div", { className: "block", textContent: String(i + 1) }),
      ] : [h("div", { className: "block", textContent: String(i + 1), style: "opacity:.25" })]));
    });
    const ranking = h("ol", { className: "ranking" }, rk.map((p) => h("li", { className: p.id === st.me.id ? "me" : "" }, [
      h("span", { textContent: p.name + (p.id === st.me.id ? " (du)" : "") }),
      h("span", { className: "score", textContent: `${p.total} P · ${p.entries} Beitr.` }),
    ])));

    const rounds = {};
    res.entries.forEach((e) => { (rounds[e.round_no] = rounds[e.round_no] || []).push(e); });
    const galleries = Object.keys(rounds).sort((a, b) => a - b).map((no) => {
      const list = rounds[no];
      return h("section", { className: "gallery-round" }, [
        h("h3", { textContent: `Runde ${no}: ${list[0].brand} × ${list[0].product}` }),
        h("div", { className: "gallery" }, list.map((e) => entryCard(e))),
      ]);
    });

    const again = h("button", { className: "btn primary", type: "button" }, [svg(ICONS.spark), "Neues Spiel"]);
    again.addEventListener("click", () => { saveSession(null); st = null; renderHome(); });
    root.replaceChildren(h("div", { className: "wrap results" }, [
      h("div", { className: "game-hero center", style: "justify-items:center" }, [
        h("span", { className: "label", textContent: "Siegerehrung" }),
        h("h1", { className: "h-display", textContent: rk[0] ? `${rk[0].name} gewinnt!` : "Spiel vorbei", style: "font-size:clamp(34px,5vw,60px)" }),
      ]),
      podium, ranking, ...galleries,
      h("div", { className: "row", style: "justify-content:center" }, again),
    ]));
    if (rk[0]) { const top = res.entries.find((e) => e.author === rk[0].name); if (top) ambientFrom(top.image_url); }
    ui.refresh = null;
    stopPolling();
  }

  function entryCard(e) {
    const save = h("button", { className: "btn small", type: "button" }, [svg(ICONS.heart), "Merken"]);
    save.addEventListener("click", async () => {
      await archiveSave({ brand: e.brand, product: e.product, name: e.name, slogan: e.slogan, image_prompt: "", versions: [{ image: e.image_url, label: "Original" }], active: 0, t: Date.now(), fromGame: true, author: e.author });
      save.disabled = true; save.lastChild.textContent = "Gemerkt"; toast("Im Archiv gespeichert");
    });
    const prof = h("button", { className: "btn small", type: "button" }, [svg(ICONS.upload), "Ins Profil"]);
    prof.addEventListener("click", async () => {
      if (!auth.user) { toast("Melde dich im Profil an, um Produkte hochzuladen."); return; }
      prof.disabled = true;
      try { await uploadToShowcase({ image: e.image_url, brand: e.brand, product: e.product, name: e.name, slogan: e.slogan }); prof.lastChild.textContent = "Hochgeladen"; toast("In dein Profil hochgeladen"); }
      catch (err) { toast(err.message); prof.disabled = false; }
    });
    return h("article", { className: "panel entry" }, [
      h("img", { src: e.image_url, alt: `${e.name || e.product} von ${e.author}`, loading: "lazy" }),
      h("div", { className: "body" }, [
        h("div", { className: "meta" }, [h("span", { textContent: e.author + (e.mine ? " (du)" : "") }), h("b", { textContent: e.avg != null ? `Ø ${e.avg} · ${e.votes} Stimmen` : "keine Stimmen" })]),
        h("span", { className: "name", textContent: e.name || "Ohne Namen" }),
        e.slogan ? h("span", { className: "muted small", textContent: `„${e.slogan}“` }) : null,
        h("div", { className: "acts" }, [save, e.mine ? prof : null]),
      ]),
    ]);
  }

  /* ---------- Start ---------- */
  window.gameView = {
    show() {
      const code = new URLSearchParams(location.search).get("code");
      if (session && (!code || code.toUpperCase() === session.code)) { if (!pollTimer && phaseKey !== "results") { phaseKey = null; startPolling(); } return; }
      if (phaseKey === null || phaseKey === "home") renderHome(code ? code.toUpperCase() : "");
    },
  };
})();
