// End-to-end API test against the local server.
const B = "http://localhost:" + (process.env.PORT || 8888);
let ok = 0, fail = 0;
const t = (name, cond) => { if (cond) ok++; else { fail++; console.log("FAIL:", name); } };
async function call(path, { method = "GET", token, body, raw, type } = {}) {
  const h = {};
  if (token) h.authorization = "Bearer " + token;
  if (body) h["content-type"] = "application/json";
  if (raw) { h["content-type"] = type; h["x-file-name"] = "test.jpg"; }
  const r = await fetch(B + path, { method, headers: h, body: raw || (body && JSON.stringify(body)) });
  const ct = r.headers.get("content-type") || "";
  return { status: r.status, data: ct.includes("json") ? await r.json() : await r.text() };
}

const bad = await call("/api/login", { method: "POST", body: { mobile: "9999999999", password: "x" } });
t("wrong password rejected", bad.status === 401);
const adm = await call("/api/login", { method: "POST", body: { mobile: "9999999999", password: "admin123" } });
t("admin login", adm.status === 200 && adm.data.user.role === "admin");
const A = adm.data.token;

const ex = await call("/api/executives", { method: "POST", token: A, body: { name: "Ravi Kumar", mobile: "9876543210", password: "ravi123", profile: { area: "Lucknow East", city: "Lucknow" } } });
t("create exec", ex.status === 201 && ex.data.user.profile.area === "Lucknow East" && !ex.data.user.passHash);
await call("/api/executives", { method: "POST", token: A, body: { name: "Sita Devi", mobile: "9876500000", password: "sita123" } });

const el = await call("/api/login", { method: "POST", body: { mobile: "9876543210", password: "ravi123" } });
t("exec login", el.status === 200);
const E = el.data.token;
t("exec blocked from admin", (await call("/api/executives", { token: E })).status === 403);
t("exec blocked from export", (await call("/api/export", { token: E })).status === 403);

const up = await call("/api/upload", { method: "POST", token: E, raw: new Uint8Array([255, 216, 255, 1, 2, 3]), type: "image/jpeg" });
t("upload", up.status === 200 && up.data.key.startsWith("files/9876543210/"));
const fileRes = await fetch(B + up.data.url);
t("signed file fetch", fileRes.status === 200 && (await fileRes.arrayBuffer()).byteLength === 6);
t("bad signature", (await fetch(B + up.data.url.replace(/s=.*/, "s=nope"))).status === 403);
t("exe upload refused", (await call("/api/upload", { method: "POST", token: E, raw: new Uint8Array([1]), type: "application/x-msdownload" })).status === 400);

const today = new Date().toISOString().slice(0, 10);
const noGps = await call("/api/leads", { method: "POST", token: E, body: { name: "Mr Sharma", mobile: "9123456780", kw: 3, stage: "Interested", comment: "Wants 3kW", nextFollowUp: today } });
t("gps required", noGps.status === 400);
const lead = await call("/api/leads", { method: "POST", token: E, body: { name: "Mr Sharma", mobile: "9123456780", kw: 3, stage: "Interested", comment: "Wants 3kW", nextFollowUp: today, gps: { lat: 26.85, lng: 80.95, acc: 12 }, files: { gps: up.data, north: up.data } } });
t("create lead", lead.status === 201 && lead.data.lead.files.gps.url);
const id = lead.data.lead.id;
const dup = await call("/api/leads", { method: "POST", token: E, body: { name: "X", mobile: "9123456780", kw: 2, stage: "Interested", comment: "c", nextFollowUp: today, files: { gps: up.data } } });
t("duplicate customer blocked", dup.status === 409);

const fu = await call(`/api/leads/${id}/followup`, { method: "POST", token: E, body: { stage: "Site Visit", comment: "Visited roof", nextFollowUp: today } });
t("follow-up", fu.status === 200 && fu.data.lead.history.length === 2);
await call(`/api/leads/${id}/followup`, { method: "POST", token: E, body: { stage: "Registration Process", comment: "Docs collected", nextFollowUp: today } });
const slot = await call(`/api/leads/${id}/files`, { method: "PUT", token: E, body: { slot: "east", file: up.data } });
t("add missing photo", slot.status === 200 && slot.data.lead.files.east);
t("cannot replace photo", (await call(`/api/leads/${id}/files`, { method: "PUT", token: E, body: { slot: "east", file: up.data } })).status === 403);

const se = await call("/api/login", { method: "POST", body: { mobile: "9876500000", password: "sita123" } });
t("other exec cannot see lead", (await call(`/api/leads/${id}`, { token: se.data.token })).status === 403);
t("other exec list empty", (await call("/api/leads", { token: se.data.token })).data.leads.length === 0);

const month = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
const tg = await call("/api/targets", { method: "PUT", token: A, body: { mobile: "9876543210", month, leads: 30, siteVisits: 10, registrations: 5, kw: 60, salaryEligible: "yes" } });
t("set target", tg.status === 200);
const dash = await call("/api/dashboard", { token: E });
t("exec dashboard", dash.data.target.leads === 30 && dash.data.achieved.leads === 1 && dash.data.achieved.siteVisits === 1 && dash.data.achieved.registrations === 1 && dash.data.achieved.kw === 3 && dash.data.target.salaryEligible === "yes");
const td = await call("/api/dashboard", { token: A });
t("team dashboard", td.data.scope === "team" && td.data.team.length === 2 && td.data.target.leads === 30);

const csv = await call("/api/export?type=leads", { token: A });
t("leads csv", csv.status === 200 && csv.data.includes("Mr Sharma") && csv.data.includes("/api/file?k="));
const perf = await call(`/api/export?type=performance&month=${month}`, { token: A });
t("performance csv", perf.data.includes("Ravi Kumar"));

const off = await call("/api/executives/9876543210", { method: "PUT", token: A, body: { active: false } });
t("deactivate", off.status === 200 && off.data.user.active === false);
t("inactive token revoked", (await call("/api/leads", { token: E })).status === 401);
t("inactive login blocked", (await call("/api/login", { method: "POST", body: { mobile: "9876543210", password: "ravi123" } })).status === 403);
await call("/api/executives/9876543210", { method: "PUT", token: A, body: { active: true } });
t("reactivated login", (await call("/api/login", { method: "POST", body: { mobile: "9876543210", password: "ravi123" } })).status === 200);

t("admin delete lead", (await call(`/api/leads/${id}`, { method: "DELETE", token: A })).status === 200);
t("customer mobile freed", (await call("/api/check-mobile?m=9123456780", { token: A })).data.exists === false);

console.log(`${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
