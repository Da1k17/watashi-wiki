// 直感チェック（3秒スワイプ）の結果 → 考え方の傾向を3行で。AI無しなら要約のみ
const { complete } = require("./_llm");
const SYSTEM = `あなたは観察の名人です。3秒以内に直感で答えた結果（そう思う／ちがう／パス、反応秒数）を受け取り、本人の考え方の傾向を日本語で3行の箇条書きにします。
ルール: 回答にあることだけを根拠にする。性格のラベル（外向的など）は使わない。「〜のようです」「〜が見えます」と断定を避ける。各行40字以内。反応の速さやパスも材料にする。出力は「- 」で始まる3行だけ。`;
module.exports = async (req, res) => {
  const { swipes = [] } = req.body || {};
  const yes = swipes.filter(x => x.answer === "yes").map(x => x.text), no = swipes.filter(x => x.answer === "no").map(x => x.text), pass = swipes.filter(x => x.answer === "pass");
  const answered = swipes.filter(x => x.answer !== "pass");
  const avg = answered.length ? (answered.reduce((a, x) => a + x.ms, 0) / answered.length / 1000).toFixed(1) : null;
  const summary = `そう思う: ${yes.join("、") || "なし"}。ちがう: ${no.join("、") || "なし"}。パス: ${pass.length}枚。${avg ? "平均" + avg + "秒で回答" : ""}`;
  const tpl = [`- 迷わず答えたのが${answered.length}枚、パスが${pass.length}枚${avg ? "、反応は平均" + avg + "秒" : ""}。`, yes.length ? `- 「${yes[0]}」には即答でそう思う、と出ています。` : "- そう思う、はありませんでした。", no.length ? `- 「${no[0]}」は直感で「ちがう」でした。` : "- ちがう、はありませんでした。"];
  try {
    const r = await complete(SYSTEM, swipes.map(x => `${x.text} → ${x.answer === "yes" ? "そう思う" : x.answer === "no" ? "ちがう" : "パス"}（${(x.ms / 1000).toFixed(1)}秒）`).join("\n"), 300);
    const lines = r.text ? r.text.split("\n").map(l => l.trim()).filter(l => l.startsWith("- ")).slice(0, 3) : [];
    return res.status(200).json({ summary, lines: lines.length ? lines : tpl, backend: r.text ? r.backend : "template" });
  } catch (e) {
    return res.status(200).json({ summary, lines: tpl, backend: "template", error: e.message });
  }
};
