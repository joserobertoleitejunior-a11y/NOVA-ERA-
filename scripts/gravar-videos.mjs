#!/usr/bin/env node
// Grava os vídeos (MP4) do app: tutoriais por função e a apresentação.
//   node scripts/gravar-videos.mjs                 → tudo, nos dois formatos
//   node scripts/gravar-videos.mjs conferente      → só um
//   node scripts/gravar-videos.mjs --formato v     → só vertical (h = horizontal)
// Precisa do servidor local: python3 -m http.server 8765
import { createRequire } from "node:module";
const require_ = createRequire(import.meta.url);
// o Playwright está instalado globalmente neste ambiente (ajuste PLAYWRIGHT se for outro caminho)
const { chromium } = require_(process.env.PLAYWRIGHT || "/opt/node-tools/node_modules/playwright");
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, renameSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = join(RAIZ, "videos");
const BASE = process.env.BASE || "http://localhost:8765";
const args = process.argv.slice(2);
const sofmt = args.includes("--formato") ? args[args.indexOf("--formato") + 1] : null;
const alvos = args.filter((a) => !a.startsWith("--") && a !== sofmt);
const TUTORIAIS = ["conferente", "motorista", "vendedor", "expedicao", "administrativo", "diretoria"];
const LISTA = alvos.length ? alvos : [...TUTORIAIS, "apresentacao"];
const FORMATOS = sofmt ? [sofmt] : ["h", "v"];
const TAM = { h: { width: 1280, height: 720 }, v: { width: 720, height: 1280 } };

mkdirSync(SAIDA, { recursive: true });

async function gravar(nome, fmt) {
  const tmp = join(SAIDA, `.bruto-${nome}-${fmt}`);
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  const size = TAM[fmt];
  const nav = await chromium.launch();
  const ctx = await nav.newContext({ viewport: size, recordVideo: { dir: tmp, size }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const falhas = [];
  p.on("pageerror", (e) => falhas.push("JS: " + e.message.split("\n")[0].slice(0, 120)));
  const url = nome === "apresentacao" ? `${BASE}/apresentacao.html?gravar=1` : `${BASE}/tutorial.html?f=${nome}&gravar=1`;
  await p.goto(url + (fmt === "v" ? "&vertical=1" : ""));
  await p.waitForSelector("#palco");
  const t0 = Date.now();
  while (Date.now() - t0 < 420000) { if (await p.evaluate(() => !!window.__fim)) break; await p.waitForTimeout(500); }
  const terminou = await p.evaluate(() => !!window.__fim);
  falhas.push(...(await p.evaluate(() => window.__falhasVideo || [])));
  await p.waitForTimeout(2200);                   // deixa a tela de "concluído" aparecer
  await ctx.close(); await nav.close();
  const bruto = join(tmp, readdirSync(tmp).find((f) => f.endsWith(".webm")));
  const mp4 = join(SAIDA, `${nome}-${fmt === "v" ? "vertical" : "horizontal"}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", bruto, "-c:v", "libx264", "-preset", "slow", "-crf", "21",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", "25", mp4]);
  rmSync(tmp, { recursive: true, force: true });
  const seg = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).toString().trim());
  return { mp4, seg, terminou, falhas: [...new Set(falhas)] };
}

for (const nome of LISTA) {
  for (const fmt of FORMATOS) {
    process.stdout.write(`${nome} (${fmt === "v" ? "vertical" : "horizontal"}) ... `);
    try {
      const r = await gravar(nome, fmt);
      console.log(`${Math.round(r.seg)}s ${r.terminou ? "" : "NÃO TERMINOU "}${r.falhas.length ? "FALHAS: " + r.falhas.join(" | ") : "ok"}`);
    } catch (e) { console.log("ERRO: " + e.message.split("\n")[0]); }
  }
}
console.log(`\nMP4 em ${SAIDA}`);
