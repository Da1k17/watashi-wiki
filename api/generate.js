// 6問の答え → 診断（タイプ名・一行・推測3つ）＋「わたしのWiki」(Markdown)
const { complete, extractJson } = require("./_llm");

const SYSTEM = `あなたは編集者です。インタビューの回答だけを材料に、本人の「わたしのWiki」をMarkdownで書きます。
ルール:
- 回答にないことは推測して書かない。回答にない項目は「（未回答）」と書く。
- 性格のラベル付けをしない。「連絡は文字で」のように具体的に書く。
- 各行の末尾に根拠の設問番号を［Q1］のように付ける。
- 平易な言葉。専門用語なし。各見出し1〜2文。
- 出力はMarkdownのみ。前置き・説明・コードフェンスは書かない。
見出しは必ずこの6つ、この順:
## ひとことで
## 毎日のこと
## 好きなこと
## 気になっていること
## 大事にしていること
## AIに知っておいてほしいこと
「AIに知っておいてほしいこと」は、本人の好み・前提・避けてほしいことを3行の箇条書きで、命令形ではなく「〜が好み」「〜という前提」のように書く。`;

const TYPE_A = { "旅行":"旅する", "料理":"味にこだわる", "読書":"本の虫の", "テレビ・動画":"物語好きの", "音楽":"リズムで生きる", "スポーツ":"体で考える", "手芸・DIY":"手を動かす", "人と話す":"話好きの", "その他":"マイペースな" };
const TYPE_B = { "仕事":"段取り屋", "家事":"暮らしの職人", "畑・庭":"育て屋", "散歩・運動":"歩く人", "家族の世話":"世話焼き", "趣味":"探究者", "その他":"自由人" };
const GUESS_RULES = [
  ["q1","仕事","仕事の段取りは前日に決めるほう"],
  ["q1","家事","家の中が片づいていないと落ち着かないほう"],
  ["q1","畑・庭","朝が強いほう"],
  ["q1","散歩・運動","朝が強いほう"],
  ["q1","家族の世話","自分のことは後回しにしがち"],
  ["q2","旅行","新しい店や場所を試すのが好きなほう"],
  ["q2","料理","レシピより自分流にアレンジするほう"],
  ["q2","読書","一人の時間がないと疲れるほう"],
  ["q2","テレビ・動画","夜ふかししがちなほう"],
  ["q2","音楽","気分の切り替えが上手なほう"],
  ["q2","スポーツ","勝ち負けにこだわるほう"],
  ["q2","手芸・DIY","細かい作業が苦にならないほう"],
  ["q2","人と話す","初対面でも自分から話しかけるほう"],
  ["q3","お金","貯めるより使い方を考えたいほう"],
  ["q3","健康","健康診断の数字を気にするほう"],
  ["q3","仕事","今の仕事を続けるか、ときどき考えるほう"],
  ["q3","家族","家族の予定を自分より優先しがち"],
  ["q3","人づきあい","誘いを断るのが苦手なほう"],
  ["q3","スマホ・機械","説明書は読まずにまず触るほう"],
];
const GUESS_FILL = ["急な予定変更は苦手なほう", "ほめられると伸びるほう", "決めるのは早いほう"];

function templateDiag(answers) {
  const a = Object.fromEntries(answers.map((x) => [x.id, x]));
  const v = (id) => (a[id] && a[id].values) || [];
  const like = v("q2")[0], day = v("q1")[0];
  const type = (TYPE_A[like] || "マイペースな") + (TYPE_B[day] || "自由人");
  const parts = [];
  if (like) parts.push(`${like}が原動力`);
  if (day) parts.push(`毎日は${day}を回す`);
  if (v("q3")[0] && v("q3")[0] !== "特にない") parts.push(`いま頭にあるのは${v("q3").join("と")}`);
  const line = parts.join("。") + "。";
  const guesses = [];
  for (const [id, val, g] of GUESS_RULES) if (v(id).includes(val) && !guesses.includes(g) && guesses.length < 3) guesses.push(g);
  for (const g of GUESS_FILL) if (guesses.length < 3 && !guesses.includes(g)) guesses.push(g);
  return { type, line, guesses };
}

function templateWiki(name, answers) {
  const a = Object.fromEntries(answers.map((x) => [x.id, x]));
  const t = (id) => (a[id] && a[id].text ? a[id].text.trim() : "");
  const j = (id) => (a[id] && a[id].values && a[id].values.length ? a[id].values.join("、") : (id === "q5" ? "" : t(id)));
  const who = name ? `${name}さん` : "わたし";
  const L = [];
  L.push("## ひとことで", `${who}。${j("q4") || "年代は未回答"}。毎日は${j("q1") || "（未回答）"}が中心で、${j("q2") || "（未回答）"}が好き。［Q1・Q2・Q4］`);
  L.push("## 毎日のこと", j("q1") ? `毎日は${j("q1")}が中心です。［Q1］` : "（未回答）［Q1］");
  L.push("## 好きなこと", j("q2") ? `${j("q2")}が好きです。［Q2］` : "（未回答）［Q2］");
  L.push("## 気になっていること", j("q3") ? `最近は${j("q3")}が気になっています。［Q3］` : "（未回答）［Q3］");
  L.push("## 大事にしていること", t("q5") ? `${t("q5")}［Q5］` : "（未回答）［Q5］");
  if (t("q6")) L.push(`${t("q6")}［Q6］`);
  L.push("## AIに知っておいてほしいこと", "- 専門用語なしの短い説明が好み。［共通］",
    j("q4") ? `- 前提: ${j("q4")}。［Q4］` : "- 前提: 年代・暮らしは未回答。［Q4］",
    j("q3") ? `- いちばん関心があるのは${j("q3")}。［Q3］` : "- 気になっていることは未回答。［Q3］");
  return L.join("\n");
}

const OPTS = {
  q1: ["仕事","家事","畑・庭","畑","庭","散歩","運動","家族の世話","孫","趣味"],
  q2: ["料理","旅行","読書","本","テレビ","動画","音楽","スポーツ","手芸","DIY","人と話す","友だち","映画","ゲーム","釣り","ゴルフ","カフェ"],
  q3: ["お金","健康","家族","仕事","人づきあい","人間関係","スマホ","機械","特にない","老後","年金","転職","子ども","親"],
};
const NORM = { "畑":"畑・庭","庭":"畑・庭","散歩":"散歩・運動","運動":"散歩・運動","孫":"家族の世話","本":"読書","テレビ":"テレビ・動画","動画":"テレビ・動画","手芸":"手芸・DIY","DIY":"手芸・DIY","友だち":"人と話す","人間関係":"人づきあい","スマホ":"スマホ・機械","機械":"スマホ・機械" };
// インタビュー（自由回答）→ answers 形式へ。キーワードが拾えれば values、拾えなければ本文をそのまま使う
function fromTranscript(transcript) {
  const byTopic = {};
  for (const t of transcript) {
    const key = /^q[1-5]$/.test(t.topic) ? t.topic : null;
    if (t.topic === "swipe") { byTopic.swipe = { id: "swipe", question: t.question, values: [], text: t.answer }; continue; }
    if (!key) { byTopic.q6 = byTopic.q6 || { id: "q6", question: t.question, values: [], text: "" }; byTopic.q6.text += (byTopic.q6.text ? " " : "") + t.answer; continue; }
    const cur = byTopic[key] || (byTopic[key] = { id: key, question: t.question, values: [], text: "" });
    cur.text += (cur.text ? " " : "") + t.answer;
    if (OPTS[key]) for (const k of OPTS[key]) if (t.answer.includes(k)) { const v = NORM[k] || k; if (!cur.values.includes(v)) cur.values.push(v); }
    if (key === "q4") {
      const m = t.answer.match(/(〜?\d0代〜?)/); if (m) cur.values[0] = m[1];
      for (const w of ["一人","ひとり","夫婦","家族と","家族"]) if (t.answer.includes(w)) { cur.values[1] = w === "ひとり" ? "一人" : (w === "家族" ? "家族と" : w); break; }
      cur.values = cur.values.filter(Boolean);
    }
  }
  return ["q1","q2","q3","q4","q5","q6","swipe"].map((k) => byTopic[k]).filter(Boolean);
}

module.exports = async (req, res) => {
  const body = req.body || {};
  const name = body.name || "";
  const answers = Array.isArray(body.transcript) && body.transcript.length ? fromTranscript(body.transcript) : (body.answers || []);
  const user = `名前: ${name || "（未入力）"}\n回答:\n` + answers
    .map((x) => `${x.id.toUpperCase()} ${x.question}\n→ ${(x.values || []).join("、")}${x.text ? " " + x.text : ""}`)
    .join("\n");
  const tpl = { wiki: templateWiki(name, answers), backend: "template" };
  try {
    const r = await complete(SYSTEM, user, 2500);
    if (!r.text) return res.status(200).json(tpl);
    const md = r.text.replace(/^```[a-z]*\n?/m, "").replace(/```\s*$/m, "").trim();
    if (!md.includes("## ひとことで")) return res.status(200).json({ ...tpl, backend: r.backend + "-fallback" });
    return res.status(200).json({ wiki: md, backend: r.backend });
  } catch (e) {
    console.error("generate failed:", e.message);
    return res.status(200).json({ ...tpl, error: e.message });
  }
};
