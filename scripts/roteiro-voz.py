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
PRONUNCIA = [("QR code", "quiú érre côde"), ("XML", "xis ême éle"), ("3D", "três dê")]

# Cada bloco = uma geração no ElevenLabs (cabe no limite de caracteres por geração)
PARTES_APRES = [(1, 3), (4, 6), (7, 8), (9, 11), (12, 14), (15, 17)]  # cenas de cada geração
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
    sep = f"\n{PAUSA_CENA}\n"
    ap = cenas_do_bloco([("apresentacao", None)])
    linhas = [
        "# Roteiro de voz — Confere Carga",
        "",
        "## Configuração do ElevenLabs (igual em todas as partes)",
        "- **Modelo:** Eleven Multilingual v2 (se aparecer o **Eleven v3** e você quiser testar: ele é mais expressivo, mas aí apague as linhas `<break>`).",
        "- **Estabilidade:** 35%  ·  **Semelhança:** 75%  ·  **Exageração do estilo:** 45%  ·  **Reforço de voz:** ligado  ·  **Velocidade:** 1.0",
        "- Voz que soa **robótica**: desça a Estabilidade (30%). Voz que **exagera** ou muda de jeito no meio: suba (45%).",
        "",
        "## Como gerar: uma parte de cada vez",
        "1. Cole **uma parte** por vez (o texto da caixa), gere e **ouça com atenção**.",
        "2. Frase emendada, sem respiro, ou com jeito de leitura: **gere a mesma parte de novo**. Cada geração sai diferente, e como a parte é curta, refazer custa pouco.",
        "3. Gostou? Baixe em MP3 e nomeie **parte-1.mp3**, **parte-2.mp3** ... até **parte-6.mp3**.",
        "4. Não apague as linhas `<break time=\"3.0s\" />`: é nelas que eu corto as cenas dentro da parte.",
        "5. Quando tiver as 6, suba todas na pasta **gravacoes/** do GitHub e me avise. Eu junto na ordem, nivelo o volume e encaixo em cada cena.",
        "",
    ]
    total = 0
    for k, (i, j) in enumerate(PARTES_APRES, 1):
        cenas = ap[i - 1:j]
        texto = sep.join(falado(f) for _, _, f in cenas); total += len(texto)
        linhas += ["---", "", f"## PARTE {k} de {len(PARTES_APRES)}  (cenas {i} a {j} · {len(texto)} caracteres)", "", "```text", texto, "```", ""]
    linhas.insert(linhas.index("## Como gerar: uma parte de cada vez"), f"> A apresentação inteira tem **{total} caracteres**, em {len(PARTES_APRES)} partes.\n")
    # tutoriais (para depois): um texto por função
    linhas += ["---", "", "# Tutoriais por função (para depois)", "", "Mesmo método: uma função por vez. Nomeie **tutorial-conferente.mp3**, **tutorial-motorista.mp3** etc.", ""]
    manifesto = [{"bloco": 1, "cenas": [{"alvo": a, "id": c} for a, c, _ in cenas_do_bloco(BLOCOS[0][1])]}]
    for alvo in ("conferente", "motorista", "vendedor", "expedicao", "administrativo", "diretoria"):
        cs = cenas_do_bloco([(alvo, None)])
        linhas += [f"## Tutorial: {alvo}  ({len(cs)} cenas)", "", "```text", sep.join(falado(f) for _, _, f in cs), "```", ""]
    (RAIZ / "assets/apresentacao/ROTEIRO-VOZ.md").write_text("\n".join(linhas) + "\n", encoding="utf8")
    (RAIZ / "scripts/blocos-voz.json").write_text(json.dumps(manifesto, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    print(f"ROTEIRO-VOZ.md gerado: apresentação em {len(PARTES_APRES)} partes ({total} caracteres) + 6 tutoriais.")


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
        so_apres = [c for c in cenas if c["alvo"] == "apresentacao"]
        if len(trechos) == len(so_apres) != len(cenas):
            cenas = so_apres  # só a apresentação foi gravada
            print("\n(Gravação só da apresentação.)")
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
        arqs.sort(key=lambda x: [int(n) for n in re.findall(r"\d+", Path(x).name)] or [0])  # parte-1, parte-2 ... na ordem certa, mesmo com parte-10
        cortar(arqs, sil, ruido, so)
