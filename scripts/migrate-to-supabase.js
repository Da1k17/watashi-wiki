// ローカルの data/wikis.json を Supabase に移行する。SUPABASE_URL / SUPABASE_KEY が必要
const { supabase, file } = require("../api/_db");
(async () => {
  const sb = supabase(); if (!sb) { console.error("SUPABASE_URL / SUPABASE_KEY が見つかりません"); process.exit(1); }
  const all = file().readAll(); let n = 0;
  for (const [uid, rec] of Object.entries(all)) { await sb.put(uid, rec); n++; console.log("moved", uid); }
  console.log(`done: ${n} records`);
})().catch((e) => { console.error(e.message); process.exit(1); });
