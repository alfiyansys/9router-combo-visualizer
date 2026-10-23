// 9router combo chain overlay. Must run on a 9router dashboard origin: it reads the
// dashboard's own /api/* endpoints with the logged-in session cookie and sends nothing elsewhere.
// Exposes globalThis.NineRouterComboViz.create() -> { open, close, toggle, isOpen }.
(() => {
  // Alias -> provider id, snapshot of 9router's built-in provider catalog (v0.5.109).
  // Prefixes not listed here are resolved as custom node prefixes, then as provider ids.
  const ALIAS = {"ag":"antigravity","cx":"codex","ds":"deepseek","gcli":"grok-cli","gb":"grok-cli","grok-build":"grok-cli","kimi-coding":"kimi","kmc":"kimi","mimo":"xiaomi-mimo","xmd":"xiaomi-mimo","mimo-desktop":"xiaomi-mimo","xmtp":"xiaomi-tokenplan","aai":"assemblyai","polly":"aws-polly","bfl":"black-forest-labs","bb":"blackbox","brave":"brave-search","bpm":"byteplus","ch":"chutes","cc":"claude","cl":"cline","cf":"cloudflare-ai","cbcn":"codebuddy-cn","cbai":"codebuddy-intl","cmc":"commandcode","cu":"cursor","dg":"deepgram","el":"elevenlabs","fal":"fal-ai","fl":"featherless","gc":"gemini-cli","gh":"github","gpse":"google-pse","gw":"grok-web","hf":"huggingface","hyp":"hyperbolic","if":"iflow","jina":"jina-ai","kc":"kilocode","kr":"kiro","mmf":"mimo-free","nb":"nanobanana","qd":"qoder","qdcn":"qoder-cn","ocg":"opencode-go","ocz":"opencode-zen","oc":"opencode","pw":"perplexity-web","pplx":"perplexity","pa":"perplexity-agent","pplx-agent":"perplexity-agent","runway":"runwayml","stability":"stability-ai","vn":"venice","vercel":"vercel-ai-gateway","vxp":"vertex-partner","vx":"vertex","ark":"volcengine-ark","voyage":"voyage-ai","zd":"zed","af":"api-airforce","airforce":"api-airforce","qianfan":"baidu","ernie":"baidu","bzl":"bazaarlink","bm":"bluesminds","kgw":"kilo-gateway","kilogateway":"kilo-gateway","llm-7":"llm7","samba":"sambanova","hunyuan":"tencent","morphllm":"morph","ps":"poolside","tr":"tokenrouter","fish":"fish-audio","th":"tokenharbor","thh":"tokenharbor","mm":"minimax-code","mmg":"minimax-code-global","br":"bedrock","aws-bedrock":"bedrock","brx":"bedrock-xai","ns":"nous","ds-web":"deepseek-web","gweb":"gemini-web","cg":"chatgpt-web"};
  const STRATEGY = {
    fallback: { label: "↓ fallback", hint: "tried top to bottom until one succeeds", ordered: true },
    "round-robin": { label: "⟳ round-robin", hint: "rotates across healthy entries", ordered: false },
    random: { label: "⚄ random", hint: "picks a random healthy entry", ordered: false },
    smart: { label: "✦ smart", hint: "router scores entries per request", ordered: false },
    fusion: { label: "⨁ fusion", hint: "fans out, a judge model merges answers", ordered: false },
  };
  const POLL_MS = 15000;
  const ID = "nr-combo-viz";

  const CSS = `
  :host{all:initial}
  .w{--bg:#f7f7f5;--panel:#fff;--ink:#1d1d1b;--mute:#6b6b66;--line:#e3e2dc;--chip:#efeee9;
     --ok:#1f8a4c;--warn:#b7791f;--bad:#c53030;--none:#8a8a85;--acc:#3b5bdb;--alt:#7048e8;
     position:absolute;inset:0;display:grid;grid-template-columns:300px 1fr;grid-template-rows:auto 1fr;
     background:var(--bg);color:var(--ink);font:13px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  @media (prefers-color-scheme:dark){.w{--bg:#141413;--panel:#1d1d1b;--ink:#ecebe6;--mute:#9a9992;--line:#30302d;--chip:#2a2a27;
     --ok:#51cf66;--warn:#fcc419;--bad:#ff6b6b;--none:#77776f;--acc:#748ffc;--alt:#b197fc}}
  @media (max-width:760px){.w{grid-template-columns:1fr;grid-template-rows:auto 220px 1fr}aside{border-right:0;border-bottom:1px solid var(--line)}}
  header{grid-column:1/-1;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--panel)}
  header b{font-size:15px} .sp{flex:1}
  .pill{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:99px;background:var(--chip);color:var(--mute);font-size:12px;white-space:nowrap}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--none);flex:none}
  .ok{background:var(--ok)}.warn{background:var(--warn)}.bad{background:var(--bad)}.none{background:var(--none)}
  button{font:inherit;color:inherit;background:var(--chip);border:1px solid var(--line);border-radius:6px;padding:3px 10px;cursor:pointer}
  aside{border-right:1px solid var(--line);overflow:auto;background:var(--panel)}
  aside input{box-sizing:border-box;width:calc(100% - 20px);margin:10px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit}
  .it{padding:7px 12px;cursor:pointer;border-left:3px solid transparent}
  .it:hover,.it.on{background:var(--chip)} .it.on{border-left-color:var(--acc)}
  .r1{display:flex;gap:6px;align-items:center} .nm{flex:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .meta{color:var(--mute);font-size:11px}
  .bar{display:flex;height:4px;border-radius:2px;overflow:hidden;margin-top:4px;background:var(--line)} .bar i{display:block;height:100%}
  main{overflow:auto;padding:18px 22px}
  h2{margin:0 0 4px;font-size:18px} .sub{color:var(--mute);margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  code{font:12px ui-monospace,monospace;background:var(--chip);padding:0 4px;border-radius:3px}
  .grp{border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--panel)}
  .grp.par{border-color:color-mix(in srgb,var(--alt) 45%,var(--line))}
  .gh{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px;color:var(--mute);font-size:12px}
  .gh .tag{font-weight:600;color:var(--acc)} .par>.gh .tag{color:var(--alt)}
  .list{display:flex;flex-direction:column;gap:6px}
  .par>.list{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px}
  .step{display:flex;gap:8px;align-items:flex-start}
  .num{flex:none;width:18px;height:18px;border-radius:50%;background:var(--chip);color:var(--mute);font-size:11px;display:grid;place-items:center;margin-top:9px}
  .par>.list>.step>.num{display:none}
  .lw{flex:1;min-width:0}
  .leaf{display:flex;gap:8px;align-items:center;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);cursor:pointer;min-width:0}
  .leaf.serve{outline:2px solid var(--acc);outline-offset:-1px}
  .leaf.dead{opacity:.55}
  .pfx{font:600 11px ui-monospace,monospace;padding:1px 6px;border-radius:4px;background:var(--chip)}
  .md{font-family:ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .pv{color:var(--mute);font-size:11px;white-space:nowrap}
  .st{margin-left:auto;color:var(--mute);font-size:11px;white-space:nowrap;text-align:right}
  .par .leaf{flex-wrap:wrap} .par .md{flex:1 1 140px;min-width:0}
  .par .st{flex-basis:100%;margin-left:0;text-align:left;white-space:normal}
  .leaf.flash{animation:fl 2.2s ease-out}
  .leaf.busy .dot{animation:pu 1.2s infinite}
  @keyframes fl{0%{background:color-mix(in srgb,var(--acc) 35%,var(--bg))}100%{background:var(--bg)}}
  @keyframes pu{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--acc) 70%,transparent)}100%{box-shadow:0 0 0 8px transparent}}
  .conns{margin:4px 0 2px 16px;border-left:2px solid var(--line);padding-left:10px;font-size:12px}
  .conns div{display:flex;gap:6px;align-items:center;padding:2px 0;color:var(--mute)}
  .conns .why{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .nest>.grp{background:var(--bg)}
  .tw{cursor:pointer;user-select:none;font-weight:600;color:var(--ink)}
  .badge{font-size:11px;padding:0 6px;border-radius:4px;background:var(--chip);color:var(--mute)}
  .bad-t{color:var(--bad)} .warn-t{color:var(--warn)} .acc-t{color:var(--acc);font-weight:600}
  .legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--mute);font-size:12px;margin-top:18px}
  .legend span{display:inline-flex;gap:6px;align-items:center}
  .feed{margin-top:18px;border-top:1px solid var(--line);padding-top:10px;font-size:12px;color:var(--mute)}
  .feed div{font-family:ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .empty{color:var(--mute);padding:30px 0}`;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const now = () => Date.now();
  const ago = (t) => {
    if (!t) return "";
    const s = (now() - new Date(t)) / 1000;
    if (isNaN(s)) return "";
    return s < 60 ? `${s | 0}s` : s < 3600 ? `${(s / 60) | 0}m` : s < 86400 ? `${(s / 3600) | 0}h` : `${(s / 86400) | 0}d`;
  };
  const getJSON = async (u) => {
    const r = await fetch(u, { credentials: "same-origin" });
    if (!r.ok) throw new Error(`${u} → ${r.status}`);
    return r.json();
  };

  function create() {
    let host = null, root = null, es = null, timers = [], onKey = null, pend = false;
    const S = { combos: [], conns: [], nodes: [], aliases: {}, settings: {}, live: null, liveOk: false,
                sel: null, q: "", open: new Set(), shut: new Set(), flash: new Map(), lastSeen: null, loadedAt: null, err: null };
    const $ = (id) => root.getElementById(id);

    // ---- data ----
    async function load() {
      try {
        const [c, p, n, s, a] = await Promise.all([getJSON("/api/combos"), getJSON("/api/providers"), getJSON("/api/provider-nodes"),
          getJSON("/api/settings"), getJSON("/api/models/alias").catch(() => ({}))]);
        S.combos = c.combos || []; S.conns = p.connections || []; S.nodes = n.nodes || [];
        S.settings = s || {}; S.aliases = a.aliases || {};
        S.loadedAt = now(); S.err = null;
        if (!S.sel || !S.combos.some((x) => x.name === S.sel)) S.sel = S.combos[0]?.name || null;
      } catch (e) { S.err = String(e.message || e); }
      render();
    }

    function stream() {
      es = new EventSource("/api/usage/stream");
      es.onopen = () => { S.liveOk = true; render(); };
      es.onerror = () => { S.liveOk = false; render(); };
      es.onmessage = (m) => {
        let ev;
        try { ev = JSON.parse(m.data); } catch { return; }
        const rec = ev.recentRequests || [];
        if (S.lastSeen != null) for (const r of rec) {
          if (new Date(r.timestamp) <= S.lastSeen) break;
          S.flash.set(`${r.model}|${r.provider}`, { t: now(), status: r.status });
        }
        S.lastSeen = rec[0] ? new Date(rec[0].timestamp) : (S.lastSeen ?? new Date(0));
        S.live = ev; S.liveOk = true; render();
      };
    }

    // ---- resolution (mirrors 9router: node prefix, then catalog alias, then provider id) ----
    const comboMap = () => new Map(S.combos.map((c) => [c.name, c]));
    const strategyOf = (c) => c.kind || S.settings.comboStrategies?.[c.name]?.fallbackStrategy || S.settings.comboStrategy || "fallback";
    const strat = (k) => STRATEGY[k] || { label: k, hint: "", ordered: false };

    function resolveProvider(prefix) {
      const node = S.nodes.find((n) => n.prefix === prefix);
      if (node) return { node, id: null, label: node.name, known: true };
      const id = ALIAS[prefix] || prefix;
      return { node: null, id, label: id, known: !!ALIAS[prefix] || S.conns.some((c) => c.provider === id) };
    }
    function connsFor(prov) {
      const list = prov.node
        ? S.conns.filter((c) => c.provider.endsWith(prov.node.id) || c.providerSpecificData?.prefix === prov.node.prefix)
        : S.conns.filter((c) => c.provider === prov.id);
      return list.slice().sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    }
    function connState(c, model) {
      const lock = c["modelLock_" + model];
      if (!c.isActive) return ["bad", "disabled"];
      if (c.testStatus === "error" || c.testStatus === "unavailable") return ["bad", c.testStatus + (c.errorCode ? ` ${c.errorCode}` : "")];
      if (c.rateLimitedUntil && new Date(c.rateLimitedUntil) > now()) return ["warn", `rate-limited until ${new Date(c.rateLimitedUntil).toLocaleTimeString()}`];
      if (lock && new Date(lock) > now()) return ["warn", `model locked until ${new Date(lock).toLocaleTimeString()}`];
      if (c.backoffLevel > 0) return ["warn", `backoff level ${c.backoffLevel}`];
      return ["ok", "ready"];
    }

    function resolveEntry(entry) {
      if (comboMap().has(entry)) return { type: "combo", name: entry, entry };
      if (!entry.includes("/") && S.aliases[entry]) return { ...resolveEntry(S.aliases[entry]), via: entry };
      const i = entry.indexOf("/");
      const prefix = i < 0 ? "" : entry.slice(0, i), model = i < 0 ? entry : entry.slice(i + 1);
      const prov = resolveProvider(prefix);
      const conns = prefix ? connsFor(prov) : [];
      const states = conns.map((c) => connState(c, model));
      const ok = states.filter(([s]) => s === "ok").length, warn = states.filter(([s]) => s === "warn").length;
      const health = !conns.length ? "none" : ok === conns.length ? "ok" : ok || warn ? "warn" : "bad";
      const provIds = new Set(conns.map((c) => c.provider).concat(prov.id ? [prov.id] : []));
      let req = 0, last = null;
      for (const v of Object.values(S.live?.byModel || {}))
        if (v.rawModel === model && provIds.has(v.provider)) { req += v.requests || 0; if (!last || v.lastUsed > last) last = v.lastUsed; }
      const busy = Object.entries(S.live?.pending?.byModel || {}).some(([k, v]) => v && k.includes(model)) ||
        (S.live?.activeRequests || []).some((a) => a.model === model || a.model?.endsWith("/" + model));
      let flash = null;
      for (const [k, v] of S.flash) { const [m, p] = k.split("|"); if ((m === model || m === entry) && provIds.has(p)) flash = v; }
      return { type: "leaf", entry, prefix, model, prov, conns, states, ok, warn, health, req, last, busy, flash };
    }

    function leaves(name, seen = new Set()) {
      if (seen.has(name)) return [];
      const c = comboMap().get(name);
      if (!c) return [];
      const s2 = new Set(seen).add(name);
      return c.models.flatMap((m) => { const r = resolveEntry(m); return r.type === "combo" ? leaves(r.name, s2) : [r]; });
    }
    const usable = (r) => r.health === "ok" || r.health === "warn";
    const usedBy = (name) => S.combos.filter((c) => c.models.includes(name)).map((c) => c.name);

    // Which leaves would take a request right now. Fallback: first usable entry (descending into
    // nested combos); other strategies: every usable entry is a candidate. Returns Map(path -> tag).
    function plan(name, path, seen, out, tag) {
      const c = comboMap().get(name);
      if (!c || seen.has(name)) return false;
      const s2 = new Set(seen).add(name), ordered = strat(strategyOf(c)).ordered;
      let any = false;
      for (let i = 0; i < c.models.length; i++) {
        const r = resolveEntry(c.models[i]), p = `${path}/${i}`;
        const t = ordered ? tag : "candidate";
        const hit = r.type === "combo" ? plan(r.name, p, s2, out, t) : usable(r) && (out.set(p, t), true);
        if (hit) { any = true; if (ordered) break; }
      }
      return any;
    }

    // ---- render ----
    function render() {
      if (pend || !root) return;
      pend = true;
      requestAnimationFrame(() => { pend = false; if (root) draw(); });
    }

    function healthBar(ls) {
      const n = ls.length || 1, cnt = { ok: 0, warn: 0, bad: 0, none: 0 };
      ls.forEach((l) => cnt[l.health]++);
      return `<div class="bar">${["ok", "warn", "bad", "none"].map((k) => cnt[k] ? `<i class="${k}" style="width:${(cnt[k] / n) * 100}%"></i>` : "").join("")}</div>`;
    }

    function leafHTML(r, i, path, marks) {
      const tag = marks.get(path), openConns = S.open.has("L" + path);
      const cls = ["leaf", tag ? "serve" : "", usable(r) ? "" : "dead",
        r.flash && now() - r.flash.t < 2500 ? "flash" : "", r.busy ? "busy" : ""].join(" ");
      const bad = r.states.filter(([s]) => s === "bad").length;
      const connTxt = !r.prefix ? `<span class="bad-t">missing combo or alias</span>`
        : !r.conns.length ? `<span class="bad-t">${r.prov.known ? "no connection" : "unknown prefix"}</span>`
        : `${r.ok}/${r.conns.length} ready${r.warn ? ` · <span class="warn-t">${r.warn} limited</span>` : ""}${bad ? ` · <span class="bad-t">${bad} down</span>` : ""}`;
      const conns = openConns && r.conns.length ? `<div class="conns">${r.conns.map((c, k) => {
        const [s, why] = r.states[k];
        return `<div><span class="dot ${s}"></span><b>${esc(c.name || c.displayName || c.id.slice(0, 8))}</b>
          <span class="badge">p${esc(c.priority ?? "–")}</span><span class="why">${esc(why)}${c.lastError && s !== "ok" ? " — " + esc(String(c.lastError).slice(0, 120)) : ""}</span>
          ${c.lastUsedAt ? `<span>· used ${ago(c.lastUsedAt)} ago</span>` : ""}</div>`;
      }).join("")}</div>` : "";
      return `<div class="step"><span class="num">${i + 1}</span><div class="lw">
        <div class="${cls}" data-l="${esc(path)}" title="${esc(r.entry)} — click to ${openConns ? "hide" : "show"} connections">
        <span class="dot ${r.health}"></span><span class="pfx">${esc(r.prefix || "—")}</span>
        <span class="md">${esc(r.model)}</span>${r.via ? `<span class="badge">alias ${esc(r.via)}</span>` : ""}
        <span class="pv">${r.prefix ? esc(r.prov.label) : ""}</span>
        <span class="st">${connTxt}<br>${r.req ? `${r.req.toLocaleString()} req` : "no traffic"}${r.last ? ` · ${ago(r.last)} ago` : ""}${tag ? ` · <span class="acc-t">${tag}</span>` : ""}</span>
        </div>${conns}</div></div>`;
    }

    function comboHTML(name, path, seen, marks) {
      const c = comboMap().get(name);
      if (!c) return `<div class="empty">Combo ${esc(name)} not found</div>`;
      if (seen.has(name)) return `<div class="grp"><span class="bad-t">cycle → ${esc(name)}</span></div>`;
      const s2 = new Set(seen).add(name), st = strat(strategyOf(c));
      const body = c.models.map((m, i) => {
        const r = resolveEntry(m), p = `${path}/${i}`;
        if (r.type === "leaf") return leafHTML(r, i, p, marks);
        const depth = p.split("/").length - 1, isOpen = S.open.has(p) || (!S.shut.has(p) && depth < 3);
        const sub = comboMap().get(r.name), ls = leaves(r.name);
        return `<div class="step"><span class="num">${i + 1}</span><div class="lw nest">
          <div class="gh"><span class="tw" data-k="${esc(p)}">${isOpen ? "▾" : "▸"} combo ${esc(r.name)}</span>
          <span class="badge">${esc(sub ? strategyOf(sub) : "?")}</span><span class="badge">${ls.length} models</span>
          ${r.via ? `<span class="badge">alias ${esc(r.via)}</span>` : ""}</div>
          ${isOpen ? comboHTML(r.name, p, s2, marks) : healthBar(ls)}</div></div>`;
      }).join("");
      return `<div class="grp ${st.ordered ? "" : "par"}"><div class="gh"><span class="tag">${esc(st.label)}</span>
        <span>${esc(st.hint)}</span><span>· ${c.models.length} entries</span></div>
        <div class="list">${body || `<div class="empty">empty combo</div>`}</div></div>`;
    }

    function draw() {
      const live = $("live");
      live.querySelector(".dot").className = "dot " + (S.liveOk ? "ok" : "bad");
      live.lastChild.textContent = S.liveOk ? "live" : "stream offline";
      const L = S.live;
      $("info").textContent = S.err ? `error: ${S.err}` :
        `${S.combos.length} combos · ${S.conns.length} connections${L ? ` · ${(L.totalRequests || 0).toLocaleString()} req total` : ""} · refreshed ${ago(S.loadedAt) || "0s"} ago`;

      const cm = comboMap(), q = S.q.toLowerCase();
      const list = S.combos.filter((c) => !q || c.name.toLowerCase().includes(q) || c.models.some((m) => m.toLowerCase().includes(q)));
      $("side").innerHTML = list.map((c) => {
        const ls = leaves(c.name), nested = c.models.some((m) => cm.has(m)), by = usedBy(c.name);
        const hot = ls.some((l) => l.busy || (l.flash && now() - l.flash.t < 60000));
        const sl = strat(strategyOf(c)).label.split(" ")[0];
        return `<div class="it ${c.name === S.sel ? "on" : ""}" data-c="${esc(c.name)}"><div class="r1">
          <span class="dot ${hot ? "ok" : "none"}" style="${hot ? "" : "opacity:.3"}"></span><span class="nm">${esc(c.name)}</span>
          <span class="meta">${esc(sl)} ${c.models.length}</span></div>
          <div class="meta">${[nested && "nests combos", by.length && "used by " + by.join(", ")].filter(Boolean).map(esc).join(" · ")}</div>
          ${healthBar(ls)}</div>`;
      }).join("") || `<div class="empty" style="padding:12px">no match</div>`;

      const m = $("main"), top = m.scrollTop, c = cm.get(S.sel);
      if (!c) { m.innerHTML = `<div class="empty">${S.err ? esc(S.err) : "Loading…"}</div>`; return; }
      const ls = leaves(c.name), by = usedBy(c.name), marks = new Map();
      plan(c.name, "", new Set(), marks, "serves now");
      const cnt = (h) => ls.filter((l) => l.health === h).length;
      const feed = (L?.recentRequests || []).slice(0, 8).map((r) =>
        `<div>${esc(new Date(r.timestamp).toLocaleTimeString())} · ${esc(r.provider)} · ${esc(r.model)} · ${esc(r.status)} · ${esc(r.promptTokens)}/${esc(r.completionTokens)} tok</div>`).join("");
      m.innerHTML = `<h2>${esc(c.name)}</h2><div class="sub">
        <span class="pill">${esc(strategyOf(c))}</span><span class="pill">${ls.length} resolved models</span>
        ${["ok", "warn", "bad", "none"].map((h) => `<span class="pill"><span class="dot ${h}"></span>${cnt(h)}</span>`).join("")}
        ${by.length ? `<span>used by ${by.map((b) => `<a href="#" data-c="${esc(b)}" style="color:var(--acc)">${esc(b)}</a>`).join(", ")}</span>` : ""}
        <span>· call as <code>${esc(c.name)}</code></span></div>
        ${comboHTML(c.name, "", new Set(), marks)}
        <div class="legend"><span><span class="dot ok"></span>all connections ready</span><span><span class="dot warn"></span>some limited / backoff / model lock</span>
        <span><span class="dot bad"></span>connections down</span><span><span class="dot none"></span>no connection or unknown prefix</span>
        <span>outline = would take a request now</span><span>flash = request just landed · click a model for its connections</span></div>
        <div class="feed"><b>Recent requests</b>${feed || "<div>—</div>"}</div>`;
      m.scrollTop = top;
    }

    function onClick(e) {
      const t = e.target.closest("[data-c],[data-k],[data-l],#x,#rf");
      if (!t) return;
      if (t.id === "x") return close();
      if (t.id === "rf") return load();
      if (t.dataset.c) { e.preventDefault(); S.sel = t.dataset.c; $("main").scrollTop = 0; return render(); }
      if (t.dataset.l != null) { const k = "L" + t.dataset.l; S.open.has(k) ? S.open.delete(k) : S.open.add(k); return render(); }
      if (t.dataset.k != null) {
        const k = t.dataset.k, isOpen = t.textContent.trim().startsWith("▾");
        S.open.delete(k); S.shut.delete(k); (isOpen ? S.shut : S.open).add(k); render();
      }
    }

    function open() {
      if (host) return;
      document.getElementById(ID)?.remove();
      host = document.createElement("div");
      host.id = ID;
      host.style.cssText = "position:fixed;inset:0;z-index:2147483647";
      document.body.appendChild(host);
      root = host.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${CSS}</style><div class="w"><header><b>Combo chains</b>
        <span class="pill" id="live"><span class="dot"></span>stream</span><span class="pill" id="info"></span><span class="sp"></span>
        <button id="rf">Refresh</button><button id="x">Close (Esc)</button></header>
        <aside><input id="q" placeholder="Filter combo / model…"><div id="side"></div></aside><main id="main"></main></div>`;
      root.addEventListener("click", onClick);
      $("q").addEventListener("input", (e) => { S.q = e.target.value; render(); });
      onKey = (e) => { if (e.key === "Escape") close(); };
      document.addEventListener("keydown", onKey);
      timers = [setInterval(load, POLL_MS), setInterval(render, 1000)]; // 1s tick fades flashes and refreshes "ago"
      load();
      stream();
    }

    function close() {
      timers.forEach(clearInterval); timers = [];
      es?.close(); es = null;
      if (onKey) document.removeEventListener("keydown", onKey);
      host?.remove(); host = root = null;
    }

    return { open, close, toggle: () => (host ? close() : open()), isOpen: () => !!host };
  }

  globalThis.NineRouterComboViz = { create };
})();
