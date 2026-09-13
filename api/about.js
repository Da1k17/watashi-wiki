// 作品の説明（機械可読）。人向けの説明は README.md と public/llms.txt にある
module.exports = async (req, res) => res.status(200).json({
  name: "わたしのWiki",
  summary: "AIインタビュアーの質問に声・文字・タップで答えると、Wikipedia風の自分のページができ、同じ質問に答え続けた版の差分で考えの変化が見えるWebアプリ",
  event: "AI木曜会×AGIラボ 合同AIハッカソン 2026-09-13",
  target: "AIをほとんど使っていない人。検索やAIへの質問を文章にするのが苦手な人",
  flow: ["はじめる", "インタビュー（1問1画面、文字・音声・タップ）", "直感チェック（10枚、3秒、ゆっくり10秒モードあり）", "わたしのWiki（Wikipedia風、/wiki/<UID>）", "編集（項目ごと／全文）", "履歴を表示（版の一覧と差分）", "興味タグ→質問提案（自分用／この人に聞く用）", "AI用にコピー"],
  ai_usage: { model: "claude-opus-5", used_for: ["次の質問の生成", "回答→Wiki生成", "興味タグに応じた質問提案"], rules: ["回答にないことは書かない", "各行に根拠の設問番号", "未接続時は定型文で同じ画面が動く"], status_endpoint: "/api/status" },
  implemented: ["インタビュー", "直感チェック", "Wiki生成", "項目ごとの編集", "履歴と差分", "興味タグの質問提案", "/wiki/<UID> の共有", "AI用にコピー"],
  not_implemented: ["AIによる版の変化の要約", "写真・友人からの入力", "公開用の永続DB", "らくらくフォン・商業施設向け展開"],
  privacy: "年齢は年代で聞く。住所・本名は聞かない。データはブラウザとサーバー内ファイルに保存",
  repo: "https://github.com/Da1k17/watashi-wiki",
  docs: ["/llms.txt", "README.md"],
});
