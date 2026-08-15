// Génère test-campagne/<dir>/transcript.html à partir de data.json (voir _run_comparison.mts).
import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2];
if (!outDir) throw new Error("Usage: _make_html.mts <outDir>");
const dir = path.join("test-campagne", outDir);
const data = JSON.parse(fs.readFileSync(path.join(dir, "data.json"), "utf-8"));
const { result, messages } = data;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const rows = messages
  .map((m: { authorType: string; content: string }) => {
    const cls = m.authorType === "PLAYER" ? "player" : m.authorType === "MJ" ? "mj" : "system";
    const label = m.authorType === "PLAYER" ? "Joueur" : m.authorType === "MJ" ? "Maître du Jeu" : "Système";
    return `<div class="msg ${cls}"><div class="who">${label}</div><div class="text">${esc(m.content)}</div></div>`;
  })
  .join("\n");

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Comparatif — ${esc(result.modelId)}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#12141c;color:#e8e6e3;max-width:800px;margin:0 auto;padding:24px;}
h1{font-size:1.3rem;} .meta{background:#1b1e2a;border:1px solid #2a2e3d;border-radius:10px;padding:14px 18px;margin-bottom:20px;font-size:.85rem;}
.meta div{margin:4px 0;} .score{font-weight:700;color:#e0a955;}
.msg{margin-bottom:14px;padding:10px 14px;border-radius:10px;border:1px solid #2a2e3d;max-width:80%;}
.msg.player{background:#1b1e2a;border-left:3px solid #5b8dee;}
.msg.mj{background:#171310;border-left:3px solid #8a80d6;margin-left:auto;font-style:italic;}
.msg.system{background:#21243133;border:1px dashed #6b6d7c;text-align:center;max-width:100%;font-size:.8rem;color:#9a9ba8;}
.who{font-size:.72rem;font-weight:700;color:#9a9ba8;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px;}
</style></head><body>
<h1>Comparatif modèles — ${esc(result.modelId)}</h1>
<div class="meta">
<div>Scénario : ${esc(result.scenarioTitle)} — phase de départ : ${esc(result.startPhase)}</div>
<div>Phase finale : ${esc(result.finalPhase ?? "?")} — ${result.advancedPhase ? "✅ avancée" : "❌ pas avancée"}</div>
<div>Durée totale du run : ${(result.elapsedMs / 1000).toFixed(1)}s</div>
<div>Tool-calls fiche déclenchés : ${JSON.stringify(result.toolCalls.map((t: { toolName: string }) => t.toolName))}</div>
<div>Score tool-calling attendu : <span class="score">${result.toolCallScore}</span></div>
<div>Usage : ${result.usage.calls} appels, ${result.usage.inputTokens} tokens entrée, ${result.usage.outputTokens} tokens sortie${result.usage.costUsd ? `, $${Number(result.usage.costUsd).toFixed(4)}` : ""}</div>
</div>
${rows}
</body></html>`;

fs.writeFileSync(path.join(dir, "transcript.html"), html);
console.log(`Écrit : ${path.join(dir, "transcript.html")}`);
