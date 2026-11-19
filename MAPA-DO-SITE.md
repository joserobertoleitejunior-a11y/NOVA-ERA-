# MAPA DO SITE — Nova Era
> "Onde está cada coisa" para qualquer alteração futura (humana ou IA). Ler junto com `PADROES-AGENCIA.md` e `BRIEFING-NOVA-ERA.md`.
> Para achar um bloco no HTML, busque o comentário-marcador (ex.: `===== CALCULADORA`).

## 1. Alterações mais comuns → onde mexer

| Quero mudar... | Arquivo | Onde |
|---|---|---|
| Telefone, WhatsApp, endereço, mapa, horário, capacidade da betoneira | `assets/js/config.js` | `window.NOVA_ERA` (único ponto; site e app leem daqui) |
| Selo "Aberto agora / Fechado" | `config.js` → `horarios` | atualiza sozinho a cada minuto |
| Produtos do site (cards e lista de orçamento) | `assets/js/site.js` | `PRODUTOS` |
| Perguntas frequentes | `assets/js/site.js` | `FAQ` |
| Fotos da galeria | `assets/js/site.js` → `FOTOS` + `assets/img/site/*-900.webp` e `*-1600.webp` | |
| Textos do hero, passos da entrega, concreto, drenagem, contato | `index.html` | blocos `===== ...` |
| Cores, vidro (Liquid Glass), botões | `assets/css/marca.css` | tokens no `:root` e bloco `LIQUID GLASS` no fim |
| Layout do site | `assets/css/site.css` | |
| Fonte | `assets/fonts/archivo-latin.woff2` (Archivo variável, peso + largura) | `@font-face` no topo de `marca.css`; títulos usam `--largura-marca` |
| Efeitos de rolagem | `assets/js/motion.js` | atributos no HTML (abaixo) |
| Logo NE (oficial, em vetor) | `assets/img/marca/ne-cor.svg`, `ne-branco.svg`, `ne-azul.svg` + `NE.marca()` em `icones.js` | redesenhado do logo da empresa |
| Posts do Instagram (26, sem as marcas do app) | `assets/img/insta/*-540/1080.webp` + `posts.json`; lista em `site.js` → `FOTOS` | |
| Fotos de fundo (sem texto) | `assets/img/fundo/` | usadas nas faixas estilo post |
| Versão de cache | `index.html`, `app.html`, `rastreio.html` (`?v=`) e `sw.js` (`VERSAO`) | trocar a cada publicação |

## 2. Efeitos de rolagem (`motion.js`, sem bibliotecas)
| Atributo | Efeito |
|---|---|
| `data-revelar` (`sobe`, `esq`, `dir`, `zoom`, `cortina`) | surge ao entrar na tela |
| `data-revelar-grupo` | filhos surgem em sequência |
| `data-letras` | título se monta (por letra no PC forte, por palavra no celular) |
| `data-faixa="1"` / `"-1"` | faixa de texto que anda na horizontal com a rolagem |
| `data-parallax="0.22"` | profundidade (foto do topo) |
| `data-linha-progresso` | linha do passo a passo que enche |
| `data-tilt` / `data-magnetico` | card inclina / botão puxado pelo mouse (só PC) |
| `.progresso-leitura`, header `data-esconde` | barra no topo; topo some ao descer e volta ao subir |

**Leveza:** em navegador atual, faixas, profundidade, barra e linha usam a animação de rolagem do próprio navegador (CSS `animation-timeline`, placa de vídeo, zero JavaScript). Navegador antigo usa `motion.js` (lê tudo e depois escreve tudo, um laço por quadro). Letras sem desfoque. Seções longe da tela com `content-visibility: auto`. Medido com processador 4× mais lento: 60 quadros/s, nenhuma travada.

## 3. Níveis de aparelho (`dispositivo.js`, no `<head>`)
`html[data-qualidade]`: `alta` (PC forte) · `media` · `baixa` (≤ 4 GB/4 núcleos: vidro sem desfoque, títulos por palavra) · `estatica` (menos movimento, economia de dados, 2G: sem efeitos).
Testar com `?qualidade=baixa` (ou `alta`, `media`, `estatica`). Também fixa a altura da tela (`--vh`) e bloqueia o zoom.

## 4. Arquivos
```
index.html            Site institucional (hero, faixas, destaques, produtos, como funciona, concreto, calculadora,
                      drenagem, galeria, rastreio, FAQ, contato, flutuantes, gaveta de orçamento, foto em tela cheia)
app.html              App Confere Carga (conferentes)
admin.html            Painel de administração (só papel admin; entrada no mesmo app.js via NE_ENTRADA)   ·   rastreio.html   Página do cliente (link do WhatsApp)
assets/js/config.js   ★ Configuração única
assets/js/dispositivo.js  Nível do aparelho, altura da tela, sem zoom
assets/js/motion.js   Efeitos de rolagem
assets/js/site.js     Site: selo de horário, lista de orçamento, calculadora, galeria, FAQ, rastreio
assets/js/*.js        App: dados, assistente (passo a passo), conferir, nfe (leitura da nota), janela, rastreio,
                      etiquetas, tour, ajuda (treinos), cadastros, painel, app
assets/css/marca.css  Identidade + Liquid Glass (site e app)   ·   assets/css/site.css   Layout do site
supabase/             migrations/ (001, 002) e functions/ (criar-funcionario, rastreio)
sw.js                 Abre o app na hora (arquivos guardados); dados do Supabase nunca passam por ele
```

## 5. Regras
- Sem rolagem lateral de 320 a 1920 px (`html { overflow-x: clip }`).
- Tudo respeita "reduzir movimento" (nível `estatica`).
- Nada de Google Fonts: fonte hospedada no próprio site.
