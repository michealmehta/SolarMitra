/* Solar Mitra Connect — front end (no build step) */
"use strict";

const STAGE_COLORS = {
  "Interested": ["#c97a06", "#fff4dc"],
  "Not Interested": ["#5b6675", "#eef0f3"],
  "Site Visit": ["#2f6fed", "#e8f0ff"],
  "Registration Process": ["#7c3aed", "#f1eafe"],
  "Loan Process": ["#0f8a7e", "#e2f5f2"],
  "Interested but Discom Problem": ["#d9480f", "#fdeee6"],
  "Interested but Other Problem": ["#be185d", "#fce8f1"],
};
const SLOTS = [
  ["bill", "Electricity Bill"], ["north", "North Side"], ["east", "East Side"],
  ["west", "West Side"], ["south", "South Side"], ["gps", "GPS Photo"],
];
const ICONS = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M1 21a8 8 0 0 1 16 0M17 4a4 4 0 0 1 0 8M23 21a8 8 0 0 0-5-7.4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>',
  camera: '<path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;

/* ---------------- state & helpers ---------------- */
const S = {
  token: localStorage.getItem("sm_token") || "",
  user: JSON.parse(localStorage.getItem("sm_user") || "null"),
  stages: Object.keys(STAGE_COLORS),
  month: null,
  leadsCache: null,
};
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isAdmin = () => S.user?.role === "admin";
const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const addDays = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const curMonth = () => istToday().slice(0, 7);
const fmtDate = (d) => d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
const fmtDT = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "";
const initials = (n) => String(n || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const pct = (a, t) => (t > 0 ? Math.round((a / t) * 100) : 0);
const stageChip = (s) => { const [c, bg] = STAGE_COLORS[s] || ["#5b6675", "#eef0f3"]; return `<span class="chip" style="color:${c};background:${bg}"><span class="d"></span>${esc(s)}</span>`; };
function dueLabel(d, stage) {
  if (!d || stage === "Not Interested") return "";
  const t = istToday();
  if (d < t) { const n = Math.round((new Date(t) - new Date(d)) / 864e5); return `<span class="due over">Overdue ${n}d · ${fmtDate(d)}</span>`; }
  if (d === t) return `<span class="due today">Follow up today</span>`;
  if (d === addDays(t, 1)) return `<span class="due">Tomorrow</span>`;
  return `<span class="due">Next: ${fmtDate(d)}</span>`;
}

let toastT;
function toast(msg, err) {
  const t = $("#toast"); t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = ""), 2800);
}
async function api(path, { method = "GET", body, raw } = {}) {
  const headers = {};
  if (S.token) headers.authorization = "Bearer " + S.token;
  if (body) headers["content-type"] = "application/json";
  if (raw) { headers["content-type"] = raw.type; headers["x-file-name"] = encodeURIComponent(raw.name || "file"); }
  let r;
  try { r = await fetch("/api/" + path, { method, headers, body: raw ? raw.blob : body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error("No internet connection. Please try again."); }
  const data = (r.headers.get("content-type") || "").includes("json") ? await r.json() : await r.blob();
  if (r.status === 401 && path !== "login") { logout(); throw new Error(data.error || "Please log in again."); }
  if (r.status === 403 && /inactive/i.test(data.error || "")) { logout(); }
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}
function logout() {
  S.token = ""; S.user = null; S.leadsCache = null;
  localStorage.removeItem("sm_token"); localStorage.removeItem("sm_user");
  location.hash = "#/"; render();
}
function setSession(token, user) {
  S.token = token; S.user = user;
  localStorage.setItem("sm_token", token); localStorage.setItem("sm_user", JSON.stringify(user));
}
function modal(title, inner, { wide } = {}) {
  closeModal();
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal" style="${wide ? "max-width:760px" : ""}"><div class="mh"><h2 style="font-size:19px">${esc(title)}</h2><button class="x" aria-label="Close">✕</button></div><div class="mb">${inner}</div></div>`;
  bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest(".x")) closeModal(); });
  document.body.appendChild(bg);
  document.body.style.overflow = "hidden";
  return $(".mb", bg);
}
function closeModal() { $(".modal-bg")?.remove(); document.body.style.overflow = ""; }
function viewImage(url) {
  const v = document.createElement("div"); v.className = "viewer" + (isAdmin() ? "" : " no-save");
  v.innerHTML = `<img src="${esc(url)}" alt=""><button aria-label="Close">✕</button>`;
  v.onclick = () => v.remove();
  if (!isAdmin()) v.oncontextmenu = (e) => e.preventDefault();
  document.body.appendChild(v);
}
function busy(text) {
  const o = document.createElement("div"); o.className = "overlay";
  o.innerHTML = `<div><div class="spinner" style="margin:0 auto 12px"></div><div class="msg">${esc(text)}</div></div>`;
  document.body.appendChild(o);
  return { set: (t) => ($(".msg", o).textContent = t), done: () => o.remove() };
}

/* ---------------- images: stamp + compress ---------------- */
async function loadBitmap(file) {
  if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch {} }
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
}
async function processPhoto(file, { title, gps, max = 1600 } = {}) {
  const img = await loadBitmap(file);
  const w0 = img.width, h0 = img.height, sc = Math.min(1, max / Math.max(w0, h0));
  const w = Math.round(w0 * sc), h = Math.round(h0 * sc);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0, w, h);
  if (title) {
    const fs = Math.max(14, Math.round(w / 38)), pad = Math.round(fs * .7);
    const lines = [title.toUpperCase()];
    if (gps) lines.push(`Lat ${gps.lat.toFixed(6)}  Long ${gps.lng.toFixed(6)}  ±${Math.round(gps.acc || 0)}m`);
    lines.push(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST");
    lines.push("Solar Mitra: " + (S.user?.name || ""));
    const bh = pad * 2 + lines.length * fs * 1.35;
    x.fillStyle = "rgba(15,34,51,.72)"; x.fillRect(0, h - bh, w, bh);
    x.fillStyle = "#f5a524"; x.fillRect(0, h - bh, Math.max(6, fs * .35), bh);
    x.textBaseline = "top";
    lines.forEach((l, i) => {
      x.font = `${i === 0 ? 800 : 600} ${fs}px "Plus Jakarta Sans", Arial, sans-serif`;
      x.fillStyle = i === 0 ? "#f5a524" : "#ffffff";
      x.fillText(l, pad + fs * .5, h - bh + pad + i * fs * 1.35, w - pad * 2);
    });
  }
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.78));
  return { blob, type: "image/jpeg", name: (title || "photo").replace(/\W+/g, "-").toLowerCase() + ".jpg", preview: URL.createObjectURL(blob) };
}
async function uploadFile(f) {
  const r = await api("upload", { method: "POST", raw: f });
  return { key: r.key, type: r.type, name: r.name };
}

/* ---------------- GPS ---------------- */
const GPS = { fix: null, err: null, watch: null, listeners: new Set() };
function startGPS() {
  if (GPS.watch !== null || !navigator.geolocation) { if (!navigator.geolocation) GPS.err = "GPS not supported on this phone"; return; }
  GPS.watch = navigator.geolocation.watchPosition(
    (p) => { GPS.fix = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, at: new Date().toISOString() }; GPS.err = null; GPS.listeners.forEach((f) => f()); },
    (e) => { GPS.err = e.code === 1 ? "Location permission denied. Allow location for this site in browser settings." : "Can't get location. Turn on GPS and go outdoors."; GPS.listeners.forEach((f) => f()); },
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 }
  );
}
function stopGPS() { if (GPS.watch !== null) navigator.geolocation.clearWatch(GPS.watch); GPS.watch = null; GPS.listeners.clear(); }
function waitFix(ms = 20000) {
  if (GPS.fix) return Promise.resolve(GPS.fix);
  return new Promise((res, rej) => {
    const t = setTimeout(() => { GPS.listeners.delete(f); rej(new Error(GPS.err || "Location not found yet. Turn on GPS and try again.")); }, ms);
    const f = () => { if (GPS.fix) { clearTimeout(t); GPS.listeners.delete(f); res(GPS.fix); } };
    GPS.listeners.add(f);
  });
}

/* ---------------- shell ---------------- */
function navItems() {
  return isAdmin()
    ? [["#/home", "chart", "Dashboard"], ["#/leads", "list", "Leads"], ["#/execs", "users", "Team"], ["#/targets", "target", "Targets"], ["#/more", "more", "More"]]
    : [["#/home", "home", "Home"], ["#/followups", "bell", "Follow-ups"], ["#/new", "plus", "New Lead", true], ["#/leads", "list", "My Leads"], ["#/profile", "user", "Profile"]];
}
function shell(title, sub, { back } = {}) {
  document.body.className = isAdmin() ? "admin" : "no-save";
  const h = location.hash || "#/home";
  $("#app").innerHTML = `
    <header class="topbar">
      ${back ? `<button class="back" onclick="history.length>1?history.back():location.hash='#/home'" aria-label="Back">←</button>` : `<img class="logo" src="/icon.svg" alt="">`}
      <div class="grow"><div class="t1 ellipsis">${esc(title)}</div><div class="t2 ellipsis">${esc(sub || "")}</div></div>
    </header>
    <nav class="nav">${navItems().map(([href, ic, label, fab]) => `<a href="${href}" class="${h.startsWith(href) ? "on" : ""} ${fab ? "fab" : ""}">${fab ? `<span class="c">${icon(ic)}</span>` : icon(ic)}<span>${label}</span></a>`).join("")}</nav>
    <main id="main"><div class="spinner"></div></main>`;
  if (!isAdmin()) $("#app").oncontextmenu = (e) => { if (e.target.tagName === "IMG") e.preventDefault(); };
  return $("#main");
}

/* ---------------- login ---------------- */
function renderLogin() {
  document.body.className = "";
  $("#app").innerHTML = `
  <div class="login"><div class="box">
    <div class="brand"><img src="/icon.svg" alt=""><h1>Solar Mitra Connect</h1><div class="muted">Field lead reporting</div></div>
    <form class="card stack" id="lf">
      <label class="f"><span>Mobile number</span><div class="prefix"><b>+91</b><input class="in" name="mobile" inputmode="numeric" maxlength="10" autocomplete="username" required placeholder="10-digit mobile"></div></label>
      <label class="f"><span>Password</span><input class="in" name="password" type="password" autocomplete="current-password" required></label>
      <div class="hint err" id="lerr"></div>
      <button class="btn primary block">Log in</button>
    </form>
    <p class="muted small" style="text-align:center;margin-top:16px">Forgot password? Ask your admin to reset it.</p>
  </div></div>`;
  $("#lf").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), btn = $("button", e.target);
    btn.disabled = true; $("#lerr").textContent = "";
    try {
      const r = await api("login", { method: "POST", body: { mobile: f.get("mobile"), password: f.get("password") } });
      setSession(r.token, r.user); if (location.hash === "#/home") render(); else location.hash = "#/home";
    } catch (err) { $("#lerr").textContent = err.message; btn.disabled = false; }
  };
}

/* ---------------- dashboard ---------------- */
const charts = [];
function killCharts() { while (charts.length) charts.pop().destroy(); }
async function renderDashboard(execMobile) {
  const admin = isAdmin();
  S.month = S.month || curMonth();
  const main = shell(execMobile ? "Executive dashboard" : admin ? "Team dashboard" : "My dashboard", admin ? S.user.name + " · Admin" : S.user.name, { back: !!execMobile });
  const q = `dashboard?month=${S.month}${execMobile ? "&exec=" + execMobile : ""}`;
  let d;
  try { d = await api(q); } catch (e) { main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (!main.isConnected) return;
  killCharts();
  const team = d.scope === "team";
  const T = d.target, A = d.achieved;
  const metric = (k, label) => {
    const t = Number(T[k]) || 0, a = A[k], p = pct(a, t);
    return `<div class="prog"><div class="top"><span class="b">${label}</span><span class="n">${a}<small> / ${t || "—"}</small> ${t ? `<small>· ${p}%</small>` : ""}</span></div><div class="bar"><i class="${p >= 100 ? "done" : ""}" style="width:${Math.min(100, p)}%"></i></div></div>`;
  };
  const elig = (k, label) => {
    const v = T[k] || "pending";
    const txt = v === "yes" ? "✓ Eligible" : v === "no" ? "✕ Not eligible" : "Pending review";
    return `<div class="e ${v}"><div class="k">${label}</div><div class="v">${txt}</div></div>`;
  };
  const stageRows = (obj) => {
    const tot = Object.values(obj).reduce((s, n) => s + n, 0) || 1;
    return S.stages.map((s) => { const [c] = STAGE_COLORS[s]; return `<div class="stage-row"><span>${stageChip(s)}</span><b>${obj[s] || 0}</b><div class="bar"><i style="width:${((obj[s] || 0) / tot) * 100}%;background:${c}"></i></div></div>`; }).join("");
  };
  const u = d.user;
  main.innerHTML = `
  <div class="stack">
    <div class="hello">
      <div><div class="muted small">${team ? `${d.activeCount} active executives` : execMobile ? esc(u.mobile) : "Namaste,"}</div><div class="h1">${team ? "All executives" : esc(u.name)}</div></div>
      <input type="month" class="month-in" id="mon" value="${S.month}" max="${curMonth()}">
    </div>
    ${team ? "" : `<div class="elig">${elig("salaryEligible", "Salary")}${elig("incentiveEligible", "Incentive")}</div>${T.note ? `<div class="card small"><b>Admin note:</b> ${esc(T.note)}</div>` : ""}`}
    <div class="cols">
      <div class="stack">
        <div class="card"><div class="row between" style="margin-bottom:12px"><h3>Target progress</h3><span class="muted small">${new Date(S.month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span></div>
          ${metric("leads", "New leads")}${metric("siteVisits", "Site visits")}${metric("registrations", "Registrations")}${metric("kw", "kW collected")}
          ${!T.leads && !T.siteVisits && !T.registrations && !T.kw ? `<div class="hint">No target set for this month yet.</div>` : ""}
        </div>
        <div class="card"><h3 style="margin-bottom:10px">Achievement vs target</h3><div class="chart-box"><canvas id="c1"></canvas></div></div>
        <div class="card"><h3 style="margin-bottom:10px">Leads per day</h3><div class="chart-box" style="height:170px"><canvas id="c2"></canvas></div></div>
      </div>
      <div class="stack">
        <div><div class="sec-title" style="margin-top:0">Follow-ups</div>
          <div class="stat3">
            <button class="stat red" data-go="overdue"><div class="n">${d.followups.overdue}</div><div class="k">Overdue</div></button>
            <button class="stat sun" data-go="today"><div class="n">${d.followups.today}</div><div class="k">Today</div></button>
            <button class="stat" data-go="upcoming"><div class="n">${d.followups.upcoming}</div><div class="k">Upcoming</div></button>
          </div></div>
        <div class="card">
          <div class="row between" style="margin-bottom:10px"><h3>Stage-wise leads</h3></div>
          <div class="tabs" id="stTabs" style="margin-bottom:8px"><button class="on" data-t="all">All leads (${d.totalLeads})</button><button data-t="month">This month (${A.leads})</button></div>
          <div id="stRows">${stageRows(d.stageAll)}</div>
        </div>
      </div>
    </div>
    ${team ? `<div class="card"><div class="row between" style="margin-bottom:6px"><h3>Executive performance</h3><span class="muted small">Tap a row for details</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Executive</th><th>Leads</th><th>Site visits</th><th>Regn.</th><th>kW</th><th>Overdue</th><th>Salary</th><th>Incentive</th></tr></thead><tbody>
      ${d.team.map((r) => {
        const cell = (k) => { const t = Number(r.target[k]) || 0, a = r.achieved[k], p = pct(a, t); return `${a}<span class="muted"> / ${t || "–"}</span>${t ? ` <span class="pct ${p >= 100 ? "good" : p >= 60 ? "mid" : "low"}">${p}%</span>` : ""}`; };
        const el = (v) => v === "yes" ? `<span class="chip" style="color:var(--green);background:var(--green-soft)">Yes</span>` : v === "no" ? `<span class="chip" style="color:var(--red);background:var(--red-soft)">No</span>` : `<span class="chip">Pending</span>`;
        return `<tr class="click ${r.user.active ? "" : "inactive"}" data-ex="${r.user.mobile}"><td><b>${esc(r.user.name)}</b><div class="tiny muted">${r.user.mobile}${r.user.active ? "" : " · inactive"}</div></td><td>${cell("leads")}</td><td>${cell("siteVisits")}</td><td>${cell("registrations")}</td><td>${cell("kw")}</td><td>${r.followups.overdue ? `<b style="color:var(--red)">${r.followups.overdue}</b>` : 0}</td><td>${el(r.target.salaryEligible)}</td><td>${el(r.target.incentiveEligible)}</td></tr>`;
      }).join("") || `<tr><td colspan="8" class="muted">No executives yet. Add them from the Team tab.</td></tr>`}
      </tbody></table></div></div>` : ""}
    ${execMobile ? `<div class="row wrap"><a class="btn" href="#/leads?exec=${execMobile}">${icon("list")} View leads</a><a class="btn" href="#/targets">${icon("target")} Edit target</a></div>` : ""}
  </div>`;
  $("#mon").onchange = (e) => { S.month = e.target.value || curMonth(); renderDashboard(execMobile); };
  $$("#stTabs button").forEach((b) => (b.onclick = () => { $$("#stTabs button").forEach((x) => x.classList.toggle("on", x === b)); $("#stRows").innerHTML = stageRows(b.dataset.t === "all" ? d.stageAll : d.stageMonth); }));
  $$("[data-go]").forEach((b) => (b.onclick = () => { location.hash = admin ? `#/leads?due=${b.dataset.go}${execMobile ? "&exec=" + execMobile : ""}` : `#/followups?tab=${b.dataset.go}`; }));
  $$("[data-ex]").forEach((r) => (r.onclick = () => (location.hash = "#/dash/" + r.dataset.ex)));
  drawCharts(d);
}
function drawCharts(d) {
  if (!window.Chart) { setTimeout(() => window.Chart && drawCharts(d), 600); return; }
  if (!$("#c1")) return;
  Chart.defaults.font.family = '"Plus Jakarta Sans", system-ui, sans-serif';
  Chart.defaults.color = "#6a7686";
  const labels = ["Leads", "Site visits", "Registrations", "kW"], keys = ["leads", "siteVisits", "registrations", "kw"];
  const hasT = keys.some((k) => d.target[k] > 0);
  const vals = keys.map((k) => hasT ? pct(d.achieved[k], d.target[k]) : d.achieved[k]);
  charts.push(new Chart($("#c1"), {
    type: "bar",
    data: { labels, datasets: [{ data: vals, backgroundColor: vals.map((v) => hasT ? (v >= 100 ? "#16a34a" : "#f5a524") : "#2f6fed"), borderRadius: 8, maxBarThickness: 46 }] },
    options: {
      maintainAspectRatio: false, animation: { duration: 400 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => hasT ? `${d.achieved[keys[c.dataIndex]]} of ${d.target[keys[c.dataIndex]] || 0} (${c.raw}%)` : `${c.raw}` } } },
      scales: { y: { beginAtZero: true, suggestedMax: hasT ? 100 : undefined, ticks: { callback: (v) => hasT ? v + "%" : v }, grid: { color: "#efece5" } }, x: { grid: { display: false } } },
    },
  }));
  charts.push(new Chart($("#c2"), {
    type: "line",
    data: { labels: d.daily.map((_, i) => i + 1), datasets: [{ data: d.daily, borderColor: "#f5a524", backgroundColor: "rgba(245,165,36,.15)", fill: true, tension: .25, pointRadius: 0, borderWidth: 2.5 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#efece5" } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } } } },
  }));
}

/* ---------------- leads list / follow-ups ---------------- */
function leadCard(l, { showExec } = {}) {
  return `<div class="card lead" data-id="${l.id}" style="cursor:pointer">
    <div class="row" style="align-items:flex-start">
      <div class="grow"><div class="nm ellipsis">${esc(l.name)}</div><div class="small muted">${esc(l.mobile)} · ${l.kw} kW${showExec ? " · " + esc(l.execName) : ""}</div></div>
      <a class="icon-btn" href="tel:${esc(l.mobile)}" onclick="event.stopPropagation()" aria-label="Call">${icon("phone")}</a>
    </div>
    <div class="cmt">${esc(l.comment)}</div>
    <div class="meta">${stageChip(l.stage)} ${dueLabel(l.nextFollowUp, l.stage)} <span>${fmtDT(l.updatedAt)}</span>${missingCount(l) ? `<span style="color:var(--sun-deep);font-weight:700">${missingCount(l)} photo(s) missing</span>` : ""}</div>
  </div>`;
}
const missingCount = (l) => SLOTS.filter(([k]) => !l.files?.[k]).length;
function bindCards(root) { $$("[data-id]", root).forEach((c) => (c.onclick = () => (location.hash = "#/lead/" + c.dataset.id))); }

async function renderFollowups(params) {
  const main = shell("Follow-ups", "Leads sorted by follow-up date");
  let data;
  try { data = await api("leads"); } catch (e) { main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (!main.isConnected) return;
  const t = istToday();
  const open = data.leads.filter((l) => l.stage !== "Not Interested" && l.nextFollowUp).sort((a, b) => a.nextFollowUp.localeCompare(b.nextFollowUp));
  const groups = { overdue: open.filter((l) => l.nextFollowUp < t), today: open.filter((l) => l.nextFollowUp === t), upcoming: open.filter((l) => l.nextFollowUp > t) };
  let tab = params.get("tab") || (groups.overdue.length ? "overdue" : "today");
  const draw = () => {
    main.innerHTML = `<div class="stack">
      <div class="tabs">${[["overdue", "Overdue"], ["today", "Today"], ["upcoming", "Upcoming"]].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${l}<span class="n ${k === "overdue" && groups[k].length ? "red" : ""}">${groups[k].length}</span></button>`).join("")}</div>
      ${groups[tab].map((l) => leadCard(l)).join("") || `<div class="empty"><div class="big">☀️</div>${tab === "overdue" ? "No overdue follow-ups. Great work!" : tab === "today" ? "Nothing due today." : "No upcoming follow-ups."}</div>`}
    </div>`;
    $$(".tabs button", main).forEach((b) => (b.onclick = () => { tab = b.dataset.t; history.replaceState(null, "", "#/followups?tab=" + tab); draw(); }));
    bindCards(main);
  };
  draw();
}

async function renderLeads(params) {
  const admin = isAdmin();
  const main = shell(admin ? "All leads" : "My leads", admin ? "Search, filter and review" : "All leads you have collected");
  let leads, execs = [];
  try {
    const [l, e] = await Promise.all([api("leads"), admin ? api("executives") : Promise.resolve({ users: [] })]);
    leads = l.leads; execs = e.users.filter((u) => u.role !== "admin");
  } catch (e) { main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (!main.isConnected) return;
  const f = { q: params.get("q") || "", stage: params.get("stage") || "", exec: params.get("exec") || "", due: params.get("due") || "" };
  const t = istToday();
  const draw = () => {
    const list = leads.filter((l) =>
      (!f.stage || l.stage === f.stage) && (!f.exec || l.exec === f.exec) &&
      (!f.q || (l.name + " " + l.mobile + " " + l.id + " " + (l.address || "")).toLowerCase().includes(f.q.toLowerCase())) &&
      (!f.due || (l.stage !== "Not Interested" && l.nextFollowUp && (f.due === "overdue" ? l.nextFollowUp < t : f.due === "today" ? l.nextFollowUp === t : l.nextFollowUp > t))));
    const counts = Object.fromEntries(S.stages.map((s) => [s, leads.filter((l) => (!f.exec || l.exec === f.exec) && l.stage === s).length]));
    $("#lst").innerHTML = `<div class="muted small" style="margin:0 2px 8px">${list.length} lead${list.length === 1 ? "" : "s"}${f.due ? ` · follow-up: ${f.due} <a href="#" id="clrDue">clear</a>` : ""}</div>
      <div class="stack grid-cards">${list.map((l) => leadCard(l, { showExec: admin })).join("") || `<div class="empty"><div class="big">🔍</div>No leads match.</div>`}</div>`;
    $("#pills").innerHTML = `<button data-s="" class="${!f.stage ? "on" : ""}">All</button>` + S.stages.map((s) => `<button data-s="${esc(s)}" class="${f.stage === s ? "on" : ""}">${esc(s)} (${counts[s]})</button>`).join("");
    $$("#pills button").forEach((b) => (b.onclick = () => { f.stage = b.dataset.s; draw(); }));
    $("#clrDue") && ($("#clrDue").onclick = (e) => { e.preventDefault(); f.due = ""; draw(); });
    bindCards($("#lst"));
  };
  main.innerHTML = `<div class="stack">
    <div class="row"><div class="grow prefix"><b style="left:12px">${icon("search").replace("<svg", '<svg width="18" height="18"')}</b><input class="in" id="q" placeholder="Search name, mobile, lead ID" value="${esc(f.q)}" style="padding-left:40px"></div>
    ${admin ? `<select class="in" id="ex" style="width:auto;max-width:44%"><option value="">All executives</option>${execs.map((u) => `<option value="${u.mobile}" ${f.exec === u.mobile ? "selected" : ""}>${esc(u.name)}</option>`).join("")}</select>` : ""}</div>
    <div class="pills" id="pills"></div>
    <div id="lst"></div></div>`;
  $("#q").oninput = (e) => { f.q = e.target.value; draw(); };
  $("#ex") && ($("#ex").onchange = (e) => { f.exec = e.target.value; draw(); });
  draw();
}

/* ---------------- photo slot widget ---------------- */
function slotHTML(key, label, { file, required, editable = true, accept = "image/*", capture = true } = {}) {
  const has = !!file;
  const isPdf = file?.type === "application/pdf";
  const inner = has
    ? (isPdf ? `<span class="pdf">${icon("file")}</span><span>PDF</span><span class="tiny muted ellipsis" style="max-width:90%">${esc(file.name || "")}</span>` : `<img src="${esc(file.preview || file.url)}" alt="">`) + `<span class="lbl">${esc(label)}</span>`
    : `${icon(key === "bill" ? "file" : key === "gps" ? "pin" : "camera")}<span>${esc(label)}</span><span class="tiny muted">${required ? "Required" : editable ? "Tap to add" : "Not uploaded"}</span>`;
  return `<div class="slot ${has ? "filled" : ""} ${required && !has ? "req" : ""}" data-slot="${key}">${inner}${editable && !has ? `<input type="file" accept="${accept}" ${capture ? 'capture="environment"' : ""}>` : ""}</div>`;
}

/* ---------------- new lead ---------------- */
function renderNewLead() {
  const main = shell("New lead", "Door-to-door visit report", { back: true });
  const files = {};
  startGPS();
  const today = istToday();
  main.innerHTML = `<form class="stack" id="nf" autocomplete="off">
    <div class="card stack">
      <h3>Customer details</h3>
      <label class="f"><span>Customer name <i>*</i></span><input class="in" name="name" required maxlength="100"></label>
      <label class="f"><span>Mobile number <i>*</i></span><div class="prefix"><b>+91</b><input class="in" name="mobile" inputmode="numeric" maxlength="10" required></div><div class="hint" id="dupHint"></div></label>
      <div class="grid2">
        <label class="f"><span>kW required <i>*</i></span><input class="in" name="kw" type="number" step="0.1" min="0.5" inputmode="decimal" required></label>
        <label class="f"><span>Village / Area</span><input class="in" name="address" maxlength="300"></label>
      </div>
    </div>
    <div class="card stack">
      <div class="row between"><h3>Bill & site photos</h3><span class="tiny muted">Photos are auto-stamped</span></div>
      <div id="gpsState" class="gps-state"><span class="dot-pulse"></span>Getting your location…</div>
      <div class="slots" id="slots"></div>
      <div class="hint">Electricity bill can be a photo or PDF. Site photos: stand at the site and face each direction.</div>
    </div>
    <div class="card stack">
      <h3>Lead status</h3>
      <label class="f"><span>Lead stage <i>*</i></span><select class="in" name="stage" required><option value="">Select stage</option>${S.stages.map((s) => `<option>${esc(s)}</option>`).join("")}</select></label>
      <label class="f"><span>Comment <i>*</i></span><textarea class="in" name="comment" required maxlength="2000" placeholder="What did the customer say? Roof type, monthly bill, concerns…"></textarea></label>
      <label class="f" id="fuWrap"><span>Next follow-up date <i>*</i></span><input class="in" name="nextFollowUp" type="date" min="${today}" value="${addDays(today, 2)}"></label>
    </div>
    <div class="hint err" id="nerr"></div>
    <button class="btn sun block" style="min-height:52px;font-size:16px">Submit lead</button>
  </form>`;
  const drawSlots = () => {
    $("#slots").innerHTML = SLOTS.map(([k, l]) => slotHTML(k, l, { file: files[k], required: k === "gps", accept: k === "bill" ? "image/*,application/pdf" : "image/*", capture: k !== "bill" })).join("");
    $$("#slots .slot").forEach((el) => {
      const k = el.dataset.slot, inp = $("input", el);
      el.onclick = (e) => {
        if (files[k]) { if (confirm(`Retake ${SLOTS.find((s) => s[0] === k)[1]}?`)) { delete files[k]; drawSlots(); } return; }
        if (e.target !== inp) inp?.click();
      };
      if (inp) inp.onchange = async () => {
        const file = inp.files[0]; if (!file) return;
        const b = busy("Processing photo…");
        try {
          if (file.type === "application/pdf") {
            if (file.size > 4.5 * 1024 * 1024) throw new Error("PDF too large (max 4.5 MB). Take a photo of the bill instead.");
            files[k] = { blob: file, type: file.type, name: file.name };
          } else {
            let gps = GPS.fix;
            if (k === "gps") { b.set("Waiting for GPS location…"); gps = await waitFix(); }
            files[k] = await processPhoto(file, { title: k === "bill" ? "" : k === "gps" ? "GPS photo" : SLOTS.find((s) => s[0] === k)[1], gps: k === "bill" ? null : gps, max: k === "bill" ? 2000 : 1600 });
          }
        } catch (err) { toast(err.message || "Could not read photo", true); }
        b.done(); drawSlots();
      };
    });
  };
  drawSlots();
  const gpsDraw = () => {
    const el = $("#gpsState"); if (!el) return stopGPS();
    if (GPS.fix) { el.className = "gps-state ok"; el.innerHTML = `${icon("pin").replace("<svg", '<svg width="16" height="16"')} Location locked · ±${Math.round(GPS.fix.acc)} m`; }
    else if (GPS.err) { el.className = "gps-state bad"; el.textContent = GPS.err; }
  };
  GPS.listeners.add(gpsDraw); gpsDraw();
  const form = $("#nf");
  form.stage.onchange = () => { const ni = form.stage.value === "Not Interested"; $("#fuWrap").style.display = ni ? "none" : ""; };
  form.mobile.oninput = (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10); };
  form.mobile.onblur = async () => {
    const m = form.mobile.value, h = $("#dupHint");
    h.className = "hint"; h.textContent = "";
    if (!/^[6-9]\d{9}$/.test(m)) { if (m) { h.className = "hint err"; h.textContent = "Enter a valid 10-digit mobile number."; } return; }
    try {
      const r = await api("check-mobile?m=" + m);
      if (r.exists) { h.className = "hint err"; h.innerHTML = r.byYou ? `You already added this customer. <a href="#/lead/${r.leadId}">Open lead</a>` : "This customer is already registered by another executive."; }
    } catch {}
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form));
    const err = $("#nerr"); err.textContent = "";
    if (!files.gps) { err.textContent = "Take the GPS photo before submitting."; return; }
    if (fd.stage === "Not Interested") fd.nextFollowUp = "";
    const missing = SLOTS.filter(([k]) => !files[k]).map((s) => s[1]);
    if (missing.length && fd.stage !== "Not Interested" && !confirm(`Missing: ${missing.join(", ")}.\nSubmit anyway? You can add them later from the lead.`)) return;
    const b = busy("Uploading…");
    try {
      const keys = Object.keys(files), up = {};
      for (let i = 0; i < keys.length; i++) { b.set(`Uploading ${i + 1} of ${keys.length}…`); up[keys[i]] = await uploadFile(files[keys[i]]); }
      b.set("Saving lead…");
      const r = await api("leads", { method: "POST", body: { ...fd, gps: GPS.fix, files: up } });
      b.done(); stopGPS(); toast("Lead saved ✓"); location.hash = "#/lead/" + r.lead.id;
    } catch (ex) { b.done(); err.textContent = ex.message; toast(ex.message, true); }
  };
}

/* ---------------- lead detail ---------------- */
async function renderLead(id) {
  const main = shell("Lead " + id, "", { back: true });
  let l;
  try { l = (await api("leads/" + id)).lead; } catch (e) { main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (!main.isConnected) return;
  const admin = isAdmin(), today = istToday();
  $(".topbar .t2").textContent = l.execName + " · " + fmtDate(l.createdAt);
  main.innerHTML = `<div class="cols"><div class="stack">
    <div class="card">
      <div class="row" style="align-items:flex-start"><div class="grow"><div class="h1">${esc(l.name)}</div><div class="muted">${esc(l.mobile)} · <b style="color:var(--ink)">${l.kw} kW</b>${l.address ? " · " + esc(l.address) : ""}</div></div></div>
      <div class="row wrap" style="margin-top:10px">${stageChip(l.stage)} ${dueLabel(l.nextFollowUp, l.stage)}</div>
      <div class="row" style="margin-top:14px">
        <a class="btn grow" href="tel:${esc(l.mobile)}">${icon("phone")} Call</a>
        ${l.gps ? `<a class="btn grow" target="_blank" rel="noopener" href="https://maps.google.com/?q=${l.gps.lat},${l.gps.lng}">${icon("pin")} Map</a>` : ""}
      </div>
      ${l.gps ? `<div class="tiny muted" style="margin-top:8px">GPS ${l.gps.lat.toFixed(5)}, ${l.gps.lng.toFixed(5)} · ±${Math.round(l.gps.acc || 0)} m · ${fmtDT(l.gps.at)}</div>` : ""}
    </div>
    <div class="card"><div class="row between" style="margin-bottom:10px"><h3>Bill & photos</h3><span class="tiny muted">${6 - missingCount(l)}/6 uploaded</span></div><div class="slots" id="dslots"></div></div>
    ${admin ? `<button class="btn danger block" id="del">Delete lead</button>` : ""}
  </div><div class="stack">
    <form class="card stack" id="fu">
      <h3>Add follow-up</h3>
      <label class="f"><span>Update stage <i>*</i></span><select class="in" name="stage">${S.stages.map((s) => `<option ${s === l.stage ? "selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
      <label class="f"><span>Fresh comment <i>*</i></span><textarea class="in" name="comment" required maxlength="2000" placeholder="What happened on this follow-up?"></textarea></label>
      <label class="f" id="fuW"><span>Next follow-up date <i>*</i></span><input class="in" type="date" name="nextFollowUp" min="${today}" value="${l.nextFollowUp && l.nextFollowUp > today ? l.nextFollowUp : addDays(today, 3)}"></label>
      <button class="btn primary block">Save follow-up</button>
    </form>
    <div class="card"><h3 style="margin-bottom:14px">History (${l.history.length})</h3><div class="tl">
      ${[...l.history].reverse().map((h) => `<div class="it"><div class="row wrap" style="gap:6px">${stageChip(h.stage)}<span class="tiny muted">${fmtDT(h.at)} · ${esc(h.byName)}</span></div><div class="c">${esc(h.comment)}</div>${h.nextFollowUp ? `<div class="tiny muted" style="margin-top:4px">Next follow-up: ${fmtDate(h.nextFollowUp)}</div>` : ""}</div>`).join("")}
    </div></div>
  </div></div>`;
  const drawSlots = () => {
    $("#dslots").innerHTML = SLOTS.map(([k, lab]) => slotHTML(k, lab, { file: l.files[k], editable: admin || !l.files[k], accept: k === "bill" ? "image/*,application/pdf" : "image/*", capture: k !== "bill" })).join("");
    $$("#dslots .slot").forEach((el) => {
      const k = el.dataset.slot, f = l.files[k], inp = $("input", el);
      el.onclick = (e) => {
        if (f) { if (f.type === "application/pdf") window.open(f.url, "_blank"); else viewImage(f.url); return; }
        if (e.target !== inp) inp?.click();
      };
      if (inp) inp.onchange = async () => {
        const file = inp.files[0]; if (!file) return;
        const b = busy("Uploading…");
        try {
          let pf;
          if (file.type === "application/pdf") pf = { blob: file, type: file.type, name: file.name };
          else {
            let gps = null;
            if (k !== "bill") { startGPS(); try { gps = await waitFix(k === "gps" ? 20000 : 6000); } catch (er) { if (k === "gps") throw er; } }
            pf = await processPhoto(file, { title: k === "bill" ? "" : SLOTS.find((s) => s[0] === k)[1], gps });
          }
          const up = await uploadFile(pf);
          l = (await api(`leads/${l.id}/files`, { method: "PUT", body: { slot: k, file: up } })).lead;
          toast("Photo added ✓"); drawSlots();
        } catch (er) { toast(er.message, true); }
        b.done();
      };
    });
  };
  drawSlots();
  const fu = $("#fu");
  const syncFu = () => ($("#fuW").style.display = fu.stage.value === "Not Interested" ? "none" : "");
  fu.stage.onchange = syncFu; syncFu();
  fu.onsubmit = async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(fu));
    if (d.stage === "Not Interested") d.nextFollowUp = "";
    const btn = $("button", fu); btn.disabled = true;
    try { await api(`leads/${l.id}/followup`, { method: "POST", body: d }); toast("Follow-up saved ✓"); renderLead(l.id); }
    catch (er) { toast(er.message, true); btn.disabled = false; }
  };
  $("#del") && ($("#del").onclick = async () => {
    if (!confirm(`Delete lead ${l.id} (${l.name}) and all its photos? This cannot be undone.`)) return;
    try { await api("leads/" + l.id, { method: "DELETE" }); toast("Lead deleted"); location.hash = "#/leads"; } catch (er) { toast(er.message, true); }
  });
}

/* ---------------- profile ---------------- */
const PROFILE_FIELDS = [
  ["Personal", [["fatherName", "Father's / Spouse name"], ["dob", "Date of birth", "date"], ["gender", "Gender", "select:,Male,Female,Other"], ["email", "Email", "email"]]],
  ["Address", [["address", "Full address", "textarea"], ["city", "City / Town"], ["district", "District"], ["state", "State"], ["pincode", "PIN code", "numeric"]]],
  ["Work", [["area", "Assigned area / territory"], ["joiningDate", "Joining date", "date"]]],
  ["KYC", [["aadhaar", "Aadhaar number", "numeric"], ["pan", "PAN"]]],
  ["Bank (for salary)", [["bankName", "Bank name"], ["bankAccount", "Account number", "numeric"], ["ifsc", "IFSC code"]]],
  ["Emergency contact", [["emergencyName", "Name"], ["emergencyMobile", "Mobile", "numeric"]]],
  ["Other", [["notes", "Notes", "textarea"]]],
];
function profileView(u) {
  const p = u.profile || {};
  return PROFILE_FIELDS.map(([sec, fields]) => {
    const rows = fields.filter(([k]) => p[k]).map(([k, l, t]) => `<dt>${esc(l)}</dt><dd>${t === "date" ? fmtDate(p[k]) : k === "aadhaar" ? "XXXX XXXX " + esc(p[k].slice(-4)) : esc(p[k])}</dd>`).join("");
    return rows ? `<div class="sec-title">${sec}</div><div class="card"><dl class="kv" style="margin:0">${rows}</dl></div>` : "";
  }).join("") || `<div class="card muted small">Profile details not filled yet. Admin can add them.</div>`;
}
async function renderProfile() {
  const main = shell("Profile", S.user.name);
  let u;
  try { u = (await api("me")).user; setSession(S.token, u); } catch (e) { main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (!main.isConnected) return;
  main.innerHTML = `<div class="stack">
    <div class="card row"><div class="av" style="width:60px;height:60px;font-size:20px">${u.photo?.url ? `<img src="${esc(u.photo.url)}" alt="">` : initials(u.name)}</div>
      <div class="grow"><div class="h1">${esc(u.name)}</div><div class="muted">+91 ${esc(u.mobile)} · ${u.role === "admin" ? "Admin" : "Solar Mitra"}</div></div></div>
    ${profileView(u)}
    <div class="sec-title">Account</div>
    <div class="card stack">
      <button class="btn block" id="chpw">Change password</button>
      <button class="btn danger block" id="lo">Log out</button>
    </div></div>`;
  $("#lo").onclick = () => confirm("Log out?") && logout();
  $("#chpw").onclick = changePassword;
}
function changePassword() {
  const m = modal("Change password", `<form class="stack" id="pw">
    <label class="f"><span>Current password</span><input class="in" type="password" name="current" required></label>
    <label class="f"><span>New password (min 6 characters)</span><input class="in" type="password" name="next" minlength="6" required></label>
    <button class="btn primary block">Update password</button></form>`);
  $("#pw", m).onsubmit = async (e) => {
    e.preventDefault();
    try { const r = await api("me/password", { method: "POST", body: Object.fromEntries(new FormData(e.target)) }); setSession(r.token, S.user); closeModal(); toast("Password updated ✓"); }
    catch (er) { toast(er.message, true); }
  };
}

/* ---------------- admin: executives ---------------- */
async function renderExecs() {
  const main = shell("Team", "Create and manage executives");
  let users;
  try { users = (await api("executives")).users; } catch (e) { main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (!main.isConnected) return;
  const execs = users.filter((u) => u.role !== "admin"), admins = users.filter((u) => u.role === "admin");
  const card = (u) => `<div class="card ${u.active ? "" : "inactive"}" data-m="${u.mobile}">
    <div class="row"><div class="av">${u.photo?.url ? `<img src="${esc(u.photo.url)}" alt="">` : initials(u.name)}</div>
      <div class="grow"><div class="b ellipsis">${esc(u.name)}</div><div class="small muted ellipsis">${u.mobile}${u.profile?.area ? " · " + esc(u.profile.area) : ""}</div></div>
      ${u.mobile === S.user.mobile ? `<span class="chip">You</span>` : `<label class="switch" title="Active / Inactive"><input type="checkbox" data-act ${u.active ? "checked" : ""}><i></i></label>`}</div>
    <div class="row wrap" style="margin-top:12px;gap:8px">
      <span class="chip" style="${u.active ? "color:var(--green);background:var(--green-soft)" : "color:var(--red);background:var(--red-soft)"}">${u.active ? "Active" : "Inactive"}</span>
      <span class="tiny muted grow">${u.lastLogin ? "Last login " + fmtDT(u.lastLogin) : "Never logged in"}</span>
      ${u.role !== "admin" ? `<a class="btn sm" href="#/dash/${u.mobile}">Dashboard</a>` : ""}
      <button class="btn sm" data-edit>Edit</button>
    </div></div>`;
  main.innerHTML = `<div class="stack">
    <button class="btn sun block" id="add">${icon("plus")} Add executive</button>
    <div class="sec-title">Executives (${execs.length})</div>
    <div class="stack grid-cards">${execs.map(card).join("") || `<div class="empty">No executives yet.</div>`}</div>
    <div class="sec-title">Admins (${admins.length})</div>
    <div class="stack grid-cards">${admins.map(card).join("")}</div></div>`;
  $("#add").onclick = () => execForm();
  $$("[data-m]", main).forEach((el) => {
    const u = users.find((x) => x.mobile === el.dataset.m);
    $("[data-edit]", el).onclick = () => execForm(u);
    const sw = $("[data-act]", el);
    if (sw) sw.onchange = async () => {
      const on = sw.checked;
      if (!on && !confirm(`Deactivate ${u.name}? They will be logged out and can't log in until reactivated. Their leads stay safe.`)) { sw.checked = true; return; }
      try { await api("executives/" + u.mobile, { method: "PUT", body: { active: on } }); toast(on ? "Activated ✓" : "Deactivated"); renderExecs(); }
      catch (er) { toast(er.message, true); sw.checked = !on; }
    };
  });
}
function execForm(u) {
  const edit = !!u, p = u?.profile || {};
  let photo = u?.photo || null, photoNew = null;
  const field = ([k, l, t = "text"]) => {
    const v = esc(p[k] || "");
    if (t === "textarea") return `<label class="f"><span>${l}</span><textarea class="in" name="p_${k}" style="min-height:70px">${v}</textarea></label>`;
    if (t.startsWith("select:")) return `<label class="f"><span>${l}</span><select class="in" name="p_${k}">${t.slice(7).split(",").map((o) => `<option ${o === p[k] ? "selected" : ""} value="${o}">${o || "Select"}</option>`).join("")}</select></label>`;
    return `<label class="f"><span>${l}</span><input class="in" name="p_${k}" ${t === "numeric" ? 'inputmode="numeric"' : `type="${t}"`} value="${v}"></label>`;
  };
  const m = modal(edit ? "Edit " + u.name : "New executive", `<form class="stack" id="ef">
    <div class="card stack">
      <div class="row"><div class="av" id="pv" style="width:64px;height:64px;cursor:pointer">${photo?.url ? `<img src="${esc(photo.url)}">` : icon("camera")}</div><div class="small muted grow">Tap to add profile photo</div><input type="file" accept="image/*" id="pf" hidden></div>
      <label class="f"><span>Full name <i>*</i></span><input class="in" name="name" required value="${esc(u?.name || "")}"></label>
      <label class="f"><span>Mobile number (login ID) <i>*</i></span><div class="prefix"><b>+91</b><input class="in" name="mobile" inputmode="numeric" maxlength="10" required value="${esc(u?.mobile || "")}" ${edit ? "disabled" : ""}></div></label>
      <label class="f"><span>${edit ? "Reset password (leave blank to keep)" : "Password <i>*</i>"}</span><input class="in" name="password" type="text" minlength="6" ${edit ? "" : "required"} placeholder="${edit ? "New password" : "Min 6 characters"}" autocomplete="new-password"></label>
      ${!edit || u.mobile !== S.user.mobile ? `<label class="f"><span>Role</span><select class="in" name="role"><option value="executive">Executive (Solar Mitra)</option><option value="admin" ${u?.role === "admin" ? "selected" : ""}>Admin</option></select></label>` : ""}
    </div>
    ${PROFILE_FIELDS.map(([sec, fs]) => `<div class="sec-title" style="margin-top:6px">${sec}</div><div class="card stack">${fs.map(field).join("")}</div>`).join("")}
    <button class="btn primary block" style="min-height:50px">${edit ? "Save changes" : "Create executive"}</button></form>`, { wide: true });
  $("#pv", m).onclick = () => $("#pf", m).click();
  $("#pf", m).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    photoNew = await processPhoto(f, { max: 600 });
    $("#pv", m).innerHTML = `<img src="${photoNew.preview}">`;
  };
  $("#ef", m).onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target), profile = {};
    PROFILE_FIELDS.forEach(([, fs]) => fs.forEach(([k]) => (profile[k] = fd.get("p_" + k) || "")));
    const btn = $("button.primary", m); btn.disabled = true;
    try {
      if (photoNew) photo = await uploadFile(photoNew);
      const body = { name: fd.get("name"), profile, photo: photo ? { key: photo.key, type: photo.type, name: photo.name } : null };
      if (fd.get("role")) body.role = fd.get("role");
      if (fd.get("password")) body.password = fd.get("password");
      if (edit) await api("executives/" + u.mobile, { method: "PUT", body });
      else await api("executives", { method: "POST", body: { ...body, mobile: fd.get("mobile") } });
      closeModal(); toast(edit ? "Saved ✓" : "Executive created ✓"); renderExecs();
    } catch (er) { toast(er.message, true); btn.disabled = false; }
  };
}

/* ---------------- admin: targets ---------------- */
async function renderTargets() {
  S.month = S.month || curMonth();
  const main = shell("Targets & eligibility", "Set monthly targets for each executive");
  let d;
  try { d = await api("dashboard?month=" + S.month); } catch (e) { main.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (!main.isConnected) return;
  const rows = d.team.filter((r) => r.user.active);
  const nextMonth = (() => { const [y, mo] = curMonth().split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; })();
  main.innerHTML = `<div class="stack">
    <div class="row between"><div class="muted small">Achievements update live as leads come in.</div><input type="month" class="month-in" id="mon" value="${S.month}" max="${nextMonth}"></div>
    <button class="btn block" id="copy">Copy targets from previous month</button>
    <div class="stack grid-cards">${rows.map((r) => {
      const t = r.target, a = r.achieved;
      const inp = (k, l) => `<label class="f"><span>${l}</span><input class="in" type="number" min="0" step="${k === "kw" ? "0.5" : "1"}" name="${k}" value="${t[k] || ""}" placeholder="0"><div class="ach">Done: <b>${a[k]}</b>${t[k] ? ` · ${pct(a[k], t[k])}%` : ""}</div></label>`;
      const sel = (k, l, sug) => `<label class="f"><span>${l}</span><select class="in" name="${k}">${[["pending", "Pending"], ["yes", "Eligible"], ["no", "Not eligible"]].map(([v, x]) => `<option value="${v}" ${t[k] === v ? "selected" : ""}>${x}</option>`).join("")}</select><div class="hint">${sug}</div></label>`;
      const salSug = t.leads ? (a.leads >= t.leads ? "✓ Lead target met" : `${t.leads - a.leads} leads short`) : "Set lead target";
      const incSug = t.registrations ? (a.registrations >= t.registrations ? "✓ Registration target met" : `${t.registrations - a.registrations} registrations short`) : "Set registration target";
      return `<form class="card stack" data-m="${r.user.mobile}">
        <div class="row"><div class="av">${initials(r.user.name)}</div><div class="grow"><div class="b">${esc(r.user.name)}</div><div class="small muted">${r.user.mobile}</div></div></div>
        <div class="tgt-grid">${inp("leads", "Leads")}${inp("siteVisits", "Site visits")}${inp("registrations", "Registrations")}${inp("kw", "kW")}</div>
        <div class="grid2">${sel("salaryEligible", "Salary", salSug)}${sel("incentiveEligible", "Incentive", incSug)}</div>
        <label class="f"><span>Note to executive</span><input class="in" name="note" value="${esc(t.note || "")}" maxlength="500" placeholder="Optional"></label>
        <button class="btn primary block">Save</button></form>`;
    }).join("") || `<div class="empty">No active executives.</div>`}</div></div>`;
  $("#mon").onchange = (e) => { S.month = e.target.value || curMonth(); renderTargets(); };
  $$("form[data-m]", main).forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("button", f); btn.disabled = true;
    try { await api("targets", { method: "PUT", body: { ...Object.fromEntries(new FormData(f)), mobile: f.dataset.m, month: S.month } }); toast("Target saved ✓"); btn.textContent = "Saved ✓"; setTimeout(() => { btn.textContent = "Save"; btn.disabled = false; }, 1500); }
    catch (er) { toast(er.message, true); btn.disabled = false; }
  }));
  $("#copy").onclick = async () => {
    const [y, mo] = S.month.split("-").map(Number);
    const prev = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
    try {
      const { targets } = await api("targets?month=" + prev);
      if (!targets.length) return toast("No targets in " + prev, true);
      let n = 0;
      for (const t of targets) if (rows.find((r) => r.user.mobile === t.mobile)) { await api("targets", { method: "PUT", body: { mobile: t.mobile, month: S.month, leads: t.leads, siteVisits: t.siteVisits, registrations: t.registrations, kw: t.kw } }); n++; }
      toast(`Copied ${n} targets ✓`); renderTargets();
    } catch (er) { toast(er.message, true); }
  };
}

/* ---------------- admin: more (export + account) ---------------- */
async function renderMore() {
  const main = shell("More", "Download data & account");
  let execs = [];
  try { execs = (await api("executives")).users.filter((u) => u.role !== "admin"); } catch {}
  if (!main.isConnected) return;
  main.innerHTML = `<div class="stack">
    <div class="sec-title" style="margin-top:0">Download data</div>
    <form class="card stack" id="ex1">
      <h3>Leads report</h3><div class="muted small">All lead details, latest comment, follow-up history, GPS and photo links. Opens in Excel / Google Sheets.</div>
      <label class="f"><span>Executive</span><select class="in" name="exec"><option value="">All executives</option>${execs.map((u) => `<option value="${u.mobile}">${esc(u.name)}</option>`).join("")}</select></label>
      <div class="grid2"><label class="f"><span>From date</span><input class="in" type="date" name="from"></label><label class="f"><span>To date</span><input class="in" type="date" name="to"></label></div>
      <button class="btn sun block">${icon("download")} Download leads (CSV)</button>
    </form>
    <form class="card stack" id="ex2">
      <h3>Performance report</h3><div class="muted small">Target vs achieved, salary and incentive eligibility for each executive.</div>
      <label class="f"><span>Month</span><input class="in" type="month" name="month" value="${S.month || curMonth()}"></label>
      <button class="btn sun block">${icon("download")} Download performance (CSV)</button>
    </form>
    <div class="sec-title">Account</div>
    <div class="card stack"><div class="row"><div class="av">${initials(S.user.name)}</div><div class="grow"><div class="b">${esc(S.user.name)}</div><div class="small muted">+91 ${S.user.mobile} · Admin</div></div></div>
      <button class="btn block" id="chpw">Change password</button><button class="btn danger block" id="lo">Log out</button></div>
  </div>`;
  const dl = async (qs, fallback) => {
    const b = busy("Preparing file…");
    try {
      const r = await fetch("/api/export?" + qs, { headers: { authorization: "Bearer " + S.token } });
      if (!r.ok) throw new Error((await r.json()).error);
      const name = (r.headers.get("content-disposition") || "").match(/filename="(.+?)"/)?.[1] || fallback;
      const a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob()); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      toast("Downloaded ✓");
    } catch (er) { toast(er.message || "Download failed", true); }
    b.done();
  };
  $("#ex1").onsubmit = (e) => { e.preventDefault(); dl("type=leads&" + new URLSearchParams(new FormData(e.target)), "leads.csv"); };
  $("#ex2").onsubmit = (e) => { e.preventDefault(); dl("type=performance&" + new URLSearchParams(new FormData(e.target)), "performance.csv"); };
  $("#chpw").onclick = changePassword;
  $("#lo").onclick = () => confirm("Log out?") && logout();
}

/* ---------------- router ---------------- */
function render() {
  closeModal(); killCharts();
  if (!S.token || !S.user) return renderLogin();
  const [path, qs] = (location.hash.slice(1) || "/home").split("?");
  const params = new URLSearchParams(qs || "");
  const seg = path.split("/").filter(Boolean);
  const r = seg[0] || "home";
  if (r !== "new") stopGPS();
  window.scrollTo(0, 0);
  if (r === "home") return renderDashboard();
  if (r === "lead" && seg[1]) return renderLead(seg[1]);
  if (r === "leads") return renderLeads(params);
  if (r === "profile") return renderProfile();
  if (isAdmin()) {
    if (r === "dash" && seg[1]) return renderDashboard(seg[1]);
    if (r === "execs") return renderExecs();
    if (r === "targets") return renderTargets();
    if (r === "more") return renderMore();
  } else {
    if (r === "followups") return renderFollowups(params);
    if (r === "new") return renderNewLead();
  }
  location.hash = "#/home";
}
window.addEventListener("hashchange", render);
render();
