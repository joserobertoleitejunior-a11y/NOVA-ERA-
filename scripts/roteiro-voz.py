#!/usr/bin/env python3
"""Roteiro de voz (ElevenLabs) e recorte dos áudios, a partir dos roteiros dos vídeos.

  python3 scripts/roteiro-voz.py gerar
      → escreve assets/apresentacao/ROTEIRO-VOZ.md (o texto para colar) e scripts/blocos-voz.json

  python3 scripts/roteiro-voz.py cortar gravacoes/*.mp3
      → corta cada arquivo nas pausas longas e põe cada cena no lugar certo
      Opções: --silencio 2.0 (pausa que separa cenas) · --ruido -38 (dB) · --so-conferir

O nome do arquivo manda: "conferente-parte-1.mp3" entra no tutorial do conferente, parte 1.
"""
import json, re, subprocess, sys, tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PAUSA_CENA = '<break time="3.0s" />'
PAUSA_FRASE = '<break time="0.4s" />'
MAX_PARTE = 950          # caracteres por geração (parte pequena gasta pouco crédito e sai mais natural)
PRONUNCIA = [("QR code", "quiú érre côde"), ("QR", "quiú érre"), ("XML", "xis ême éle"), ("WhatsApp", "Uótsap")]

ROTEIROS = [("apresentacao", "Apresentação para a diretoria", "assets/apresentacao/roteiro.json")] + \
           [(f, f"Tutorial · {f}", f"assets/tutoriais/{f}.json") for f in
            ("conferente", "motorista", "vendedor", "expedicao", "administrativo", "diretoria")]

def falado(t):
    for a, b in PRONUNCIA: t = t.replace(a, b)
    return re.sub(r"([!?]) ", lambda m: f"{m.group(1)} {PAUSA_FRASE} ", t)

def partes_de(cenas):
    """Agrupa as cenas em partes de no máximo MAX_PARTE caracteres, sem cortar cena ao meio."""
    partes, atual = [], []
    for c in cenas:
        corpo = falado(c["fala"])
        if atual and sum(len(x[1]) for x in atual) + len(corpo) > MAX_PARTE:
            partes.append(atual); atual = []
        atual.append((c["id"], corpo))
    if atual: partes.append(atual)
    return partes

def gerar():
    linhas = [
        "# Roteiro de voz — Confere Carga",
        "",
        "Os vídeos já estão prontos em **MP4, sem voz**. Gere o áudio aqui, me mande, e eu encaixo cena por cena.",
        "",
        "## Configuração do ElevenLabs (igual em todas as partes)",
        "- **Modelo:** Eleven Multilingual v2 (é ele que entende as pausas `<break>`).",
        "- **Voz:** brasileira e calorosa. Ouça duas ou três lendo a primeira parte e fique com a mais natural.",
        "- **Estabilidade 35%** · **Semelhança 75%** · **Exageração do estilo 45%** · **Reforço de voz ligado** · **Velocidade 1.0**",
        "- Saiu robótica? Desça a estabilidade para 30%. Saiu exagerada? Suba para 45%.",
        "- **Formato:** MP3, 44,1 kHz, 128 kbps ou mais.",
        "",
        "## Como gerar",
        "1. Cole **uma parte por vez**, gere e **ouça**. Parte curta gasta pouco crédito e sai mais natural.",
        "2. Ficou emendado ou com cara de leitura? Gere a mesma parte de novo: cada geração sai diferente.",
        "3. **Não apague** as linhas `<break time=\"3.0s\" />`: é nelas que eu corto as cenas.",
        "4. Salve com o nome exato que está no título de cada parte, e envie para a pasta **gravacoes/** do GitHub.",
        "5. Pode mandar aos poucos. O que chegar, eu encaixo; o resto segue com legenda.",
        "",
        "> **Comece pela apresentação** se os créditos estiverem curtos: é ela que você vai usar na oferta.",
        "",
    ]
    manifesto, total = {}, 0
    for chave, titulo, caminho in ROTEIROS:
        doc = json.loads((RAIZ / caminho).read_text(encoding="utf8"))
        partes = partes_de(doc["cenas"])
        soma = sum(len(x[1]) for pa in partes for x in pa)
        total += soma
        linhas += ["---", "", f"# {titulo}", f"*{len(doc['cenas'])} cenas · {len(partes)} parte(s) · {soma} caracteres*", ""]
        for n, pa in enumerate(partes, 1):
            arquivo = f"{chave}-parte-{n}.mp3"
            manifesto[arquivo] = {"alvo": chave, "audio": doc.get("audio", "assets/apresentacao/audio"), "cenas": [i for i, _ in pa]}
            texto = f"\n{PAUSA_CENA}\n".join(c for _, c in pa)
            linhas += [f"## {arquivo}  ({len(pa)} cena(s) · {len(texto)} caracteres)", "", "```text", texto, "```", ""]
        linhas.append("")
    linhas.insert(linhas.index("> **Comece pela apresentação** se os créditos estiverem curtos: é ela que você vai usar na oferta."),
                  f"> Total de tudo: **{total} caracteres**. Só a apresentação: **{sum(len(falado(c['fala'])) for c in json.loads((RAIZ / ROTEIROS[0][2]).read_text(encoding='utf8'))['cenas'])} caracteres**.\n")
    (RAIZ / "assets/apresentacao/ROTEIRO-VOZ.md").write_text("\n".join(linhas) + "\n", encoding="utf8")
    (RAIZ / "scripts/blocos-voz.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    print(f"ROTEIRO-VOZ.md: {len(manifesto)} partes, {total} caracteres no total.")
    for a, m in manifesto.items(): print(f"  {a}: {len(m['cenas'])} cena(s)")

def rodar(cmd): return subprocess.run(cmd, capture_output=True, text=True)

def segmentos(arq, silencio, ruido):
    """Trechos falados = o que sobra depois de tirar os silêncios longos."""
    r = rodar(["ffmpeg", "-hide_banner", "-i", str(arq), "-af", f"silencedetect=noise={ruido}dB:d={silencio}", "-f", "null", "-"])
    ini = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    fim = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    h, mi, se = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr).groups()
    dur = int(h) * 3600 + int(mi) * 60 + float(se)
    cortes, atual = [], 0.0
    for i, s in enumerate(ini):
        if s - atual > 0.4: cortes.append((atual, s))
        atual = fim[i] if i < len(fim) else dur
    if dur - atual > 0.4: cortes.append((atual, dur))
    return cortes

def cortar(arqs, silencio, ruido, so_conferir):
    manifesto = json.loads((RAIZ / "scripts/blocos-voz.json").read_text(encoding="utf8"))
    tocados = {}
    with tempfile.TemporaryDirectory() as tmp:
        for arq in arqs:
            arq = Path(arq); m = manifesto.get(arq.name)
            if not m:
                print(f"✗ {arq.name}: nome fora da lista. Esperados: {', '.join(list(manifesto)[:4])}…"); continue
            norm = Path(tmp) / f"{arq.stem}.wav"
            r = rodar(["ffmpeg", "-y", "-i", str(arq), "-af", "loudnorm=I=-16:TP=-1.5:LRA=9", "-ar", "44100", "-ac", "1", str(norm)])
            if not norm.exists(): print(f"✗ {arq.name}: não consegui ler ({r.stderr[-160:]})"); continue
            segs = segmentos(norm, silencio, ruido)
            print(f"\n{arq.name}: {len(segs)} trecho(s), esperado {len(m['cenas'])}")
            for i, (a, b) in enumerate(segs, 1): print(f"   {i:2d}. {a:6.1f}s → {b:6.1f}s ({b - a:5.1f}s)")
            if len(segs) != len(m["cenas"]):
                print(f"   ✗ não bate. Pausa dentro da cena passou de {silencio}s (aumente --silencio) ou a pausa entre cenas ficou curta (diminua). Nada gravado deste arquivo.")
                continue
            pasta = RAIZ / m["audio"]; pasta.mkdir(parents=True, exist_ok=True)
            for (a, b), cena in zip(segs, m["cenas"]):
                destino = pasta / f"{cena}.mp3"
                if not so_conferir:
                    rodar(["ffmpeg", "-y", "-ss", f"{max(a - 0.12, 0):.3f}", "-to", f"{b + 0.18:.3f}", "-i", str(norm),
                           "-af", "afade=t=in:d=0.04,areverse,afade=t=in:d=0.12,areverse", "-b:a", "128k", str(destino)])
                print(f"   → {destino.relative_to(RAIZ)}")
            tocados[m["alvo"]] = m["audio"]
    if not so_conferir:
        for alvo, audio in tocados.items():
            caminho = "assets/apresentacao/roteiro.json" if alvo == "apresentacao" else f"assets/tutoriais/{alvo}.json"
            doc = json.loads((RAIZ / caminho).read_text(encoding="utf8")); pasta = RAIZ / audio
            prontos = [c["id"] for c in doc["cenas"] if (pasta / f"{c['id']}.mp3").exists()]
            (pasta / "lista.json").write_text(json.dumps(prontos, indent=1), encoding="utf8")
            print(f"\n{alvo}: {len(prontos)}/{len(doc['cenas'])} cenas com voz.")

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] not in ("gerar", "cortar"): sys.exit(__doc__)
    if a[0] == "gerar": gerar()
    else:
        sil = float(a[a.index("--silencio") + 1]) if "--silencio" in a else 2.0
        ruido = float(a[a.index("--ruido") + 1]) if "--ruido" in a else -38
        arqs = [x for i, x in enumerate(a[1:], 1) if not x.startswith("--") and a[i - 1] not in ("--silencio", "--ruido")]
        cortar(arqs, sil, ruido, "--so-conferir" in a)
