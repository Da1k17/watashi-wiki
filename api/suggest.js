// 興味タグ → 質問サジェスト。mode: "self"(本人が聞きたいこと) / "other"(この人に聞くなら)
const { complete, extractJson } = require("./_llm");

const SYSTEM = `あなたは質問づくりの名人です。Wikiとタグを受け取り、質問を3つ作ります。出力はJSONのみ: {"questions":["","",""]}
mode=self: 本人がAIや詳しい人に聞くと役に立つ、具体的な質問。Wikiの状況（年代・暮らし・気になっていること）を織り込む。敬体、各45字以内。
mode=other: 初対面の人がこの人に聞くと会話が深まる質問。答えやすいもの→少し深いものの順。詮索にならない。各30字以内。`;

function fallback(mode, tag, wiki) {
  const clean = (t) => (t || "").replace(/［[^］]*］/g, "").trim();
  const ki = clean((wiki.match(/## 気になっていること\n([^\n]+)/) || [])[1]);
  if (mode === "other") return [
    `${tag}は、いつから・どんなきっかけで？`,
    `${tag}で最近いちばん良かったことは？`,
    `${tag}について、次にやってみたいことは？`,
  ];
  return [
    `${tag}について、私の状況で最初に確かめるべきことは何ですか？${ki ? "（" + ki + "）" : ""}`,
    `${tag}を今年、小さく始めるならどこからがよいですか？`,
    `${tag}にかけているお金と時間を見直すなら、どこからですか？`,
  ];
}

module.exports = async (req, res) => {
  const { wiki = "", tag = "", mode = "self" } = req.body || {};
  const tpl = fallback(mode, tag, wiki);
  try {
    const r = await complete(SYSTEM, `mode=${mode}\nタグ: ${tag}\n【Wiki】\n${wiki}`, 500);
    if (!r.text) return res.status(200).json({ questions: tpl, backend: "template" });
    try { const j = extractJson(r.text); return res.status(200).json({ questions: (j.questions || []).slice(0, 3), backend: r.backend }); }
    catch (_) { return res.status(200).json({ questions: tpl, backend: r.backend + "-fallback" }); }
  } catch (e) {
    return res.status(200).json({ questions: tpl, backend: "template", error: e.message });
  }
};
