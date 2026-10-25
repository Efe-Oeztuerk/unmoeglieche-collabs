/* Navigation zwischen Studio, Spielen und Profil */
(function () {
  const views = { studio: $("view-studio"), spielen: $("view-spielen"), profil: $("view-profil") };
  function route() {
    const params = new URLSearchParams(location.search);
    let name = (location.hash || "").replace("#", "");
    if (!views[name]) name = params.get("code") ? "spielen" : params.get("u") ? "profil" : "studio";
    Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name));
    document.querySelectorAll(".tabs a").forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === "#" + name ? "page" : "false"));
    if (name === "spielen") window.gameView.show();
    if (name === "profil") window.profileView.show();
    document.title = name === "spielen" ? "Spielen · Unmögliche Kollabs" : name === "profil" ? "Profil · Unmögliche Kollabs" : "Unmögliche Kollabs";
  }
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  if (sb) sb.auth.onAuthStateChange(() => { setTimeout(refreshAuth, 0); });
  refreshAuth().finally(route);
})();
