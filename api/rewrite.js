// Wiki + ざっくりした聞きたいこと → 整えた質問文 + 答え
const { complete, extractJson } = require("./_llm");

const SYSTEM = `あなたは「質問を整える人」です。本人のWikiと、ざっくりした聞きたいことを受け取り、
(1) 本人の状況を織り込んだ具体的な質問文（2〜3文、敬体）と、(2) その質問への答え を作ります。
答えのルール: 平易・短く（3〜5文）・専門用語なし・断定しない・必要なら「専門家に相談を」と添える・Wikiにない状況を勝手に足さない。
出力はJSONのみ: {"question":"...","answer":"..."}`;

function fallback(category, rough, wiki) {
  const clean = (t) => (t || "").replace(/［[^］]*］/g, "").trim();
  const sec = (h) => clean((wiki.match(new RegExp("## " + h + "\\n([^\\n]+)")) || [])[1]);
  const me = [sec("毎日のこと"), sec("好きなこと"), sec("気になっていること")].filter(Boolean).join("");
  const q = `私について: ${me || "（Wikiは未作成）"} ${category ? category + "について、" : ""}${rough ? "「" + rough + "」と思っています。" : ""}私の状況で、最初に確かめるべきことは何ですか？`;
  return { question: q.replace(/\s+/g, " ").trim(), answer: "（定型文モード）AIに接続すると、この質問への答えがここに表示されます。" };
}

module.exports = async (req, res) => {
  const { wiki = "", category = "", rough = "" } = req.body || {};
  const user = `【わたしのWiki】\n${wiki}\n\n【聞きたいこと】\nカテゴリ: ${category || "なし"}\n本人の言葉: ${rough || "（なし）"}`;
  try {
    const r = await complete(SYSTEM, user, 1200);
    if (!r.text) return res.status(200).json({ ...fallback(category, rough, wiki), backend: "template" });
    let out;
    try { out = extractJson(r.text); } catch (_) { out = { question: rough, answer: r.text }; }
    return res.status(200).json({ question: out.question, answer: out.answer, backend: r.backend });
  } catch (e) {
    console.error("rewrite failed:", e.message);
    return res.status(200).json({ ...fallback(category, rough, wiki), backend: "template", error: e.message });
  }
};
