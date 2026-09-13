// 保存先の切り替え。SUPABASE_URL と SUPABASE_KEY（環境変数 or ~/.config/secrets.env）があれば Supabase、無ければローカルのJSONファイル
const fs = require("fs");
const path = require("path");
const { envFromSecrets } = require("./_llm");

const FILE = process.env.VERCEL ? "/tmp/wikis.json" : path.join(__dirname, "..", "data", "wikis.json");
const TABLE = "wikis";

function supabase() {
  const url = envFromSecrets("SUPABASE_URL"), key = envFromSecrets("SUPABASE_KEY");
  if (!url || !key) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
  return {
    kind: "supabase",
    async get(uid) {
      const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${TABLE}?uid=eq.${encodeURIComponent(uid)}&select=uid,name,wiki,transcript,history,saved_at`, { headers });
      if (!r.ok) throw new Error(`supabase get ${r.status}`);
      const rows = await r.json();
      if (!rows.length) return null;
      const x = rows[0];
      return { name: x.name, wiki: x.wiki, transcript: x.transcript || [], history: x.history || [], savedAt: x.saved_at };
    },
    async put(uid, rec) {
      const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${TABLE}`, {
        method: "POST",
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{ uid, name: rec.name, wiki: rec.wiki, transcript: rec.transcript, history: rec.history, saved_at: rec.savedAt }]),
      });
      if (!r.ok) throw new Error(`supabase put ${r.status}: ${await r.text()}`);
    },
    async exists(uid) { return !!(await this.get(uid)); },
  };
}

function file() {
  const readAll = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (_) { return {}; } };
  const writeAll = (all) => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(all, null, 1)); };
  return {
    kind: "file",
    async get(uid) { return readAll()[uid] || null; },
    async put(uid, rec) { const all = readAll(); all[uid] = rec; writeAll(all); },
    async exists(uid) { return !!readAll()[uid]; },
    readAll,
  };
}

function db() { return supabase() || file(); }
module.exports = { db, file, supabase, FILE };
