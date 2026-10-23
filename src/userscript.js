// Userscript shell: decides whether this page is a 9router dashboard, then offers the overlay
// through a floating button, Alt+Shift+C and the Tampermonkey menu. No host is hardcoded:
// a page is probed only when its title mentions 9router or its origin is on the allowlist,
// and it counts as 9router only if /api/combos answers like 9router does.
(() => {
  const ORIGIN = location.origin;
  const RETRY_MS = 5000, RETRY_MAX = 120; // keep waiting ~10 min on the login page
  const list = (k) => GM_getValue(k, []);
  const setList = (k, fn) => GM_setValue(k, fn(list(k)).filter((v, i, a) => a.indexOf(v) === i));
  const allowed = () => list("allow").includes(ORIGIN);
  const denied = () => list("deny").includes(ORIGIN);
  const hinted = () => allowed() || /9router/i.test(document.title);

  let viz = null, btn = null, menuIds = [], tries = 0, timer = null;

  // "yes" = logged-in 9router, "login" = 9router asking for a session, "no" = something else
  async function probe() {
    try {
      const r = await fetch("/api/combos", { credentials: "same-origin", headers: { accept: "application/json" } });
      const j = await r.json().catch(() => null);
      if (r.ok && j && Array.isArray(j.combos)) return "yes";
      if (r.status === 401 && j && j.error) return "login";
    } catch {}
    return "no";
  }

  function toggle() { viz?.toggle(); }

  function showButton() {
    if (btn || !GM_getValue("button", true)) return;
    btn = document.createElement("div");
    btn.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483646";
    const sr = btn.attachShadow({ mode: "open" });
    sr.innerHTML = `<style>
      button{font:600 12px/1 ui-sans-serif,system-ui,sans-serif;padding:8px 12px;border-radius:99px;cursor:pointer;
        border:1px solid #d6d5cf;background:#fff;color:#1d1d1b;box-shadow:0 2px 8px rgba(0,0,0,.15)}
      @media (prefers-color-scheme:dark){button{background:#1d1d1b;color:#ecebe6;border-color:#3a3a36}}
    </style><button title="9router combo chains (Alt+Shift+C)">⛓ Chains</button>`;
    sr.querySelector("button").addEventListener("click", toggle);
    document.body.appendChild(btn);
  }
  function hideButton() { btn?.remove(); btn = null; }

  function activate() {
    if (viz) return;
    viz = globalThis.NineRouterComboViz.create();
    showButton();
    document.addEventListener("keydown", (e) => {
      if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === "KeyC") { e.preventDefault(); toggle(); }
    });
    menus();
  }

  function menus() {
    menuIds.forEach((id) => GM_unregisterMenuCommand?.(id));
    menuIds = [];
    const add = (label, fn) => menuIds.push(GM_registerMenuCommand(label, fn));
    if (viz) {
      add("Toggle combo chains (Alt+Shift+C)", toggle);
      add(GM_getValue("button", true) ? "Hide floating button" : "Show floating button", () => {
        GM_setValue("button", !GM_getValue("button", true));
        GM_getValue("button", true) ? showButton() : hideButton();
        menus();
      });
    }
    if (denied()) {
      add(`Enable on ${ORIGIN}`, () => { setList("deny", (l) => l.filter((o) => o !== ORIGIN)); setList("allow", (l) => [...l, ORIGIN]); start(); menus(); });
    } else {
      if (!allowed()) add(`Always check ${ORIGIN}`, () => { setList("allow", (l) => [...l, ORIGIN]); start(); menus(); });
      add(`Disable on ${ORIGIN}`, () => {
        setList("deny", (l) => [...l, ORIGIN]); setList("allow", (l) => l.filter((o) => o !== ORIGIN));
        viz?.close(); viz = null; hideButton(); clearTimeout(timer); menus();
      });
    }
  }

  async function start() {
    clearTimeout(timer);
    if (viz || denied() || !hinted()) return;
    const r = await probe();
    if (r === "yes") return activate();
    if (r === "login" && ++tries < RETRY_MAX) timer = setTimeout(start, RETRY_MS);
  }

  menus();
  start();
  // SPA titles can arrive late; re-check when <title> changes until detected
  const t = document.querySelector("title");
  if (t) new MutationObserver(() => { if (!viz) start(); }).observe(t, { childList: true });
})();
