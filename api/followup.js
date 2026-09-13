// 5問の答え → AIが追加で聞く1問。AI無しなら null
const { complete } = require("./_llm");

const SYSTEM = `あなたはやさしいインタビュアーです。回答を読んで、追加で1問だけ聞きます。
ルール: 1文・30字以内・答えやすい具体的な質問・回答にある内容を踏まえる・敬体。質問文だけを出力。`;

module.exports = async (req, res) => {
  const { name = "", answers = [] } = req.body || {};
  const user = answers.map((x) => `${x.id.toUpperCase()} ${x.question}\n→ ${(x.values || []).join("、")}${x.text ? " " + x.text : ""}`).join("\n");
  try {
    const r = await complete(SYSTEM, user, 200);
    return res.status(200).json({ question: r.text ? r.text.split("\n")[0].trim() : null, backend: r.backend });
  } catch (e) {
    console.error("followup failed:", e.message);
    return res.status(200).json({ question: null, backend: "template", error: e.message });
  }
};
