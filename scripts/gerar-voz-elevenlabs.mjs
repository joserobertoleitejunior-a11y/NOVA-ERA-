#!/usr/bin/env node
// Gera a narração da apresentação com a voz do ElevenLabs: um mp3 por cena, em assets/apresentacao/audio/<cena>.mp3
//
// Uso (Node 18 ou mais novo):
//   export ELEVENLABS_API_KEY="sua-chave"                 # elevenlabs.io → Profile → API Keys
//   node scripts/gerar-voz-elevenlabs.mjs --listar        # mostra as vozes da sua conta (escolha uma em português)
//   export ELEVENLABS_VOICE_ID="id-da-voz-escolhida"
//   node scripts/gerar-voz-elevenlabs.mjs                 # gera todas as cenas (as que já existem são puladas)
//   node scripts/gerar-voz-elevenlabs.mjs --refazer       # gera de novo, mesmo as que existem
//   node scripts/gerar-voz-elevenlabs.mjs --cena 07       # só a cena cujo id começa com 07
//   node scripts/gerar-voz-elevenlabs.mjs --tutorial conferente   # vídeo tutorial de uma função (conferente, motorista, vendedor, expedicao, administrativo, diretoria)
//   node scripts/gerar-voz-elevenlabs.mjs --tutoriais     # todos os tutoriais de uma vez
//
// A chave NUNCA vai para o repositório: ela só existe no seu computador, na hora de rodar este script.
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const chave = process.env.ELEVENLABS_API_KEY;
const voz = process.env.ELEVENLABS_VOICE_ID;
const args = process.argv.slice(2);
const tem = (a) => args.includes(a);
const valor = (a) => { const i = args.indexOf(a); return i >= 0 ? args[i + 1] : null; };

if (!chave) { console.error("Faltou a chave: export ELEVENLABS_API_KEY=\"...\""); process.exit(1); }

if (tem("--listar")) {
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": chave } });
  if (!r.ok) { console.error("Não consegui listar as vozes:", r.status, await r.text()); process.exit(1); }
  const { voices } = await r.json();
  for (const v of voices) console.log(`${v.voice_id}  ${v.name}  [${[v.labels?.language, v.labels?.accent, v.labels?.gender, v.labels?.descriptive].filter(Boolean).join(", ")}]`);
  process.exit(0);
}
if (!voz) { console.error("Faltou a voz: rode com --listar, escolha uma e use export ELEVENLABS_VOICE_ID=\"...\""); process.exit(1); }

const alvos = tem("--tutoriais") ? ["conferente", "motorista", "vendedor", "expedicao", "administrativo", "diretoria"] : valor("--tutorial") ? [valor("--tutorial")] : [null];
const existe = (f) => access(f).then(() => true, () => false);
const filtro = valor("--cena");
let feitas = 0;

for (const alvo of alvos) {
  const roteiro = JSON.parse(await readFile(join(raiz, alvo ? `assets/tutoriais/${alvo}.json` : "assets/apresentacao/roteiro.json"), "utf8"));
  const pasta = join(raiz, roteiro.audio || "assets/apresentacao/audio");
  await mkdir(pasta, { recursive: true });
  console.log(`\n== ${alvo ? `Tutorial: ${alvo}` : "Apresentação"}`);
  for (const c of roteiro.cenas) {
    if (filtro && !c.id.startsWith(filtro)) continue;
    const arquivo = join(pasta, `${c.id}.mp3`);
    if (!tem("--refazer") && await existe(arquivo)) { console.log(`= ${c.id} (já existe)`); continue; }
    process.stdout.write(`> ${c.id} ... `);
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": chave, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: c.fala,
        model_id: roteiro.voz?.modelo || "eleven_multilingual_v2",
        language_code: "pt",
        voice_settings: { stability: roteiro.voz?.estabilidade ?? 0.55, similarity_boost: roteiro.voz?.similaridade ?? 0.8, style: roteiro.voz?.estilo ?? 0.25, use_speaker_boost: true },
      }),
    });
    if (!r.ok) { console.log("ERRO", r.status, (await r.text()).slice(0, 200)); process.exitCode = 1; continue; }
    await writeFile(arquivo, Buffer.from(await r.arrayBuffer()));
    console.log("ok"); feitas++;
  }
  // lista de áudios existentes: o player lê este arquivo para saber quais cenas têm voz do ElevenLabs
  const prontos = []; for (const c of roteiro.cenas) if (await existe(join(pasta, `${c.id}.mp3`))) prontos.push(c.id);
  await writeFile(join(pasta, "lista.json"), JSON.stringify(prontos, null, 1));
}
console.log(`\nPronto: ${feitas} áudio(s) novo(s). Abra a apresentação ou o tutorial: eles usam os mp3 sozinhos.`);
