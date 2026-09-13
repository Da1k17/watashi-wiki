// ローカル起動用。public/ を配信し、/api/<name> を api/<name>.js に渡す（Vercelの関数と同じ形）
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3456);
const PUB = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

// 公開URLでの使いすぎ防止: AI呼び出しはIPごと・全体で回数制限、入力の長さも制限
const AI_ENDPOINTS = new Set(["interview", "generate", "suggest", "intuition", "rewrite", "followup"]);
const LIMITS = { aiPerIp: { max: 120, windowMs: 10 * 60 * 1000 }, aiGlobal: { max: 800, windowMs: 60 * 60 * 1000 }, otherPerIp: { max: 600, windowMs: 10 * 60 * 1000 } };
const buckets = new Map();
function hit(key, lim) {
  const now = Date.now(); let b = buckets.get(key);
  if (!b || now - b.start > lim.windowMs) { b = { start: now, n: 0 }; buckets.set(key, b); }
  b.n++; return b.n <= lim.max;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now - b.start > 60 * 60 * 1000) buckets.delete(k); }, 10 * 60 * 1000).unref();
function clientIp(req) {
  return (req.headers["cf-connecting-ip"] || (req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket.remoteAddress || "?").trim();
}
const cut = (v, n) => (typeof v === "string" ? v.slice(0, n) : v);
function sanitize(body) {
  if (!body || typeof body !== "object") return {};
  const b = { ...body };
  if (typeof b.name === "string") b.name = cut(b.name, 40);
  if (typeof b.wiki === "string") b.wiki = cut(b.wiki, 12000);
  if (typeof b.tag === "string") b.tag = cut(b.tag, 30);
  if (typeof b.rough === "string") b.rough = cut(b.rough, 300);
  if (Array.isArray(b.transcript)) b.transcript = b.transcript.slice(0, 12).map((t) => ({ topic: cut(String(t.topic || ""), 12), question: cut(String(t.question || ""), 200), answer: cut(String(t.answer || ""), 400) }));
  if (Array.isArray(b.swipes)) b.swipes = b.swipes.slice(0, 20).map((x) => ({ text: cut(String(x.text || ""), 60), answer: cut(String(x.answer || ""), 6), ms: Number(x.ms) || 0 }));
  if (Array.isArray(b.history)) b.history = b.history.slice(-50);
  return b;
}

function shim(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z_]/g, "");
    if (!name || name.startsWith("_") || !fs.existsSync(path.join(__dirname, "api", name + ".js"))) { res.statusCode = 404; return res.end("not found"); }
    const ip = clientIp(req);
    if (AI_ENDPOINTS.has(name)) {
      if (!hit("ai:" + ip, LIMITS.aiPerIp) || !hit("ai:global", LIMITS.aiGlobal)) return shim(res).status(429).json({ error: "混み合っています。しばらく待ってからもう一度お試しください。" });
    } else if (!hit("o:" + ip, LIMITS.otherPerIp)) { return shim(res).status(429).json({ error: "しばらく待ってからもう一度お試しください。" }); }
    let body = ""; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 512 * 1024) { res.statusCode = 413; return res.end("too large"); } body += chunk; }
    try { req.body = sanitize(body ? JSON.parse(body) : {}); } catch (_) { req.body = {}; }
    try {
      const handler = require(`./api/${name}.js`);
      return await handler(req, shim(res));
    } catch (e) {
      console.error(e);
      return shim(res).status(500).json({ error: e.message });
    }
  }
  let p = (url.pathname === "/" || url.pathname.startsWith("/wiki/")) ? "/index.html" : url.pathname;
  const file = path.join(PUB, path.normalize(p));
  if (!file.startsWith(PUB) || !fs.existsSync(file)) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`わたしのWiki: http://localhost:${PORT}`));
