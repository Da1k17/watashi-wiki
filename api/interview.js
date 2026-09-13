// AIインタビュアー。transcript（これまでのQ&A）を受け取り、次の一言と質問を返す
const { complete, extractJson } = require("./_llm");

const TOPICS = [
  { id: "q1", question: "まず、毎日はどんなふうに過ごしていますか？", suggestions: ["仕事", "家事", "畑・庭", "散歩・運動", "家族の世話", "趣味"] },
  { id: "q2", question: "好きなことや、楽しみにしていることは何ですか？", suggestions: ["料理", "旅行", "読書", "テレビ・動画", "音楽", "スポーツ", "手芸・DIY", "人と話す"] },
  { id: "q3", question: "最近、気になっていることはありますか？", suggestions: ["お金", "健康", "家族", "仕事", "人づきあい", "スマホ・機械", "特にない"] },
  { id: "q4", question: "差しつかえなければ、年代と、いまの暮らしを教えてください。", suggestions: ["〜30代", "40代", "50代", "60代", "70代〜", "一人", "夫婦", "家族と"] },
  { id: "q5", question: "これからやってみたいこと、大事にしていることを、ひとことで教えてください。", suggestions: [] },
];
const ACKS = ["ありがとうございます。", "なるほど。", "いいですね。", "そうなんですね。", "教えてくださってありがとうございます。"];
const MAX_TURNS = 7;

const SYSTEM = `あなたはやさしいインタビュアーです。相手はAIに慣れていない人。次の5つの話題を、合計7ターン以内で聞き出します。
話題: q1 毎日の過ごし方 / q2 好きなこと・楽しみ / q3 最近気になっていること / q4 年代と暮らし（年齢は年代で。住所や本名は聞かない） / q5 これからやってみたいこと・大事にしていること
ルール:
- 1ターン1問。質問は30字以内、敬体。相手の直前の答えに一言だけ反応（ack、20字以内）してから聞く。
- 答えが短い・曖昧なら1回だけ掘り下げてよい（topicは"followup"）。掘り下げは最大2回まで。
- suggestions: タップで答えられる短い候補を最大6つ（答えを打ちたくない人のため）。q5と掘り下げでは空配列。
- 5話題が聞けたら done=true にし、ackだけ返す。
出力はJSONのみ: {"ack":"","question":"","topic":"q1|q2|q3|q4|q5|followup","done":false,"suggestions":[]}`;

function templateStep(transcript) {
  const n = transcript.length;
  const ack = n === 0 ? "はじめまして。5つほど聞かせてください。" : ACKS[n % ACKS.length];
  if (n >= TOPICS.length) return { ack: "ありがとうございました。いま診断しています。", question: "", topic: "", done: true, suggestions: [] };
  const t = TOPICS[n];
  return { ack, question: t.question, topic: t.id, done: false, suggestions: t.suggestions };
}

module.exports = async (req, res) => {
  const { name = "", transcript = [] } = req.body || {};
  const tpl = templateStep(transcript);
  if (transcript.length >= MAX_TURNS) return res.status(200).json({ ...tpl, done: true, question: "", backend: "cap" });
  const covered = new Set(transcript.map((t) => t.topic).filter((x) => /^q[1-5]$/.test(x)));
  const user = `名前: ${name || "（未入力）"}\nこれまで:\n` +
    (transcript.length ? transcript.map((t, i) => `${i + 1}. [${t.topic || "?"}] Q: ${t.question}\n   A: ${t.answer}`).join("\n") : "（まだ何も聞いていない）") +
    `\nまだ聞けていない話題: ${["q1","q2","q3","q4","q5"].filter((q) => !covered.has(q)).join(", ") || "なし"}`;
  try {
    const r = await complete(SYSTEM, user, 400);
    if (!r.text) return res.status(200).json({ ...tpl, backend: "template" });
    try {
      const j = extractJson(r.text);
      if (j.done) return res.status(200).json({ ack: j.ack || "ありがとうございました。", question: "", topic: "", done: true, suggestions: [], backend: r.backend });
      if (!j.question) throw new Error("no question");
      return res.status(200).json({ ack: j.ack || "", question: j.question, topic: j.topic || "followup", done: false, suggestions: (j.suggestions || []).slice(0, 6), backend: r.backend });
    } catch (_) {
      return res.status(200).json({ ...tpl, backend: r.backend + "-fallback" });
    }
  } catch (e) {
    console.error("interview failed:", e.message);
    return res.status(200).json({ ...tpl, backend: "template", error: e.message });
  }
};
