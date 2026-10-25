/* Studio (allein): würfeln, entwerfen, anpassen, Archiv */
(function () {
  const state = { brand: pick(BRANDS), product: pick(PRODUCTS) };
  let rolling = false;

  const studio = createStudio({
    mount: $("soloStudio"),
    specEl: $("soloSpec"),
    getCombo: () => ({ brand: state.brand, product: state.product }),
    limits: null,
    onSave: (e) => archiveSave(e),
    onChange: (st) => { ["designBtn", "rollBtn", "brand", "product"].forEach((id) => { $(id).disabled = st.busy; }); },
  });

  function roll(key, delay = 0) {
    if (studio.busy) return;
    const list = key === "brand" ? BRANDS : PRODUCTS;
    const final = pick(list, state[key]);
    state[key] = final;
    if (!studio.entry) studio.render();
    const el = $(key);
    if (reduceMotion) { el.textContent = final; return; }
    el.classList.add("rolling");
    const end = Date.now() + 520 + delay;
    (function tick() {
      if (Date.now() < end) { el.textContent = pick(list); setTimeout(tick, 60); }
      else { el.textContent = final; el.classList.remove("rolling"); }
    })();
  }
  function setCombo(b, p) { state.brand = b; state.product = p; $("brand").textContent = b; $("product").textContent = p; }

  $("brand").addEventListener("click", () => roll("brand"));
  $("product").addEventListener("click", () => roll("product"));
  $("rollBtn").addEventListener("click", () => { roll("brand"); roll("product", 260); });
  $("designBtn").addEventListener("click", () => studio.design());
  $("ownForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const b = $("ownBrand").value.trim(), p = $("ownProduct").value.trim();
    setCombo(b || state.brand, p || state.product);
    if (!studio.entry) studio.render();
  });

  async function renderArchive() {
    const items = await archiveAll();
    $("sheet").replaceChildren(...items.map((it) => h("button", { className: "thumb", type: "button", on: { click: () => {
      if (studio.busy) return;
      setCombo(it.brand, it.product);
      studio.setEntry(it);
      location.hash = "#studio";
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    } } }, [
      h("div", { className: "ph" }, h("img", { src: currentVersion(it).image, alt: "", loading: "lazy" })),
      h("div", {}, [h("small", { textContent: `${it.brand} × ${it.product}${it.fromGame ? " · Spiel" : ""}` }), h("span", { textContent: it.name || it.product })]),
    ])));
    $("noneNote").hidden = items.length > 0;
    $("clearBtn").hidden = items.length === 0;
    $("archiveCount").textContent = items.length ? `${items.length} Entwürfe ·` : "";
  }
  archiveListeners.add(renderArchive);

  let clearArmed = false;
  $("clearBtn").addEventListener("click", async () => {
    if (!clearArmed) { clearArmed = true; $("clearBtn").textContent = "Wirklich alles löschen?"; setTimeout(() => { clearArmed = false; $("clearBtn").textContent = "Archiv leeren"; }, 4000); return; }
    clearArmed = false; $("clearBtn").textContent = "Archiv leeren";
    await archiveClear();
  });

  setCombo(state.brand, state.product);
  studio.render();
  renderArchive();
})();
