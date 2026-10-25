// Local test server: serves public/ and runs the API against an in-memory store.
// Usage: APP_SECRET=x ADMIN_MOBILE=9999999999 ADMIN_PASSWORD=admin123 node test/server.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import handler, { setStore } from "../netlify/functions/api.mjs";

const mem = new Map();
setStore({
  async get(k, o) { const v = mem.get(k); if (!v) return null; return o?.type === "json" ? JSON.parse(v.data) : v.data; },
  async setJSON(k, v) { mem.set(k, { data: JSON.stringify(v), metadata: {} }); },
  async set(k, data, o) { mem.set(k, { data, metadata: o?.metadata || {} }); },
  async getWithMetadata(k) { const v = mem.get(k); return v ? { data: v.data, metadata: v.metadata } : null; },
  async list({ prefix }) { return { blobs: [...mem.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
  async delete(k) { mem.delete(k); },
});

const root = path.resolve("public");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json" };
http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await handler(new Request("http://localhost:" + PORT + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  let p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, "index.html");
  res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(process.env.PORT || 8888);
const PORT = process.env.PORT || 8888;
console.log("listening on " + PORT);
