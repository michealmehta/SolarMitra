// Solar Mitra Connect — single API function for Netlify.
// Storage: Netlify Blobs (no external database needed).
// Required environment variables (Netlify > Site configuration > Environment variables):
//   APP_SECRET      long random string used to sign logins and photo links
//   ADMIN_MOBILE    10-digit mobile number of the first admin
//   ADMIN_PASSWORD  password for that admin (change it after first login)
//   ADMIN_NAME      optional, display name of the first admin

import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

export const config = { path: "/api/*" };

export const STAGES = [
  "Interested",
  "Not Interested",
  "Site Visit",
  "Registration Process",
  "Loan Process",
  "Interested but Discom Problem",
  "Interested but Other Problem",
];
// How far down the funnel a stage is. Used to count site visits / registrations.
const RANK = { "Site Visit": 2, "Registration Process": 3, "Loan Process": 4 };
const FILE_SLOTS = ["bill", "north", "east", "west", "south", "gps"];
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_UPLOAD = 5 * 1024 * 1024;
const TOKEN_DAYS = 30;

/* ---------------- storage ---------------- */
let _store = null;
export function setStore(s) { _store = s; } // used by local tests
const db = () => _store || (_store = getStore({ name: "solar-mitra", consistency: "strong" }));
const getJSON = (k) => db().get(k, { type: "json" });
const putJSON = (k, v) => db().setJSON(k, v);
async function listKeys(prefix) {
  const { blobs } = await db().list({ prefix });
  return blobs.map((b) => b.key);
}
async function getMany(keys) {
  const out = [];
  for (let i = 0; i < keys.length; i += 40) {
    const chunk = await Promise.all(keys.slice(i, i + 40).map((k) => getJSON(k)));
    out.push(...chunk.filter(Boolean));
  }
  return out;
}

/* ---------------- helpers ---------------- */
const env = (k) => (globalThis.Netlify?.env?.get?.(k) ?? process.env[k] ?? "").trim();
function secret() {
  const s = env("APP_SECRET");
  if (!s) throw httpError(500, "Server not configured: set APP_SECRET in Netlify environment variables.");
  return s;
}
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const hmac = (s) => crypto.createHmac("sha256", secret()).update(s).digest("base64url");
const cleanMobile = (m) => String(m || "").replace(/\D/g, "").slice(-10);
const validMobile = (m) => /^[6-9]\d{9}$/.test(m);
const str = (v, max = 500) => String(v ?? "").trim().slice(0, max);

const istFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const istDate = (d = new Date()) => istFmt.format(new Date(d));
const istMonth = (d = new Date()) => istDate(d).slice(0, 7);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(pw), salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}
function checkPassword(pw, stored) {
  if (!stored) return false;
  const [, salt, hash] = stored.split("$");
  const test = crypto.scryptSync(String(pw), salt, 32);
  const want = Buffer.from(hash, "hex");
  return want.length === test.length && crypto.timingSafeEqual(want, test);
}
function makeToken(u) {
  const body = Buffer.from(JSON.stringify({ m: u.mobile, r: u.role, v: u.tokenVersion || 0, exp: Date.now() + TOKEN_DAYS * 864e5 })).toString("base64url");
  return `${body}.${hmac("tok:" + body)}`;
}
function readToken(t) {
  const [body, sig] = String(t || "").split(".");
  if (!body || !sig || hmac("tok:" + body) !== sig) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  return p.exp > Date.now() ? p : null;
}
const fileSig = (k) => hmac("file:" + k).slice(0, 32);
const fileUrl = (k) => `/api/file?k=${encodeURIComponent(k)}&s=${fileSig(k)}`;

const publicUser = (u) => {
  if (!u) return null;
  const { passHash, tokenVersion, ...rest } = u;
  if (rest.photo?.key) rest.photo = { ...rest.photo, url: fileUrl(rest.photo.key) };
  return rest;
};
function decorateLead(l) {
  const files = {};
  for (const s of FILE_SLOTS) if (l.files?.[s]?.key) files[s] = { ...l.files[s], url: fileUrl(l.files[s].key) };
  return { ...l, files };
}

async function ensureFirstAdmin() {
  const m = cleanMobile(env("ADMIN_MOBILE"));
  const pw = env("ADMIN_PASSWORD");
  if (!validMobile(m) || !pw) return;
  if (await getJSON(`users/${m}`)) return;
  await putJSON(`users/${m}`, {
    mobile: m, name: env("ADMIN_NAME") || "Admin", role: "admin", active: true,
    passHash: hashPassword(pw), createdAt: new Date().toISOString(), profile: {},
  });
}

async function auth(req) {
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const p = readToken(t);
  if (!p) throw httpError(401, "Please log in again.");
  const u = await getJSON(`users/${p.m}`);
  if (!u || (u.tokenVersion || 0) !== p.v) throw httpError(401, "Please log in again.");
  if (!u.active) throw httpError(403, "Your account is inactive. Contact admin.");
  return u;
}
const requireAdmin = (u) => { if (u.role !== "admin") throw httpError(403, "Admin only."); };

/* ---------------- leads ---------------- */
async function allLeads(execMobile) {
  const keys = await listKeys(execMobile ? `leads/${execMobile}/` : "leads/");
  return getMany(keys);
}
async function findLead(id) {
  const exec = await getJSON(`leadidx/${id}`);
  if (!exec) throw httpError(404, "Lead not found.");
  const l = await getJSON(`leads/${exec.exec}/${id}`);
  if (!l) throw httpError(404, "Lead not found.");
  return l;
}
function canSee(u, l) { if (u.role !== "admin" && l.exec !== u.mobile) throw httpError(403, "Not your lead."); }

function cleanFile(f) {
  if (!f || !f.key || !String(f.key).startsWith("files/")) return null;
  return { key: str(f.key, 200), type: str(f.type, 60), name: str(f.name, 120), at: f.at || new Date().toISOString() };
}

/* ---------------- metrics ---------------- */
function computeStats(leads, month, today = istDate()) {
  const inMonth = (iso) => iso && istMonth(iso) === month;
  const monthLeads = leads.filter((l) => inMonth(l.createdAt));
  let siteVisits = 0, registrations = 0;
  for (const l of leads) {
    let best = 0;
    for (const h of l.history || []) if (inMonth(h.at)) best = Math.max(best, RANK[h.stage] || 0);
    if (best >= 2) siteVisits++;
    if (best >= 3) registrations++;
  }
  const kw = monthLeads.reduce((s, l) => s + (Number(l.kw) || 0), 0);
  const stageAll = Object.fromEntries(STAGES.map((s) => [s, 0]));
  const stageMonth = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const l of leads) stageAll[l.stage] = (stageAll[l.stage] || 0) + 1;
  for (const l of monthLeads) stageMonth[l.stage] = (stageMonth[l.stage] || 0) + 1;
  // daily new leads for the month
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const daily = Array(days).fill(0);
  for (const l of monthLeads) daily[Number(istDate(l.createdAt).slice(8, 10)) - 1]++;
  const open = leads.filter((l) => l.stage !== "Not Interested" && l.nextFollowUp);
  return {
    achieved: { leads: monthLeads.length, siteVisits, registrations, kw: Math.round(kw * 100) / 100 },
    stageAll, stageMonth, daily, totalLeads: leads.length,
    followups: {
      overdue: open.filter((l) => l.nextFollowUp < today).length,
      today: open.filter((l) => l.nextFollowUp === today).length,
      upcoming: open.filter((l) => l.nextFollowUp > today).length,
    },
  };
}
const emptyTarget = (mobile, month) => ({ mobile, month, leads: 0, siteVisits: 0, registrations: 0, kw: 0, salaryEligible: "pending", incentiveEligible: "pending", note: "" });

/* ---------------- CSV ---------------- */
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCSV = (rows) => "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
const istStamp = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "";

/* ---------------- router ---------------- */
async function route(req) {
  const url = new URL(req.url);
  const origin = url.origin;
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const [a, b, c] = parts;
  const M = req.method;
  const body = async () => { try { return await req.json(); } catch { return {}; } };

  // ---------- public ----------
  if (a === "login" && M === "POST") {
    await ensureFirstAdmin();
    const { mobile, password } = await body();
    const m = cleanMobile(mobile);
    const u = await getJSON(`users/${m}`);
    if (!u || !checkPassword(password, u.passHash)) throw httpError(401, "Wrong mobile number or password.");
    if (!u.active) throw httpError(403, "Your account is inactive. Contact admin.");
    await putJSON(`users/${m}`, { ...u, lastLogin: new Date().toISOString() });
    return json({ token: makeToken(u), user: publicUser(u) });
  }
  if (a === "file" && M === "GET") {
    const k = url.searchParams.get("k") || "";
    if (!k.startsWith("files/") || url.searchParams.get("s") !== fileSig(k)) throw httpError(403, "Invalid link.");
    const r = await db().getWithMetadata(k, { type: "arrayBuffer" });
    if (!r) throw httpError(404, "File not found.");
    const name = (r.metadata?.name || "file").replace(/[^\w.\- ]/g, "_");
    return new Response(r.data, { headers: {
      "content-type": r.metadata?.type || "application/octet-stream",
      "content-disposition": `inline; filename="${name}"`,
      "cache-control": "private, max-age=31536000, immutable",
    } });
  }
  if (a === "meta") return json({ stages: STAGES, today: istDate(), month: istMonth() });

  // ---------- signed in ----------
  const me = await auth(req);

  if (a === "me" && M === "GET") return json({ user: publicUser(me) });
  if (a === "me" && b === "password" && M === "POST") {
    const { current, next } = await body();
    if (!checkPassword(current, me.passHash)) throw httpError(400, "Current password is wrong.");
    if (String(next || "").length < 6) throw httpError(400, "New password must be at least 6 characters.");
    const u = { ...me, passHash: hashPassword(next), tokenVersion: (me.tokenVersion || 0) + 1 };
    await putJSON(`users/${me.mobile}`, u);
    return json({ token: makeToken(u) });
  }

  if (a === "upload" && M === "POST") {
    const type = (req.headers.get("content-type") || "").split(";")[0].trim();
    if (!ALLOWED_TYPES.includes(type)) throw httpError(400, "Only JPG, PNG, WEBP images or PDF files are allowed.");
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) throw httpError(400, "Empty file.");
    if (buf.byteLength > MAX_UPLOAD) throw httpError(400, "File is too large (max 5 MB).");
    const name = str(decodeURIComponent(req.headers.get("x-file-name") || "file"), 120);
    const key = `files/${me.mobile}/${istDate()}/${crypto.randomUUID()}`;
    await db().set(key, buf, { metadata: { type, name, by: me.mobile, size: buf.byteLength } });
    return json({ key, type, name, url: fileUrl(key) });
  }

  if (a === "check-mobile" && M === "GET") {
    const m = cleanMobile(url.searchParams.get("m"));
    const hit = await getJSON(`cust/${m}`);
    if (!hit) return json({ exists: false });
    return json({ exists: true, byYou: hit.exec === me.mobile, execName: me.role === "admin" || hit.exec === me.mobile ? hit.execName : "another executive", leadId: hit.exec === me.mobile || me.role === "admin" ? hit.id : null });
  }

  // ----- leads -----
  if (a === "leads" && !b && M === "GET") {
    let exec = me.role === "admin" ? cleanMobile(url.searchParams.get("exec")) : me.mobile;
    const leads = await allLeads(exec || null);
    leads.sort((x, y) => (y.updatedAt || "").localeCompare(x.updatedAt || ""));
    return json({ leads: leads.map(decorateLead), today: istDate() });
  }
  if (a === "leads" && !b && M === "POST") {
    const d = await body();
    const name = str(d.name, 100), mobile = cleanMobile(d.mobile), kw = Number(d.kw);
    if (!name) throw httpError(400, "Customer name is required.");
    if (!validMobile(mobile)) throw httpError(400, "Enter a valid 10-digit customer mobile number.");
    if (!(kw > 0 && kw < 10000)) throw httpError(400, "Enter kW required.");
    if (!STAGES.includes(d.stage)) throw httpError(400, "Select a lead stage.");
    if (!str(d.comment)) throw httpError(400, "Comment is required.");
    if (d.stage !== "Not Interested" && !/^\d{4}-\d{2}-\d{2}$/.test(d.nextFollowUp || "")) throw httpError(400, "Select next follow-up date.");
    const files = {};
    for (const s of FILE_SLOTS) { const f = cleanFile(d.files?.[s]); if (f) files[s] = f; }
    if (!files.gps) throw httpError(400, "GPS photo is required.");
    const dup = await getJSON(`cust/${mobile}`);
    if (dup) throw httpError(409, dup.exec === me.mobile ? `You already added this customer (Lead ${dup.id}).` : "This customer mobile is already registered by another executive.");
    const now = new Date().toISOString();
    const id = `SM-${istDate().replace(/-/g, "").slice(2)}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const gps = d.gps && isFinite(d.gps.lat) && isFinite(d.gps.lng)
      ? { lat: Number(d.gps.lat), lng: Number(d.gps.lng), acc: Number(d.gps.acc) || null, at: d.gps.at || now } : null;
    const lead = {
      id, exec: me.mobile, execName: me.name, createdAt: now, updatedAt: now,
      name, mobile, kw, address: str(d.address, 300), gps, files,
      stage: d.stage, comment: str(d.comment, 2000), nextFollowUp: d.stage === "Not Interested" ? (d.nextFollowUp || "") : d.nextFollowUp,
      history: [{ at: now, by: me.mobile, byName: me.name, stage: d.stage, comment: str(d.comment, 2000), nextFollowUp: d.nextFollowUp || "" }],
    };
    await putJSON(`leads/${me.mobile}/${id}`, lead);
    await putJSON(`leadidx/${id}`, { exec: me.mobile });
    await putJSON(`cust/${mobile}`, { id, exec: me.mobile, execName: me.name, at: now });
    return json({ lead: decorateLead(lead) }, 201);
  }
  if (a === "leads" && b && !c && M === "GET") {
    const l = await findLead(b); canSee(me, l);
    return json({ lead: decorateLead(l) });
  }
  if (a === "leads" && b && c === "followup" && M === "POST") {
    const l = await findLead(b); canSee(me, l);
    const d = await body();
    if (!STAGES.includes(d.stage)) throw httpError(400, "Select a lead stage.");
    if (!str(d.comment)) throw httpError(400, "Write a fresh comment.");
    if (d.stage !== "Not Interested" && !/^\d{4}-\d{2}-\d{2}$/.test(d.nextFollowUp || "")) throw httpError(400, "Select next follow-up date.");
    const now = new Date().toISOString();
    const entry = { at: now, by: me.mobile, byName: me.name, stage: d.stage, comment: str(d.comment, 2000), nextFollowUp: d.nextFollowUp || "" };
    const upd = { ...l, stage: d.stage, comment: entry.comment, nextFollowUp: entry.nextFollowUp, updatedAt: now, history: [...(l.history || []), entry] };
    await putJSON(`leads/${l.exec}/${l.id}`, upd);
    return json({ lead: decorateLead(upd) });
  }
  if (a === "leads" && b && c === "files" && M === "PUT") {
    const l = await findLead(b); canSee(me, l);
    const { slot, file } = await body();
    if (!FILE_SLOTS.includes(slot)) throw httpError(400, "Unknown photo slot.");
    if (l.files?.[slot] && me.role !== "admin") throw httpError(403, "This photo is already uploaded. Ask admin to replace it.");
    const f = cleanFile(file); if (!f) throw httpError(400, "Upload the file first.");
    const upd = { ...l, files: { ...(l.files || {}), [slot]: f }, updatedAt: new Date().toISOString() };
    await putJSON(`leads/${l.exec}/${l.id}`, upd);
    return json({ lead: decorateLead(upd) });
  }
  if (a === "leads" && b && !c && M === "DELETE") {
    requireAdmin(me);
    const l = await findLead(b);
    await Promise.all([
      db().delete(`leads/${l.exec}/${l.id}`), db().delete(`leadidx/${l.id}`),
      db().delete(`cust/${l.mobile}`),
      ...Object.values(l.files || {}).map((f) => db().delete(f.key)),
    ]);
    return json({ ok: true });
  }

  // ----- dashboard -----
  if (a === "dashboard" && M === "GET") {
    const month = /^\d{4}-\d{2}$/.test(url.searchParams.get("month") || "") ? url.searchParams.get("month") : istMonth();
    let exec = me.role === "admin" ? cleanMobile(url.searchParams.get("exec")) : me.mobile;
    if (exec) {
      const u = exec === me.mobile ? me : await getJSON(`users/${exec}`);
      if (!u) throw httpError(404, "Executive not found.");
      const leads = await allLeads(exec);
      const target = (await getJSON(`targets/${month}/${exec}`)) || emptyTarget(exec, month);
      return json({ month, scope: "exec", user: publicUser(u), target, ...computeStats(leads, month) });
    }
    // admin, whole team
    const [leads, users, tKeys] = await Promise.all([allLeads(null), getMany(await listKeys("users/")), listKeys(`targets/${month}/`)]);
    const targets = await getMany(tKeys);
    const execs = users.filter((u) => u.role !== "admin");
    const sum = (k) => targets.filter((t) => execs.find((e) => e.mobile === t.mobile && e.active)).reduce((s, t) => s + (Number(t[k]) || 0), 0);
    const team = execs.map((u) => {
      const t = targets.find((x) => x.mobile === u.mobile) || emptyTarget(u.mobile, month);
      const st = computeStats(leads.filter((l) => l.exec === u.mobile), month);
      return { user: publicUser(u), target: t, achieved: st.achieved, followups: st.followups, totalLeads: st.totalLeads };
    }).sort((x, y) => y.achieved.leads - x.achieved.leads);
    return json({
      month, scope: "team",
      target: { leads: sum("leads"), siteVisits: sum("siteVisits"), registrations: sum("registrations"), kw: sum("kw") },
      team, activeCount: execs.filter((e) => e.active).length, ...computeStats(leads, month),
    });
  }

  // ---------- admin only below ----------
  requireAdmin(me);

  if (a === "executives" && !b && M === "GET") {
    const users = await getMany(await listKeys("users/"));
    users.sort((x, y) => (x.name || "").localeCompare(y.name || ""));
    return json({ users: users.map(publicUser) });
  }
  if (a === "executives" && !b && M === "POST") {
    const d = await body();
    const mobile = cleanMobile(d.mobile);
    if (!validMobile(mobile)) throw httpError(400, "Enter a valid 10-digit mobile number.");
    if (!str(d.name)) throw httpError(400, "Name is required.");
    if (String(d.password || "").length < 6) throw httpError(400, "Password must be at least 6 characters.");
    if (await getJSON(`users/${mobile}`)) throw httpError(409, "An account with this mobile number already exists.");
    const u = {
      mobile, name: str(d.name, 100), role: d.role === "admin" ? "admin" : "executive", active: d.active !== false,
      passHash: hashPassword(d.password), createdAt: new Date().toISOString(), createdBy: me.mobile,
      profile: cleanProfile(d.profile), photo: cleanFile(d.photo),
    };
    await putJSON(`users/${mobile}`, u);
    return json({ user: publicUser(u) }, 201);
  }
  if (a === "executives" && b && M === "PUT") {
    const mobile = cleanMobile(b);
    const u = await getJSON(`users/${mobile}`);
    if (!u) throw httpError(404, "Executive not found.");
    const d = await body();
    const upd = { ...u };
    if (d.name !== undefined) upd.name = str(d.name, 100) || u.name;
    if (d.profile !== undefined) upd.profile = cleanProfile(d.profile);
    if (d.photo !== undefined) upd.photo = cleanFile(d.photo);
    if (d.role !== undefined && mobile !== me.mobile) upd.role = d.role === "admin" ? "admin" : "executive";
    if (d.active !== undefined) {
      if (mobile === me.mobile && !d.active) throw httpError(400, "You cannot deactivate yourself.");
      upd.active = !!d.active;
      upd.tokenVersion = (u.tokenVersion || 0) + (d.active ? 0 : 1); // log out immediately
    }
    if (d.password) {
      if (String(d.password).length < 6) throw httpError(400, "Password must be at least 6 characters.");
      upd.passHash = hashPassword(d.password);
      upd.tokenVersion = (upd.tokenVersion || 0) + 1;
    }
    upd.updatedAt = new Date().toISOString();
    await putJSON(`users/${mobile}`, upd);
    return json({ user: publicUser(upd) });
  }

  if (a === "targets" && M === "GET") {
    const month = url.searchParams.get("month") || istMonth();
    const targets = await getMany(await listKeys(`targets/${month}/`));
    return json({ month, targets });
  }
  if (a === "targets" && M === "PUT") {
    const d = await body();
    const mobile = cleanMobile(d.mobile);
    if (!/^\d{4}-\d{2}$/.test(d.month || "")) throw httpError(400, "Month is required.");
    if (!(await getJSON(`users/${mobile}`))) throw httpError(404, "Executive not found.");
    const el = (v) => (["yes", "no", "pending"].includes(v) ? v : "pending");
    const n = (v) => Math.max(0, Number(v) || 0);
    const t = {
      mobile, month: d.month, leads: n(d.leads), siteVisits: n(d.siteVisits), registrations: n(d.registrations), kw: n(d.kw),
      salaryEligible: el(d.salaryEligible), incentiveEligible: el(d.incentiveEligible), note: str(d.note, 500),
      updatedAt: new Date().toISOString(), updatedBy: me.mobile,
    };
    await putJSON(`targets/${d.month}/${mobile}`, t);
    return json({ target: t });
  }

  if (a === "export" && M === "GET") {
    const kind = url.searchParams.get("type") || "leads";
    const month = url.searchParams.get("month") || "";
    const exec = cleanMobile(url.searchParams.get("exec"));
    const from = url.searchParams.get("from") || "", to = url.searchParams.get("to") || "";
    const abs = (k) => (k ? origin + fileUrl(k) : "");
    let rows, fname;
    if (kind === "performance") {
      const m = /^\d{4}-\d{2}$/.test(month) ? month : istMonth();
      const [leads, users, targets] = await Promise.all([allLeads(null), getMany(await listKeys("users/")), getMany(await listKeys(`targets/${m}/`))]);
      rows = [["Month", "Executive", "Mobile", "Status", "Leads Target", "Leads Done", "Site Visit Target", "Site Visits Done", "Registration Target", "Registrations Done", "kW Target", "kW Done", "Salary Eligible", "Incentive Eligible", "Admin Note", "Total Leads (all time)", "Overdue Follow-ups"]];
      for (const u of users.filter((x) => x.role !== "admin")) {
        const t = targets.find((x) => x.mobile === u.mobile) || emptyTarget(u.mobile, m);
        const s = computeStats(leads.filter((l) => l.exec === u.mobile), m);
        rows.push([m, u.name, u.mobile, u.active ? "Active" : "Inactive", t.leads, s.achieved.leads, t.siteVisits, s.achieved.siteVisits, t.registrations, s.achieved.registrations, t.kw, s.achieved.kw, t.salaryEligible, t.incentiveEligible, t.note, s.totalLeads, s.followups.overdue]);
      }
      fname = `performance-${m}.csv`;
    } else {
      let leads = await allLeads(exec || null);
      leads = leads.filter((l) => {
        const d = istDate(l.createdAt);
        return (!from || d >= from) && (!to || d <= to) && (!month || d.slice(0, 7) === month);
      }).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
      rows = [["Lead ID", "Created (IST)", "Executive", "Executive Mobile", "Customer Name", "Customer Mobile", "Address", "kW Required", "Current Stage", "Latest Comment", "Next Follow-up", "Follow-ups Count", "Last Updated (IST)", "GPS Latitude", "GPS Longitude", "Map Link", "Electricity Bill", "North Photo", "East Photo", "West Photo", "South Photo", "GPS Photo", "Full History"]];
      for (const l of leads) {
        const f = l.files || {};
        rows.push([l.id, istStamp(l.createdAt), l.execName, l.exec, l.name, l.mobile, l.address, l.kw, l.stage, l.comment, l.nextFollowUp, (l.history || []).length, istStamp(l.updatedAt),
          l.gps?.lat ?? "", l.gps?.lng ?? "", l.gps ? `https://maps.google.com/?q=${l.gps.lat},${l.gps.lng}` : "",
          abs(f.bill?.key), abs(f.north?.key), abs(f.east?.key), abs(f.west?.key), abs(f.south?.key), abs(f.gps?.key),
          (l.history || []).map((h) => `[${istStamp(h.at)}] ${h.byName}: ${h.stage} — ${h.comment}${h.nextFollowUp ? ` (next: ${h.nextFollowUp})` : ""}`).join(" | ")]);
      }
      fname = `leads${exec ? "-" + exec : ""}${month ? "-" + month : ""}-${istDate()}.csv`;
    }
    return new Response(toCSV(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${fname}"`, "cache-control": "no-store" } });
  }

  throw httpError(404, "Not found.");
}

function cleanProfile(p = {}) {
  const keys = ["email", "dob", "gender", "fatherName", "address", "city", "district", "state", "pincode", "area", "joiningDate", "aadhaar", "pan", "bankName", "bankAccount", "ifsc", "emergencyName", "emergencyMobile", "notes"];
  return Object.fromEntries(keys.map((k) => [k, str(p[k], k === "address" || k === "notes" ? 500 : 120)]));
}

export default async (req) => {
  try {
    return await route(req);
  } catch (e) {
    if (!e.status) console.error(e);
    return json({ error: e.status ? e.message : "Something went wrong. Please try again." }, e.status || 500);
  }
};
