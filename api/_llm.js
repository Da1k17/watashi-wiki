// AI呼び出しの共通部。優先順: ANTHROPIC_API_KEY(環境変数 or ~/.config/secrets.env) → Claude API
//                     LLM_BACKEND=cli → claude CLI（ログイン済みのMacのみ）
//                     どちらも無ければ null を返し、呼び出し側が定型文にフォールバックする
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const MODEL = "claude-opus-5";

function loadKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const txt = fs.readFileSync(path.join(os.homedir(), ".config", "secrets.env"), "utf8");
    const m = txt.match(/^\s*(?:export\s+)?ANTHROPIC_API_KEY\s*=\s*["']?([^"'\n]+)["']?/m);
    if (m) return m[1].trim();
  } catch (_) {}
  return null;
}

function backend() {
  if (loadKey()) return "api";
  if (process.env.LLM_BACKEND === "cli") return "cli";
  return "none";
}

async function callApi(system, user, maxTokens) {
  const Anthropic = require("@anthropic-ai/sdk").default || require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: loadKey() });
  const base = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort: "low" },
  };
  let res;
  try {
    res = await client.beta.messages.create({
      ...base,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError || e instanceof TypeError) {
      res = await client.messages.create(base);
    } else {
      throw e;
    }
  }
  if (res.stop_reason === "refusal") throw new Error("refusal");
  return res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

function callCli(system, user) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;
    const prompt = `${system}\n\n---\n\n${user}`;
    execFile(
      "claude",
      ["-p", prompt, "--output-format", "text", "--model", "sonnet"],
      { env, timeout: 90000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(String(stdout).trim());
      }
    );
  });
}

async function complete(system, user, maxTokens = 2000) {
  const b = backend();
  if (b === "api") return { text: await callApi(system, user, maxTokens), backend: "api" };
  if (b === "cli") return { text: await callCli(system, user), backend: "cli" };
  return { text: null, backend: "none" };
}

function extractJson(text) {
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("no json");
  return JSON.parse(text.slice(s, e + 1));
}

module.exports = { complete, backend, extractJson, MODEL };
