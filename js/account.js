/* Konto: Anmelden/Registrieren, eigenes Profil mit Vitrine, öffentliche Profile (?u=name) */
(function () {
  const root = $("profileRoot");
  let mode = "login";

  async function showcaseOf(userId) {
    const { data, error } = await sb.from("showcase").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  function card(item, own, onDelete) {
    let armed = false;
    const del = own ? h("button", { className: "linkish", type: "button", textContent: "Entfernen" }) : null;
    if (del) del.addEventListener("click", async () => {
      if (!armed) { armed = true; del.textContent = "Wirklich entfernen?"; setTimeout(() => { armed = false; del.textContent = "Entfernen"; }, 3500); return; }
      const { error } = await sb.from("showcase").delete().eq("id", item.id);
      if (error) { toast("Entfernen hat nicht geklappt."); return; }
      onDelete && onDelete();
    });
    return h("article", { className: "panel entry" }, [
      h("img", { src: item.image_url, alt: item.name || item.product || "", loading: "lazy" }),
      h("div", { className: "body" }, [
        h("div", { className: "meta" }, [h("span", { textContent: `${item.brand || ""} × ${item.product || ""}` })]),
        h("span", { className: "name", textContent: item.name || "Ohne Namen" }),
        item.slogan ? h("span", { className: "muted small", textContent: `„${item.slogan}“` }) : null,
        del ? h("div", { className: "acts" }, del) : null,
      ]),
    ]);
  }

  function renderAuth(info) {
    const email = h("input", { className: "field", type: "email", id: "authEmail", placeholder: "E-Mail", autocomplete: "email", required: true });
    const pass = h("input", { className: "field", type: "password", id: "authPass", placeholder: "Passwort (mind. 6 Zeichen)", autocomplete: mode === "login" ? "current-password" : "new-password", required: true, minLength: 6 });
    const user = h("input", { className: "field", id: "authUser", placeholder: "Benutzername (3–20 Zeichen)", autocomplete: "username", maxLength: 20 });
    const msg = h("p", { className: "notice", hidden: true });
    const ok = h("p", { className: "ok-note", hidden: !info, textContent: info || "" });
    const btn = h("button", { className: "btn primary", type: "submit", textContent: mode === "login" ? "Anmelden" : "Konto erstellen" });
    const switcher = h("div", { className: "auth-switch" }, [
      h("button", { type: "button", textContent: "Anmelden", attrs: { "aria-pressed": String(mode === "login") }, on: { click: () => { mode = "login"; renderAuth(); } } }),
      h("button", { type: "button", textContent: "Registrieren", attrs: { "aria-pressed": String(mode === "signup") }, on: { click: () => { mode = "signup"; renderAuth(); } } }),
    ]);
    const form = h("form", { className: "stack", on: { submit: async (ev) => {
      ev.preventDefault(); msg.hidden = true; btn.disabled = true;
      try {
        if (mode === "signup") {
          const u = user.value.trim();
          if (!/^[A-Za-z0-9_.-]{3,20}$/.test(u)) throw new Error("Der Benutzername darf nur Buchstaben, Zahlen, Punkt, Bindestrich und Unterstrich enthalten (3–20 Zeichen).");
          const { data: taken } = await sb.from("profiles").select("id").ilike("username", u).maybeSingle();
          if (taken) throw new Error("Dieser Benutzername ist schon vergeben.");
          const { data, error } = await sb.auth.signUp({ email: email.value.trim(), password: pass.value, options: { data: { username: u }, emailRedirectTo: location.origin + "/#profil" } });
          if (error) throw error;
          if (!data.session) { mode = "login"; renderAuth("Fast geschafft: Bestätige deine E-Mail über den Link, den wir dir geschickt haben. Danach kannst du dich anmelden."); return; }
        } else {
          const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
          if (error) throw error;
        }
        await refreshAuth();
      } catch (e) {
        const m = String(e.message || e);
        msg.textContent = /Invalid login/i.test(m) ? "E-Mail oder Passwort stimmt nicht."
          : /already registered/i.test(m) ? "Für diese E-Mail gibt es schon ein Konto."
          : /Email not confirmed/i.test(m) ? "Bitte bestätige zuerst deine E-Mail."
          : /rate limit/i.test(m) ? "Gerade zu viele Versuche. Warte kurz und probier es dann noch mal."
          : m;
        msg.hidden = false;
      } finally { btn.disabled = false; }
    } } }, [
      mode === "signup" ? h("label", { className: "field-label" }, ["Benutzername", user]) : null,
      h("label", { className: "field-label" }, ["E-Mail", email]),
      h("label", { className: "field-label" }, ["Passwort", pass]),
      msg, btn,
    ]);
    root.replaceChildren(h("div", { className: "wrap profile" }, [
      h("div", { className: "game-hero center", style: "justify-items:center" }, [
        h("span", { className: "label", textContent: "Dein Profil" }),
        h("h1", { className: "h-display", textContent: "Deine Vitrine", style: "font-size:clamp(32px,4.5vw,56px)" }),
        h("p", { className: "muted", textContent: "Mit einem Konto kannst du deine besten Produkte hochladen und dein Profil teilen. Zum Spielen brauchst du keins." }),
      ]),
      h("section", { className: "panel auth-card" }, [switcher, ok, form]),
    ]));
  }

  async function renderOwn() {
    const p = auth.profile;
    const name = p ? p.username : (auth.user.email || "Du");
    const grid = h("div", { className: "gallery" });
    const count = h("span", { className: "pill" });
    const share = h("button", { className: "btn small", type: "button", textContent: "Profil-Link kopieren" });
    share.addEventListener("click", async () => {
      const link = `${location.origin}/?u=${encodeURIComponent(name)}#profil`;
      try { await navigator.clipboard.writeText(link); toast("Link kopiert"); } catch { toast(link); }
    });
    const out = h("button", { className: "btn small", type: "button", textContent: "Abmelden" });
    out.addEventListener("click", async () => { await sb.auth.signOut(); await refreshAuth(); });
    root.replaceChildren(h("div", { className: "wrap profile" }, [
      h("div", { className: "profile-head" }, [avatar(name), h("div", { className: "stack", style: "gap:4px" }, [h("h1", { className: "h-display", textContent: "@" + name }), count]), h("span", { className: "spacer" }), share, out]),
      grid,
      h("p", { className: "muted small", textContent: "Hochladen kannst du im Studio über das Pfeil-nach-oben-Symbol auf dem Foto oder bei der Siegerehrung unter deinen eigenen Beiträgen." }),
    ]));
    async function load() {
      try {
        const items = await showcaseOf(auth.user.id);
        count.textContent = `${items.length} Produkt${items.length === 1 ? "" : "e"} in der Vitrine`;
        grid.replaceChildren(...(items.length ? items.map((it) => card(it, true, load)) : [h("p", { className: "muted", textContent: "Noch leer. Entwirf etwas im Studio oder gewinn eine Runde und lade dein Lieblingsprodukt hoch." })]));
      } catch { grid.replaceChildren(h("p", { className: "notice", textContent: "Die Vitrine konnte nicht geladen werden." })); }
    }
    load();
  }

  async function renderPublic(username) {
    root.replaceChildren(h("div", { className: "wrap profile" }, h("p", { className: "muted", textContent: "Profil wird geladen …" })));
    const { data: p } = await sb.from("profiles").select("id, username").ilike("username", username).maybeSingle();
    if (!p) { root.replaceChildren(h("div", { className: "wrap profile" }, h("p", { className: "notice", textContent: `Kein Profil „${username}“ gefunden.` }))); return; }
    const items = await showcaseOf(p.id).catch(() => []);
    root.replaceChildren(h("div", { className: "wrap profile" }, [
      h("div", { className: "profile-head" }, [avatar(p.username), h("div", { className: "stack", style: "gap:4px" }, [h("h1", { className: "h-display", textContent: "@" + p.username }), h("span", { className: "pill", textContent: `${items.length} Produkte` })])]),
      h("div", { className: "gallery" }, items.length ? items.map((it) => card(it, false)) : [h("p", { className: "muted", textContent: "Diese Vitrine ist noch leer." })]),
    ]));
  }

  function render() {
    if (!sb) { root.replaceChildren(h("div", { className: "wrap profile" }, h("p", { className: "notice", textContent: "Keine Verbindung zum Server." }))); return; }
    const u = new URLSearchParams(location.search).get("u");
    if (u && (!auth.profile || auth.profile.username.toLowerCase() !== u.toLowerCase())) { renderPublic(u); return; }
    if (auth.user) renderOwn(); else renderAuth();
  }

  window.profileView = { show: render };
  auth.listeners.add(() => { if (location.hash === "#profil") render(); });
})();
