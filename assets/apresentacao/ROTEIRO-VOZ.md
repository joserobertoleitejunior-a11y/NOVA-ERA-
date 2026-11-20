# Roteiro de voz — Confere Carga (apresentação + 6 tutoriais)

Um único arquivo com **tudo o que precisa ser narrado**. São 5 blocos: gere **um áudio por bloco** no ElevenLabs.
Eu corto cada bloco em cenas e coloco no lugar certo.

## Antes de gerar (1 vez só)
1. No ElevenLabs, abra **Text to Speech** e escolha o modelo **Eleven Multilingual v2** (ele entende as pausas do roteiro).
2. Escolha uma **voz brasileira natural**. Dica: ouça 3 vozes lendo a abertura do Bloco 1 e fique com a mais calorosa, não a mais “locutor”.
3. Ajustes da voz (ícone de engrenagem): **Stability 40%**, **Similarity 75%**, **Style 40%**, **Speaker boost ligado**, velocidade **1.0**.
   Mais estabilidade deixa a voz mais seca; menos deixa mais viva. Se ficar teatral demais, suba a Stability para 50%.
4. Use a **mesma voz e os mesmos ajustes nos 5 blocos**, para a apresentação toda soar como a mesma pessoa.

## Como gerar cada bloco
- Copie **só o texto dentro da caixa** do bloco (o botão de copiar da caixa serve) e cole no ElevenLabs, sem mudar nada.
- As marcas `<break time="3.0s" />` são as pausas **entre cenas**. É nelas que eu corto: não apague.
- Gere, ouça tudo, e baixe em mp3. Nomeie **bloco-01.mp3, bloco-02.mp3 ... bloco-05.mp3**.
- Se uma frase ficou estranha, **gere o bloco de novo** (cada geração sai um pouco diferente). Se persistir, me diga a cena e eu ajusto o texto.
- Se uma palavra sair com o sotaque errado, me diga qual: eu troco a grafia no roteiro.

## Enviar os áudios
Coloque os 5 mp3 na pasta **gravacoes/** do repositório (GitHub → Add file → Upload files, na branch `claude/nova-era-app-6pqjx1`) e me avise.
Eu confiro, corto por cena e ligo na apresentação e nos tutoriais.

> Custo: o ElevenLabs cobra por caractere. O total abaixo é a soma dos 5 blocos; refazer um bloco gasta de novo aquele bloco.
> **Total dos 5 blocos: 11732 caracteres.**

---

## BLOCO 01 — Apresentação · parte 1  (9 cenas · 2713 caracteres)

Cenas, em ordem: apresentacao/01-abertura · apresentacao/02-problema · apresentacao/03-entrar · apresentacao/04-inicio · apresentacao/05-nota · apresentacao/06-xml-ia · apresentacao/07-conferencia · apresentacao/08-etiquetas · apresentacao/09-avisos

```text
Olá, e obrigado pelo tempo de vocês. Eu vou mostrar o Confere Carga: o aplicativo feito sob medida pra Nova Era conferir cada carga, antes do caminhão sair do pátio. Em poucos minutos, vocês vão ver cada função funcionando de verdade, direto no aplicativo.
<break time="3.0s" />
Primeiro, o problema. E ele é simples. Peça que sai a mais do que está na nota, ninguém cobra. Peça que falta, vira reclamação do cliente. E sem conferência, o estoque vai ficando errado, sem ninguém perceber. O Confere Carga resolve isso: ele confere a carga com a nota, avisa na hora, e ainda cuida do estoque.
<break time="3.0s" />
Cada pessoa entra com o seu próprio usuário e senha. A administração enxerga tudo. O conferente vê só o que precisa pra conferir. E o motorista só acompanha a fila e os avisos. Assim, cada um faz a sua parte, sem confusão.
<break time="3.0s" />
Quando alguém abre o aplicativo, a primeira coisa que vê é uma frase: está tudo certo, ou tem algo precisando de atenção. Se tiver problema, é só tocar em resolver agora. E logo abaixo, botões grandes e simples: o que você quer fazer?
<break time="3.0s" />
Chegou uma nota nova? <break time="0.4s" /> Ela entra na fila em quatro passos. Primeiro, como a nota chegou. Depois, o número e o cliente. Em seguida, os itens. E, por fim, confirmar. Pronto! <break time="0.4s" /> Os conferentes recebem o aviso no próprio celular.
<break time="3.0s" />
Se o escritório já tem o arquivo xis ême éle da nota, melhor ainda. O aplicativo lê sozinho o número, o cliente e todos os itens, e dá pra mandar várias notas de uma só vez. E na versão premium, até a foto da nota é lida pela inteligência artificial, que preenche tudo pra você.
<break time="3.0s" />
Agora, o coração do aplicativo: a conferência. O conferente abre a fila, toca na nota e escolhe o caminhão. Se a carga está certa, toca em tudo confere. Se tem alguma coisa diferente, ele informa quantas peças subiram. Depois, tira a foto da carga e a foto da placa. E pronto: a conferência fica registrada, com a hora, as fotos, e o nome de quem conferiu. E ninguém consegue apagar.
<break time="3.0s" />
Pra conferir ainda mais rápido, a nota gera etiquetas com quiú érre côde, uma pra cada peça. Na hora de conferir, o conferente aponta a câmera, e o aplicativo conta peça por peça, sozinho. E se a etiqueta for de outra nota, ele avisa na hora.
<break time="3.0s" />
Se saiu peça a mais, se faltou peça, se o estoque ficou negativo, ou se alguma coisa foi conferida fora do horário, a administração é avisada na hora. No sino do aplicativo, no celular, e com um botão pra mandar a mensagem direto no Uótsap. Ninguém precisa ficar abrindo o aplicativo pra procurar problema. O problema é que vem até você.
```

---

## BLOCO 02 — Apresentação · parte 2  (8 cenas · 2025 caracteres)

Cenas, em ordem: apresentacao/10-estoque · apresentacao/11-contagem · apresentacao/12-equipe · apresentacao/13-frota · apresentacao/14-assistente · apresentacao/15-rastreio · apresentacao/16-site · apresentacao/17-fechamento

```text
O estoque se atualiza sozinho, a cada carga conferida. Cada produto mostra, em uma só palavra, se está ok, baixo, ou negativo. E quando a fábrica produz, a entrada é lançada em quatro passos.
<break time="3.0s" />
Tem também a contagem rápida do dia. O aplicativo escolhe os produtos que mais valem a pena contar, e leva uns três minutos. A pessoa conta por pilhas, sem ver o número do sistema, pra ninguém chutar. E se a contagem não bater, quem decide é a administração: corrigir o estoque, ou pedir pra contar de novo.
<break time="3.0s" />
Cadastrar uma pessoa também é passo a passo: uma pergunta por tela. O nome, a função, o Uótsap e, se quiser, a foto. O aplicativo cria o usuário e a senha sozinho, e manda no Uótsap da pessoa um link com o acesso e um vídeo ensinando a função dela. E fica registrado qual administrador fez o cadastro.
<break time="3.0s" />
A frota também fica cadastrada. Cada caminhão tem placa, tipo, marca, modelo, capacidade, e fotos de frente, de lado e de trás. Na hora de conferir, o conferente só escolhe o caminhão certo na lista.
<break time="3.0s" />
E, na versão completa, a administração conta com um assistente de inteligência artificial. Ele responde com os dados reais da empresa: o resumo do dia, o que saiu a mais, o que está faltando no estoque… e até explica o painel. Ele só fala sobre a Nova Era. Qualquer outro assunto, ele recusa. E os funcionários não têm acesso a ele.
<break time="3.0s" />
E o cliente? <break time="0.4s" /> Ele recebe um link no Uótsap e acompanha a entrega: o horário em que o caminhão saiu, o que foi carregado, e a foto da carga. Menos ligação, menos dúvida, e muito mais confiança na Nova Era.
<break time="3.0s" />
E o site da Nova Era mostra os produtos com fotos reais, e maquetes em três dê que se montam enquanto a página rola. O cliente monta a lista de orçamento, e fala com a equipe, tudo num lugar só.
<break time="3.0s" />
O Confere Carga é isso: menos erro, menos prejuízo, e mais controle sobre tudo que sai da Nova Era. Muito obrigado.
```

---

## BLOCO 03 — Tutoriais · conferente e motorista  (12 cenas · 2595 caracteres)

Cenas, em ordem: conferente/01-entrar · conferente/02-fila · conferente/03-conferir · conferente/04-diferenca · conferente/05-etiquetas · conferente/06-contagem · conferente/07-avisos · conferente/08-ajuda · motorista/01-entrar · motorista/02-fila · motorista/03-avisos · motorista/04-cliente

```text
Pra entrar, abra o endereço do aplicativo, digite o usuário e a senha que aparecem na sua tela de boas-vindas, e toque em entrar. A primeira tela que você vê é a fila de notas.
<break time="3.0s" />
Essa é a fila: as notas que estão esperando conferência. Quando o caminhão for carregado, é só tocar na nota. E se chegou carga sem nota na fila, use o botão grande: conferir uma carga.
<break time="3.0s" />
Vamos conferir uma carga, passo a passo. Toque na nota. Escolha o caminhão que vai sair. Agora olhe a carga: se cada peça confere com a nota, toque em tudo confere. Depois, tire a foto do caminhão carregado, e a foto da placa. E confirme. Pronto! <break time="0.4s" /> A conferência fica registrada, com a hora e as fotos.
<break time="3.0s" />
E se alguma peça não confere? <break time="0.4s" /> Sem problema. Toque em diferente, naquele item, e diga quantas peças subiram no caminhão. O aplicativo mostra se foi a mais, ou a menos. No fim, você escolhe o motivo. E a administração é avisada na hora.
<break time="3.0s" />
Quer conferir mais rápido? <break time="0.4s" /> Use contar lendo as etiquetas. Aponte a câmera pro quiú érre de cada peça, e o aplicativo conta sozinho. Se a etiqueta for de outra nota, ele avisa.
<break time="3.0s" />
Quando pedirem, ou quando você tiver um tempinho, faça a contagem do dia. O aplicativo escolhe os produtos mais importantes. Conte as pilhas e as peças soltas, sem olhar o número do sistema. Leva uns três minutos.
<break time="3.0s" />
O sino mostra os seus avisos: nota nova na fila, e pedido de contagem. Ligue os avisos do celular, e você recebe tudo sem precisar abrir o aplicativo.
<break time="3.0s" />
Ficou com dúvida? <break time="0.4s" /> Em qualquer tela, toque em ajuda, lá no alto. O aplicativo mostra o que fazer ali. E se travar, chame a expedição. Bom trabalho!
<break time="3.0s" />
Pra entrar, abra o endereço do aplicativo, digite o usuário e a senha que aparecem na sua tela de boas-vindas, e toque em entrar. Você vai acompanhar a fila e os avisos.
<break time="3.0s" />
A sua tela mostra as notas que estão esperando conferência. Você não precisa conferir nada: quem confere a carga é o conferente. Quando a conferência termina, o caminhão está liberado pra sair.
<break time="3.0s" />
Fique de olho no sino. Quando tiver algum aviso pra você, ele aparece ali. E também no celular, se você ligar os avisos.
<break time="3.0s" />
Depois da conferência, o vendedor manda um link pro cliente. Ele vê a hora em que você saiu, o que foi carregado, e a foto da carga. Por isso: só saia do pátio depois que a carga for conferida.
```

---

## BLOCO 04 — Tutoriais · vendedor e expedição  (13 cenas · 2371 caracteres)

Cenas, em ordem: vendedor/01-entrar · vendedor/02-inicio · vendedor/03-nota · vendedor/04-cargas · vendedor/05-rastreio · vendedor/06-avisos · expedicao/01-entrar · expedicao/02-inicio · expedicao/03-nota · expedicao/04-cargas · expedicao/05-estoque · expedicao/06-equipe · expedicao/07-avisos

```text
Pra entrar, abra o endereço do aplicativo, digite o usuário e a senha que aparecem na sua tela de boas-vindas, e toque em entrar. Aqui você vê as notas e as cargas, e manda o rastreio pro cliente.
<break time="3.0s" />
Na tela inicial, uma frase mostra se está tudo certo. E embaixo ficam os botões do que você faz: lançar uma nota, e ver as cargas.
<break time="3.0s" />
Pra lançar uma nota: escolha como ela chegou, digite o número e o cliente, escolha os produtos, e confirme. Ela entra na fila, e os conferentes são avisados.
<break time="3.0s" />
Na aba cargas, você vê tudo que já saiu. Toque numa carga pra ver os itens, as fotos, e se teve diferença.
<break time="3.0s" />
Agora, o melhor pro seu cliente. Dentro da carga, toque em enviar ao cliente, e escolha o Uótsap dele. Ele recebe um link com o horário de saída, o que foi carregado, e a foto da carga. Menos ligação, mais confiança.
<break time="3.0s" />
Os avisos chegam no sino e no celular: nota conferida, diferença na carga, e outros recados da operação.
<break time="3.0s" />
Pra entrar, abra o endereço do aplicativo, digite o usuário e a senha que aparecem na sua tela de boas-vindas, e toque em entrar. Você comanda a operação: notas, cargas, estoque e equipe.
<break time="3.0s" />
Na tela inicial, uma frase diz se está tudo certo. Se tiver problema, toque em resolver agora. E embaixo, os botões do que você quer fazer.
<break time="3.0s" />
Pra lançar uma nota, escolha como ela chegou: arquivo xis ême éle, foto, ou digitando. Depois, número, cliente, itens, e confirmar. Se você tiver o xis ême éle, o aplicativo lê tudo sozinho.
<break time="3.0s" />
Na aba cargas, você vê tudo que saiu. Dá pra filtrar só as que tiveram diferença. Toque numa carga pra ver as fotos, os itens, e imprimir as etiquetas.
<break time="3.0s" />
O estoque se atualiza sozinho, a cada carga conferida. Pra corrigir, a equipe faz a contagem do dia, e você decide: corrigir o estoque, ou contar de novo.
<break time="3.0s" />
Pra cadastrar uma pessoa: nome, função, Uótsap e foto, um passo de cada vez. O aplicativo cria o usuário e a senha, e manda no Uótsap dela um link com o acesso, e o vídeo tutorial da função.
<break time="3.0s" />
O aplicativo avisa você na hora: peça a mais na carga, estoque baixo, nota parada na fila, conferência fora do horário, e pedido de ajuda de senha. Tudo no sino, e no celular.
```

---

## BLOCO 05 — Tutoriais · administrativo e diretoria  (12 cenas · 2028 caracteres)

Cenas, em ordem: administrativo/01-entrar · administrativo/02-inicio · administrativo/03-xml · administrativo/04-equipe · administrativo/05-frota · administrativo/06-avisos · diretoria/01-entrar · diretoria/02-inicio · diretoria/03-resumo · diretoria/04-ia · diretoria/05-equipe · diretoria/06-avisos

```text
Pra entrar, abra o endereço do aplicativo, digite o usuário e a senha que aparecem na sua tela de boas-vindas, e toque em entrar. Você cuida dos cadastros: notas, equipe, frota e produtos.
<break time="3.0s" />
Na tela inicial, uma frase mostra se está tudo certo, e botões simples levam a cada tarefa. Tem também o botão pra ver o resumo completo.
<break time="3.0s" />
Pra lançar várias notas de uma vez, use o arquivo xis ême éle. Escolha os arquivos, confira o que foi lido, e envie. Os produtos que ainda não existem são cadastrados sozinhos.
<break time="3.0s" />
Na aba mais, equipe: cadastre pessoas, mude o Uótsap, a foto ou a função, e gere uma senha nova pra quem esqueceu.
<break time="3.0s" />
Cadastre os caminhões com placa, dados e fotos. E os produtos, com estoque mínimo e peças por pilha. Isso deixa o aplicativo bem mais esperto.
<break time="3.0s" />
Os avisos mostram o que precisa de atenção. Quem esquece a senha manda um pedido, e ele aparece aqui, pra você.
<break time="3.0s" />
Pra entrar, abra o endereço do aplicativo, digite o usuário e a senha que aparecem na sua tela de boas-vindas, e toque em entrar. Você vê a empresa inteira em uma tela.
<break time="3.0s" />
A tela inicial mostra, em uma frase, como está a empresa agora. Verde: tudo certo. Amarelo ou vermelho: toque em resolver agora.
<break time="3.0s" />
O resumo completo traz os números do dia, da semana e do mês: quantas cargas, quantas com diferença, onde mais erra, e como está a equipe. E cada recado leva direto à tela pra resolver.
<break time="3.0s" />
Na versão completa, você pergunta pro assistente de inteligência artificial: resumo do dia, o que saiu a mais, estoque baixo, notas paradas. Ele responde com os dados reais, explica o painel, e só fala da Nova Era.
<break time="3.0s" />
Na equipe, cada pessoa mostra qual administrador a cadastrou, e quando. É o registro de quem deu acesso.
<break time="3.0s" />
Os avisos críticos chegam no sino e no seu celular, com um botão pra chamar no Uótsap quem precisa resolver.
```

