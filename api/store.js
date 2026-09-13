// Wikiの保存と取得。POST {uid?, name, wiki, transcript, history} → {uid} / GET ?uid=xxx → 保存内容
// ローカルMVP用にJSONファイルへ保存（Vercel等では永続化されないので、公開時はDBに置き換える）
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "..", "data", "wikis.json");

function readAll() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (_) { return {}; } }
function writeAll(all) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(all, null, 1)); }
function newUid(all) { const c = "abcdefghjkmnpqrstuvwxyz23456789"; let u; do { u = Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join(""); } while (all[u]); return u; }

module.exports = async (req, res) => {
  const all = readAll();
  if (req.method === "GET") {
    const uid = new URL(req.url, "http://x").searchParams.get("uid") || "";
    const rec = all[uid];
    if (!rec) return res.status(404).json({ error: "not found" });
    return res.status(200).json({ uid, ...rec });
  }
  const b = req.body || {};
  if (!b.wiki) return res.status(400).json({ error: "wiki required" });
  const uid = (b.uid && /^[a-z0-9]{4,12}$/.test(b.uid)) ? b.uid : newUid(all);
  all[uid] = { name: b.name || "", wiki: b.wiki, transcript: b.transcript || [], history: b.history || [], savedAt: new Date().toISOString() };
  writeAll(all);
  return res.status(200).json({ uid });
};
