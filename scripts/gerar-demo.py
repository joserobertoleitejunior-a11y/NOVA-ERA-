"""Gera um único HTML da demonstração (modo demo, sem Supabase) para prévia/apresentação.
Uso: python3 scripts/gerar-demo.py SAIDA.html"""
import pathlib, sys
raiz = pathlib.Path(__file__).resolve().parent.parent
js = ["icones.js", "ui.js", "dados.js", "assistente.js", "nfe.js", "conferir.js", "janela.js", "tour.js", "painel.js", "cadastros.js", "ajuda.js", "app.js"]
css = (raiz / "assets/css/marca.css").read_text(encoding="utf-8")
scripts = "\n".join(f"<script>\n{(raiz / 'assets/js' / f).read_text(encoding='utf-8')}\n</script>" for f in js)
html = f"""<title>Confere Carga Nova Era</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap">
<style>
{css}
</style>
<header class="topo">
  <div class="topo-linha">
    <span class="logo"><span id="logo"></span><small>Confere Carga</small></span>
    <div class="usuario" id="usuario"></div>
  </div>
  <div class="faixas" aria-hidden="true"></div>
</header>
<div class="selo-demo" id="selo-demo" hidden></div>
<main><div id="conteudo"></div></main>
<script>window.NOVA_ERA = {{ demo: true }};</script>
{scripts}
"""
pathlib.Path(sys.argv[1]).write_text(html, encoding="utf-8")
print("ok", len(html))
