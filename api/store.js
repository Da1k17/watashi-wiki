// Wikiの保存と取得。POST {uid?, name, wiki, transcript, history} → {uid} / GET ?uid=xxx → 保存内容
// 保存先は api/_db.js が決める（Supabase があればそちら、無ければローカルのJSONファイル）
const { db } = require("./_db");

async function newUid(store) {
  const c = "abcdefghjkmnpqrstuvwxyz23456789";
  for (let i = 0; i < 20; i++) {
    const u = Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join("");
    if (!(await store.exists(u))) return u;
  }
  throw new Error("uid generation failed");
}

module.exports = async (req, res) => {
  const store = db();
  if (req.method === "GET") {
    const uid = new URL(req.url, "http://x").searchParams.get("uid") || "";
    const rec = await store.get(uid);
    if (!rec) return res.status(404).json({ error: "not found" });
    return res.status(200).json({ uid, ...rec, storage: store.kind });
  }
  const b = req.body || {};
  if (!b.wiki) return res.status(400).json({ error: "wiki required" });
  const uid = (b.uid && /^[a-z0-9]{4,12}$/.test(b.uid)) ? b.uid : await newUid(store);
  await store.put(uid, { name: b.name || "", wiki: b.wiki, transcript: b.transcript || [], history: b.history || [], savedAt: new Date().toISOString() });
  return res.status(200).json({ uid, storage: store.kind });
};
