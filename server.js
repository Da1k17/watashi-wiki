// ローカル起動用。public/ を配信し、/api/<name> を api/<name>.js に渡す（Vercelの関数と同じ形）
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3456);
const PUB = path.join(__dirname, "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

function shim(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader("content-type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z_]/g, "");
    let body = "";
    for await (const chunk of req) body += chunk;
    try { req.body = body ? JSON.parse(body) : {}; } catch (_) { req.body = {}; }
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
