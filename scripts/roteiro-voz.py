#!/usr/bin/env python3
"""Roteiro de voz único (ElevenLabs) e recorte dos áudios, para a apresentação e os 6 tutoriais.

  python3 scripts/roteiro-voz.py aplicar     # copia as falas de scripts/falas-humanas.json para os roteiros (legenda = fala)
  python3 scripts/roteiro-voz.py gerar       # escreve assets/apresentacao/ROTEIRO-VOZ.md (o arquivo para colar no ElevenLabs)
  python3 scripts/roteiro-voz.py cortar gravacoes/voz.mp3 [gravacoes/parte-2.mp3 ...]
                                             # corta por cena (nos silêncios longos) e põe cada mp3 no lugar certo; aceita o texto inteiro em 1 arquivo ou dividido em partes, na ordem
Opções do cortar: --silencio 2.0 (segundos de pausa que separam cenas)  --ruido -38 (dB)  --so-conferir (não grava nada)
"""
import json, re, subprocess, sys, tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FALAS = json.loads((RAIZ / "scripts/falas-humanas.json").read_text(encoding="utf8"))
PAUSA_CENA = '<break time="3.0s" />'   # separa as cenas: é nela que o corte acontece
PAUSA_FRASE = '<break time="0.4s" />'  # respiro depois de ! e ?

# Como a voz deve falar (a legenda continua com a grafia normal)
PRONUNCIA = [("QR code", "quiú érre côde"), ("QR", "quiú érre"), ("XML", "xis ême éle"), ("WhatsApp", "Uótsap"), ("três D", "três dê")]

# Cada bloco = uma geração no ElevenLabs (cabe no limite de caracteres por geração)
BLOCOS = [
    ("Tudo: apresentação + 6 tutoriais", [("apresentacao", None), ("conferente", None), ("motorista", None), ("vendedor", None), ("expedicao", None), ("administrativo", None), ("diretoria", None)]),
]


def arquivo_roteiro(alvo):
    return RAIZ / ("assets/apresentacao/roteiro.json" if alvo == "apresentacao" else f"assets/tutoriais/{alvo}.json")


def cenas_do_bloco(itens):
    """[(alvo, id_da_cena, fala)] na ordem do bloco."""
    saida = []
    for alvo, prefixo in itens:
        for cid, fala in FALAS[alvo].items():
            if prefixo is None or cid.startswith(prefixo + "-"):
                saida.append((alvo, cid, fala))
    return saida


def falado(texto):
    for a, b in PRONUNCIA:
        texto = texto.replace(a, b)
    return re.sub(r"([!?]) ", lambda m: f"{m.group(1)} {PAUSA_FRASE} ", texto)


def aplicar():
    for alvo, falas in FALAS.items():
        p = arquivo_roteiro(alvo)
        r = json.loads(p.read_text(encoding="utf8"))
        ids = [c["id"] for c in r["cenas"]]
        if ids != list(falas):
            sys.exit(f"As cenas de {alvo} não batem com o roteiro: {ids} x {list(falas)}")
        for c in r["cenas"]:
            c["fala"] = falas[c["id"]]
        p.write_text(json.dumps(r, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    print("Falas aplicadas nos roteiros (legenda e voz usam o mesmo texto).")


def gerar():
    linhas = [
        "# Roteiro de voz — Confere Carga (apresentação + 6 tutoriais)",
        "",
        "**Um único texto, uma única geração, um único mp3.** Eu corto em cenas e coloco cada uma no lugar certo.",
        "",
        "## Configuração do ElevenLabs",
        "- **Modelo:** Eleven Multilingual v2 (é ele que entende as pausas `<break>`).",
        "- **Voz:** brasileira e calorosa. Teste 2 ou 3 lendo a primeira frase e fique com a mais natural, não a mais “locutor”.",
        "- **Stability:** 40%  ·  **Similarity:** 75%  ·  **Style:** 40%  ·  **Speaker boost:** ligado  ·  **Speed:** 1.0",
        "- Se soar teatral, suba a Stability para 50%. Se soar seca e monótona, desça para 30%.",
        "",
        "## Como gerar",
        "1. Copie **todo o texto da caixa abaixo** e cole no Text to Speech, sem mudar nada.",
        "2. **Não apague** as linhas `<break time=\"3.0s\" />`: são as pausas entre cenas e é nelas que eu corto.",
        "3. Gere, ouça e baixe o mp3. Se uma parte ficou ruim, gere de novo (cada geração sai um pouco diferente).",
        "4. Envie o arquivo para a pasta **gravacoes/** do repositório (GitHub → Add file → Upload files, branch `claude/nova-era-app-6pqjx1`) e me avise.",
        "",
        "**Se o ElevenLabs recusar por tamanho:** divida o texto em duas partes **numa linha de pausa** (por exemplo, logo depois de “Confere Carga: menos erro, menos prejuízo, mais controle. Obrigado.”), gere as duas e envie **parte-1.mp3** e **parte-2.mp3**. Eu junto na ordem.",
        "",
        "Eu corto, nivelo o volume de todas as cenas e confiro a contagem: se faltar ou sobrar uma cena, eu aviso antes de gravar qualquer coisa.",
        "",
        "> **CUSTO_AQUI**",
        "",
    ]
    total = 0
    manifesto = []
    for n, (titulo, itens) in enumerate(BLOCOS, 1):
        cenas = cenas_do_bloco(itens)
        texto = f"\n{PAUSA_CENA}\n".join(falado(f) for _, _, f in cenas)
        total += len(texto)
        manifesto.append({"bloco": n, "cenas": [{"alvo": a, "id": c} for a, c, _ in cenas]})
        linhas += [
            "---", "", f"## TEXTO PARA COLAR  ({len(cenas)} cenas · {len(texto)} caracteres)", "", "```text", texto, "```", "",
        ]
    linhas[linhas.index("> **CUSTO_AQUI**")] = f"> O ElevenLabs cobra por caractere: este texto tem **{total} caracteres**. Gerar de novo gasta de novo."
    (RAIZ / "assets/apresentacao/ROTEIRO-VOZ.md").write_text("\n".join(linhas) + "\n", encoding="utf8")
    (RAIZ / "scripts/blocos-voz.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    print(f"ROTEIRO-VOZ.md gerado: {len(BLOCOS)} blocos, {total} caracteres no total.")


def rodar(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def segmentos(arq, silencio, ruido):
    """Trechos falados = o que sobra depois de tirar os silêncios longos."""
    r = rodar(["ffmpeg", "-hide_banner", "-i", str(arq), "-af", f"silencedetect=noise={ruido}dB:d={silencio}", "-f", "null", "-"])
    ini = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    fim = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    h, mi, se = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr).groups()
    dur = int(h) * 3600 + int(mi) * 60 + float(se)
    cortes, atual = [], 0.0
    for i, s in enumerate(ini):
        if s - atual > 0.4:
            cortes.append((atual, s))
        atual = fim[i] if i < len(fim) else dur
    if dur - atual > 0.4:
        cortes.append((atual, dur))
    return cortes


def cortar(arqs, silencio, ruido, so_conferir):
    cenas = json.loads((RAIZ / "scripts/blocos-voz.json").read_text(encoding="utf8"))[0]["cenas"]
    with tempfile.TemporaryDirectory() as tmp:
        trechos = []  # (arquivo normalizado, início, fim) na ordem em que foram falados
        for k, arq in enumerate(arqs):
            norm = Path(tmp) / f"norm{k}.wav"  # mesmo volume em todo o material
            r = rodar(["ffmpeg", "-y", "-i", str(arq), "-af", "loudnorm=I=-16:TP=-1.5:LRA=9", "-ar", "44100", "-ac", "1", str(norm)])
            if not norm.exists():
                sys.exit(f"Não consegui ler {arq}: {r.stderr[-200:]}")
            segs = segmentos(norm, silencio, ruido)
            print(f"\n{Path(arq).name}: {len(segs)} trechos")
            for i, (a, b) in enumerate(segs, 1):
                print(f"  {i:2d}. {a:7.1f}s → {b:7.1f}s  ({b - a:5.1f}s)")
            trechos += [(norm, a, b) for a, b in segs]
        print(f"\nTotal: {len(trechos)} trechos; esperado {len(cenas)} cenas.")
        if len(trechos) != len(cenas):
            print("✗ A contagem não bate. Provável causa: uma pausa dentro da cena passou de "
                  f"{silencio}s (aumente --silencio) ou uma pausa entre cenas ficou curta (diminua). Nada foi gravado.")
            sys.exit(1)
        listas = {}
        for (norm, a, b), c in zip(trechos, cenas):
            roteiro = json.loads(arquivo_roteiro(c["alvo"]).read_text(encoding="utf8"))
            pasta = RAIZ / (roteiro.get("audio") or "assets/apresentacao/audio")
            destino = pasta / f"{c['id']}.mp3"
            if not so_conferir:
                pasta.mkdir(parents=True, exist_ok=True)
                rodar(["ffmpeg", "-y", "-ss", f"{max(a - 0.12, 0):.3f}", "-to", f"{b + 0.18:.3f}", "-i", str(norm),
                       "-af", "afade=t=in:d=0.04,areverse,afade=t=in:d=0.12,areverse", "-b:a", "128k", str(destino)])
            listas.setdefault(c["alvo"], []).append(c["id"])
            print(f"  → {destino.relative_to(RAIZ)}  ({b - a + 0.3:.1f}s)")
    if not so_conferir:
        for alvo in listas:
            roteiro = json.loads(arquivo_roteiro(alvo).read_text(encoding="utf8"))
            pasta = RAIZ / (roteiro.get("audio") or "assets/apresentacao/audio")
            prontos = [c["id"] for c in roteiro["cenas"] if (pasta / f"{c['id']}.mp3").exists()]
            (pasta / "lista.json").write_text(json.dumps(prontos, indent=1), encoding="utf8")
        print("\nÁudios no lugar e lista.json atualizada.")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] not in ("aplicar", "gerar", "cortar"):
        sys.exit(__doc__)
    if a[0] == "aplicar":
        aplicar()
    elif a[0] == "gerar":
        gerar()
    else:
        sil, ruido, so = 2.0, -38, "--so-conferir" in a
        if "--silencio" in a: sil = float(a[a.index("--silencio") + 1])
        if "--ruido" in a: ruido = float(a[a.index("--ruido") + 1])
        arqs = [x for i, x in enumerate(a[1:], 1) if not x.startswith("--") and a[i - 1] not in ("--silencio", "--ruido")]
        cortar(arqs, sil, ruido, so)
