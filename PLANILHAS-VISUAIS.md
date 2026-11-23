# Planilhas visuais (Confere Carga)

Toda planilha do app abre como um **painel que dá para entender de relance**: números-chave que sobem, gráficos que crescem, selos coloridos na situação e barrinhas dentro da tabela. Dali a pessoa **baixa a planilha em Excel** (organizada, com resumo e gráficos de verdade) ou **imprime** (os gráficos vão no papel).
É do pacote Intermediário em diante (ver `PACOTES.md`); o histórico de atividades é do Premium.

## Onde ficam
- **Cargas** → botão **Planilha e gráficos (30 dias)** · **Mais → Planilha de cargas**
- **Estoque** → **Planilha e gráficos**
- **Histórico** → **Planilha e gráficos** (leva os mesmos filtros da tela: período, tipo, pessoa e busca)
- **Mais → Imprimir → Relatórios**: movimentação de estoque, estoque agora, notas na fila, cargas, contagens e histórico
- **Assistente**: depois de uma lista ele pergunta "Quer imprimir isto?" e o botão abre o mesmo painel

Nenhum botão baixa mais um arquivo seco: todos abrem o painel, que tem **Baixar planilha** e **Imprimir** dentro (e o CSV simples, para quem prefere).

## O que cada planilha mostra
| Planilha | Números-chave | Gráficos |
|---|---|---|
| Estoque agora | Produtos · Em dia · Abaixo do mínimo · Negativos | Quanto tem de cada produto (o risco marca o mínimo) · rosca da situação |
| Movimentação de estoque | Lançamentos · Entradas · Saídas · Perdas · Saldo do período | Entradas, saídas e perdas por hora, dia ou semana · produtos que mais se mexeram |
| Notas na fila | Na fila · Paradas · Espera mais longa · Espera média | Há quanto tempo cada nota espera (risco no limite da empresa) · notas por vendedor |
| Cargas conferidas | Cargas · Corretas · Com diferença · % corretas · Peças a mais e a menos | Por dia (corretas × com diferença) · rosca "bateu com a nota?" · quem conferiu |
| Contagens | Contagens · Aplicadas · Aguardando decisão · Com diferença | Rosca por situação · onde mais deu diferença |
| Histórico de atividades | Atividades · Pessoas · Notas mexidas · Cargas conferidas | Por dia · quem mais fez · o que foi feito |

O assistente também monta: diferenças por produto, desempenho da equipe, resumo, equipe, produtos, caminhões, notas, contagem sugerida e o estoque do vendedor (só o que ele pode vender).
Cor quer dizer uma coisa só: verde está bem, azul é informação, âmbar pede atenção, vermelho é problema. Números-chave sem "bom ou ruim" (por vendedor, por função) usam cores de categoria.

Na tabela: a situação vira **selo colorido** (OK, Baixo, Negativo · Entrada, Saída, Perda · Confere, Com diferença), quantidade com sinal fica verde ou vermelha, e saldo e espera ganham uma **barrinha** proporcional.

## Animação
Os números sobem de zero até o valor, as barras crescem a partir da base, a rosca se desenha e as linhas da tabela entram em sequência (menos de 1,5 s no total). Quem escolheu **menos movimento** no aparelho (ou está em aparelho fraco) vê tudo pronto, sem animação. Ao trocar o papel de impressão a animação **não recomeça**.

## No papel
- **A4 em pé ou deitado**: números-chave, os gráficos lado a lado e a tabela inteira, em cores.
- **Cupom 80 e 58 mm**: preto e branco, no máximo 2 gráficos, e cada tom vira um cinza diferente; todo número vem escrito (não depende de cor). Em 58 mm as letras dos gráficos ficam pequenas.

## A planilha em Excel (`.xlsx`)
Abre no Excel, no Google Planilhas, no Numbers e no LibreOffice. Duas abas:
- **Resumo**: título, números-chave em cartões coloridos e os **gráficos de verdade** (barras, barras na horizontal e rosca). Os números de cada gráfico ficam numa tabelinha ao lado, então dá para mexer e refazer. Imprime numa folha só.
- **Planilha**: cabeçalho colorido, primeira linha fixa, filtros ligados, colunas na largura certa, números **como número** (dá para somar, ordenar e filtrar; a unidade "un" aparece mas não atrapalha), selos de situação coloridos, quantidades verdes e vermelhas e barras de dados nas colunas de saldo e espera.
O arquivo é escrito pelo próprio app (sem biblioteca): `assets/js/planilha.js`.

## Como é feito (para quem for mexer)
- `assets/js/relatorio-visual.js` — **um código só**, sem tela, que calcula números-chave, gráficos e destaques de coluna a partir dos dados de cada relatório. Roda no app, na demonstração e **no servidor do assistente** (com uma cópia exata em `supabase/functions/assistente/relatorio-visual.js`; `tests/copias.test.js` confere).
- `assets/js/graficos.js` — desenha em SVG (tela e papel) e anima.
- `assets/js/planilha.js` — escreve o `.xlsx`.
- `assets/js/relatorios.js` — monta cada relatório e a janela; `ia.js` abre os blocos que o assistente manda.
- Formato do bloco: `{ id, titulo, subtitulo, colunas: [{ rotulo, dir?, visual?, tons?, icones?, valores? }], linhas, resumo: [[rótulo, texto, { tom, numero?, sufixo?, icone? }]], graficos: [{ tipo: "barras" | "barrasH" | "rosca", titulo, ... }], arquivo }`. Bloco antigo, só com tabela, ainda abre (com o número de linhas).
- Testes: `node --test tests/relatorio-visual.test.js tests/copias.test.js tests/assistente.test.js`.

## Limites
- A animação existe no app; o Excel e o papel não animam.
- Os gráficos do Excel foram conferidos no LibreOffice e lidos por programa (openpyxl); o arquivo segue o formato padrão, mas **não abri no Excel da Microsoft, no Google Planilhas nem no Numbers**. Se algo ficar estranho, avise o modelo do programa.
- Relatórios com mais de 2.000 linhas (histórico) ou 600 (assistente) levam só as mais recentes.
