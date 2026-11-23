# Etiquetas, QR code e impressão (Confere Carga)

Tudo sai de **um motor só**: a etiqueta é desenhada uma vez e pintada por três caminhos (tela e diálogo de impressão, PDF/imagem e impressora direta). O que a pessoa vê na prévia é o que sai no papel.
Onde fica: **Mais → Imprimir** e o botão **Etiqueta** nas telas de nota, cadastro de produto e cartão de acesso. É do pacote Intermediário em diante (ver `PACOTES.md`).

## A etiqueta padrão
Qualquer pessoa que olhar entende na ordem em que lê:

```
┌──────────────────────────────────────────┐
│ NF 48213                  PEÇA 8 DE 60   │  1. faixa preta: de qual nota e qual peça (ou QTD)
├──────────────────────────────────────────┤
│ Meio-fio 30 x 12 x 100         ▓▓▓▓▓▓    │  2. nome grande do produto
│ reforçado                      ▓ QR ▓    │
│ CLIENTE                        ▓▓▓▓▓▓    │  3. dados pequenos (cliente, caminhão, data)
│ Construtora Alfa               LER NO APP│  4. QR com a instrução e o código curto
│ CAMINHÃO     DATA              NF 48213·8/60
│ ABC1D23      23/11/2026                  │
│ NOVA ERA · CONFERE CARGA                 │  5. rodapé da marca
└──────────────────────────────────────────┘
```

- Só preto no branco (sai igual em térmica e em laser), letras grandes e margem de segurança de 2 mm.
- Quatro tipos: **nota por produto** (uma etiqueta por item, com a quantidade), **nota por peça** ("PEÇA 3 DE 40", uma por peça), **produto** (código, mínimo, unidade, "PILHA DE n") e **cartão de acesso** (usuário, senha e QR que abre o app).
- A mesma tela mostra a legenda **Como ler uma etiqueta** (Imprimir → Como ler uma etiqueta), para quem vê pela primeira vez.

## Papéis (todos com prévia em tamanho real)
| Papel | Para quê |
|---|---|
| Térmica 100 × 50 mm (padrão) | rolo de etiqueta: Zebra, Elgin, Argox, TSC e parecidas |
| Térmica 100 × 150 mm | etiqueta grande, QR bem grande |
| Térmica 60 × 40 mm · 50 × 30 mm | etiquetas pequenas (a 50 × 30 só o essencial) |
| Folha A4 · 10 por folha (99 × 57 mm) · 24 por folha (63,5 × 33,9 mm) · uma por folha | impressora comum; dá para **começar na etiqueta nº N** e reaproveitar a folha usada pela metade |
| Outro tamanho (20 a 300 mm de largura, 15 a 400 mm de altura) | rolo diferente |

O cartão de acesso leva um QR longo e só é oferecido em etiqueta de 90 mm ou mais.

## O QR code
| Etiqueta | O que vai dentro |
|---|---|
| Peça da nota | `…/rastreio.html?c=<código da nota>&p=<produto>-<peça>` (o cliente também lê e vê o rastreio) |
| Nota inteira | `…/rastreio.html?c=<código da nota>` |
| Produto | `…/app.html#p=<código do produto>` (abre o produto para quem está logado) |
| Digitado à mão | o número da nota (`48213`) ou o código curto impresso embaixo (`NF 48213 · 8/60`, `P-9B1DEB4D`) |

Regras que mantêm o QR legível (`etiqueta-layout.js`, provadas em teste):
- cada ponto do QR mede **pelo menos 0,38 mm** e, nas etiquetas de 100 mm, **0,5 mm ou mais** (a prévia avisa se ficar menor);
- margem branca de 4 pontos em volta; correção de erro nível M (cai para L só quando isso evita ponto miúdo);
- no bitmap, cada ponto do QR ocupa um número **inteiro** de pontos da impressora (borda nítida); no PDF o QR vai em **vetor**, então qualquer resolução (150, 203, 300, 600 dpi) refaz a borda sozinha.

Lido de volta no teste com o mesmo leitor do app (ZXing): 100% das combinações de formato × tipo × 203/300 dpi, e também com a imagem reduzida a 55% e borrada nas etiquetas de 100 mm e na folha de 10. As etiquetas pequenas pedem câmera boa.

## Ler o QR (botão **Ler QR da etiqueta**)
A câmera abre a nota ou o produto; se o QR estiver rasgado, digite o número ou o código curto, ou leia de uma foto. Se o QR for de outra coisa, o leitor explica o que dá para ler ali (nunca erra calado).
O botão está onde a leitura serve: Notas, Cargas, Estoque, Contagem, Entrada e perda, Nota nova, Conferência (quem confere vai direto conferir a nota da fila), Imprimir e o atalho **Ler um QR code**. Usa o leitor nativo do aparelho quando existe e o ZXing nos demais (iPhone).

## Imprimir em qualquer impressora
1. **Imprimir** — abre a impressão do aparelho e serve para **qualquer impressora que ele já enxerga**: laser, jato de tinta, térmica com driver, Wi-Fi, USB, Bluetooth com serviço de impressão, AirPrint, "Salvar como PDF". O app ajusta o tamanho da página ao papel escolhido.
2. **PDF ou imagem** — arquivo no tamanho exato do papel, para abrir no aplicativo da própria impressora, mandar pelo WhatsApp ou levar a uma gráfica (**Salvar ou enviar PDF**, **Enviar como imagem**).
3. **Impressora térmica direta (beta)** — Bluetooth ou USB, falando **ESC/POS** (a maioria das térmicas de cupom e Bluetooth) ou **ZPL** (Zebra e compatíveis), para a térmica que não tem driver no aparelho. Em **Imprimir → Impressora** há o **teste de impressão** (borda no tamanho exato, régua de 10 mm e um QR) para conferir escala e margem.

## Relatórios e o histórico de movimentação
Cada relatório abre como **planilha visual** (números-chave que sobem, gráficos animados e tabela colorida), com Excel e papel: veja `PLANILHAS-VISUAIS.md`.
**Imprimir → Relatórios**: Movimentação de estoque (entradas, saídas, perdas e ajustes, com quem lançou, por período e por produto), Estoque agora, Notas na fila, Cargas conferidas, Contagens e, no Premium, Histórico de atividades.
Papéis: A4 em pé, A4 deitado, cupom 80 mm e cupom 58 mm; cada relatório também baixa como planilha (CSV). O rodapé diz quem imprimiu e quando.

## O assistente também imprime
Quando a resposta é uma lista (estoque, movimentação, notas, cargas, equipe, resumo, contagens...), o assistente termina com **"Quer imprimir isto?"** e o app mostra, logo abaixo, o botão **Imprimir: <nome da folha>** com a quantidade de linhas. O botão abre a mesma janela dos relatórios (A4, cupom, planilha).
- A tabela é montada **no servidor, com os mesmos dados que a consulta devolveu**, nunca com texto escrito pela IA: o papel sempre bate com o que o assistente mostrou.
- No máximo 3 folhas por resposta, sem repetir; consulta vazia ou com erro não gera botão.
- Respeita o escopo de quem pergunta: o vendedor só imprime o "Estoque para vender" e as notas dele; o histórico de atividades só sai para diretoria e administrativo no Premium.
- Código: `supabase/functions/assistente/ferramentas-impressao.js` (um formatador por consulta) e `assets/js/ia.js` (o botão).

## Limites (para falar com franqueza ao cliente)
- **Impressão direta por Bluetooth/USB é beta**: só existe no Chrome ou Edge (Android e computador), nunca no iPhone, e foi provada com os bytes (ESC/POS e ZPL conferidos bit a bit) e com um aparelho simulado, **não com a impressora real da Nova Era**. Na primeira vez, faça o teste de impressão e, se algo não fechar, use Imprimir ou o PDF. Para ligar direto sem surpresa, precisamos do **modelo** da impressora.
- O iPhone (Safari) ignora o tamanho de página do diálogo de impressão: nele, use **Salvar ou enviar PDF**.
- Etiquetas de 60 × 40 e 50 × 30 mm têm QR menor: precisam de câmera boa e boa luz.

## Arquivos
- `assets/js/codigos.js` (o que vai no QR e como se entende o que foi lido), `etiqueta-layout.js` (desenho em milímetros e legibilidade), `etiqueta-dados.js` (nota, produto, acesso, teste → etiqueta), `impressao.js` (SVG, bitmap, PDF, ESC/POS, ZPL, Bluetooth, USB, janela), `etiquetas.js` (janelas de etiqueta), `leitor.js` (câmera, digitar, foto), `relatorios.js` (relatórios e planilha), `imprimir.js` (tela Mais → Imprimir).
- Testes: `node --test tests/etiquetas.test.js` (códigos, dados, margens, sem sobreposição, tamanho do ponto do QR, ajuste de texto, folhas).
