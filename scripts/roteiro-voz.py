#!/usr/bin/env python3
"""Roteiro de voz único (ElevenLabs) e recorte dos áudios, para a apresentação e os 6 tutoriais.

  python3 scripts/roteiro-voz.py aplicar     # copia as falas de scripts/falas-humanas.json para os roteiros (legenda = fala)
  python3 scripts/roteiro-voz.py gerar       # escreve assets/apresentacao/ROTEIRO-VOZ.md (o arquivo para colar no ElevenLabs)
  python3 scripts/roteiro-voz.py cortar gravacoes/bloco-01.mp3 [gravacoes/bloco-02.mp3 ...]
                                             # corta cada bloco por cena (nos silêncios longos) e põe cada mp3 no lugar certo
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
    ("Apresentação · parte 1", [("apresentacao", f"{i:02d}") for i in range(1, 10)]),
    ("Apresentação · parte 2", [("apresentacao", f"{i:02d}") for i in range(10, 18)]),
    ("Tutoriais · conferente e motorista", [("conferente", None), ("motorista", None)]),
    ("Tutoriais · vendedor e expedição", [("vendedor", None), ("expedicao", None)]),
    ("Tutoriais · administrativo e diretoria", [("administrativo", None), ("diretoria", None)]),
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
        "Um único arquivo com **tudo o que precisa ser narrado**. São 5 blocos: gere **um áudio por bloco** no ElevenLabs.",
        "Eu corto cada bloco em cenas e coloco no lugar certo.",
        "",
        "## Antes de gerar (1 vez só)",
        "1. No ElevenLabs, abra **Text to Speech** e escolha o modelo **Eleven Multilingual v2** (ele entende as pausas do roteiro).",
        "2. Escolha uma **voz brasileira natural**. Dica: ouça 3 vozes lendo a abertura do Bloco 1 e fique com a mais calorosa, não a mais “locutor”.",
        "3. Ajustes da voz (ícone de engrenagem): **Stability 40%**, **Similarity 75%**, **Style 40%**, **Speaker boost ligado**, velocidade **1.0**.",
        "   Mais estabilidade deixa a voz mais seca; menos deixa mais viva. Se ficar teatral demais, suba a Stability para 50%.",
        "4. Use a **mesma voz e os mesmos ajustes nos 5 blocos**, para a apresentação toda soar como a mesma pessoa.",
        "",
        "## Como gerar cada bloco",
        "- Copie **só o texto dentro da caixa** do bloco (o botão de copiar da caixa serve) e cole no ElevenLabs, sem mudar nada.",
        "- As marcas `<break time=\"3.0s\" />` são as pausas **entre cenas**. É nelas que eu corto: não apague.",
        "- Gere, ouça tudo, e baixe em mp3. Nomeie **bloco-01.mp3, bloco-02.mp3 ... bloco-05.mp3**.",
        "- Se uma frase ficou estranha, **gere o bloco de novo** (cada geração sai um pouco diferente). Se persistir, me diga a cena e eu ajusto o texto.",
        "- Se uma palavra sair com o sotaque errado, me diga qual: eu troco a grafia no roteiro.",
        "",
        "## Enviar os áudios",
        "Coloque os 5 mp3 na pasta **gravacoes/** do repositório (GitHub → Add file → Upload files, na branch `claude/nova-era-app-6pqjx1`) e me avise.",
        "Eu confiro, corto por cena e ligo na apresentação e nos tutoriais.",
        "",
        "> Custo: o ElevenLabs cobra por caractere. O total abaixo é a soma dos 5 blocos; refazer um bloco gasta de novo aquele bloco.",
        "",
    ]
    total = 0
    manifesto = []
    for n, (titulo, itens) in enumerate(BLOCOS, 1):
        cenas = cenas_do_bloco(itens)
        texto = f"\n{PAUSA_CENA}\n".join(falado(f) for _, _, f in cenas)
        total += len(texto)
        manifesto.append({"bloco": n, "arquivo": f"bloco-{n:02d}.mp3", "cenas": [{"alvo": a, "id": c} for a, c, _ in cenas]})
        linhas += [
            f"---", "", f"## BLOCO {n:02d} — {titulo}  ({len(cenas)} cenas · {len(texto)} caracteres)", "",
            "Cenas, em ordem: " + " · ".join(f"{a}/{c}" if a == 'apresentacao' else f"{a}/{c}" for a, c, _ in cenas),
            "", "```text", texto, "```", "",
        ]
    linhas.insert(linhas.index("> Custo: o ElevenLabs cobra por caractere. O total abaixo é a soma dos 5 blocos; refazer um bloco gasta de novo aquele bloco.") + 1, f"> **Total dos 5 blocos: {total} caracteres.**")
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
    manifesto = json.loads((RAIZ / "scripts/blocos-voz.json").read_text(encoding="utf8"))
    listas = {}
    for arq in arqs:
        arq = Path(arq)
        m = re.search(r"bloco-?(\d+)", arq.name)
        if not m:
            sys.exit(f"Nome inesperado: {arq.name} (use bloco-01.mp3 ...)")
        bloco = next((b for b in manifesto if b["bloco"] == int(m.group(1))), None)
        if not bloco:
            sys.exit(f"Bloco {m.group(1)} não existe.")
        with tempfile.TemporaryDirectory() as tmp:
            norm = Path(tmp) / "norm.wav"  # mesmo volume em todos os blocos
            rodar(["ffmpeg", "-y", "-i", str(arq), "-af", "loudnorm=I=-16:TP=-1.5:LRA=9", "-ar", "44100", "-ac", "1", str(norm)])
            segs = segmentos(norm, silencio, ruido)
            esperado = len(bloco["cenas"])
            print(f"\nBloco {bloco['bloco']:02d}: encontrei {len(segs)} trechos; esperado {esperado}.")
            for i, (a, b) in enumerate(segs, 1):
                print(f"  {i:2d}. {a:7.1f}s → {b:7.1f}s  ({b - a:5.1f}s)")
            if len(segs) != esperado:
                print("  ✗ A contagem não bate. Provável causa: uma pausa dentro da cena passou de "
                      f"{silencio}s (aumente --silencio) ou uma pausa entre cenas ficou curta (diminua). Nada foi gravado para este bloco.")
                sys.exit(1)
            for (a, b), c in zip(segs, bloco["cenas"]):
                roteiro = json.loads(arquivo_roteiro(c["alvo"]).read_text(encoding="utf8"))
                pasta = RAIZ / (roteiro.get("audio") or "assets/apresentacao/audio")
                destino = pasta / f"{c['id']}.mp3"
                if not so_conferir:
                    pasta.mkdir(parents=True, exist_ok=True)
                    rodar(["ffmpeg", "-y", "-ss", f"{max(a - 0.12, 0):.3f}", "-to", f"{b + 0.18:.3f}", "-i", str(norm),
                           "-af", "afade=t=in:d=0.04,areverse,afade=t=in:d=0.12,areverse", "-b:a", "128k", str(destino)])
                listas.setdefault(c["alvo"], []).append(c["id"])
                print(f"     → {destino.relative_to(RAIZ)}")
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
