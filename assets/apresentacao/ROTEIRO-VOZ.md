# Roteiro de voz — Confere Carga (apresentação + 6 tutoriais)

Um único arquivo com **tudo o que precisa ser narrado**. São 3 blocos: gere **um áudio por bloco** no ElevenLabs.
Eu corto cada bloco em cenas e coloco no lugar certo.

## Antes de gerar (1 vez só)
1. No ElevenLabs, abra **Text to Speech** e escolha o modelo **Eleven Multilingual v2** (ele entende as pausas do roteiro).
2. Escolha uma **voz brasileira natural**. Dica: ouça 3 vozes lendo a abertura do Bloco 1 e fique com a mais calorosa, não a mais “locutor”.
3. Ajustes da voz (ícone de engrenagem): **Stability 40%**, **Similarity 75%**, **Style 40%**, **Speaker boost ligado**, velocidade **1.0**.
   Mais estabilidade deixa a voz mais seca; menos deixa mais viva. Se ficar teatral demais, suba a Stability para 50%.
4. Use a **mesma voz e os mesmos ajustes nos 3 blocos**, para a apresentação toda soar como a mesma pessoa.

## Como gerar cada bloco
- Copie **só o texto dentro da caixa** do bloco (o botão de copiar da caixa serve) e cole no ElevenLabs, sem mudar nada.
- As marcas `<break time="3.0s" />` são as pausas **entre cenas**. É nelas que eu corto: não apague.
- Gere, ouça tudo, e baixe em mp3. Nomeie **bloco-01.mp3, bloco-02.mp3 e bloco-03.mp3**.
- Se uma frase ficou estranha, **gere o bloco de novo** (cada geração sai um pouco diferente). Se persistir, me diga a cena e eu ajusto o texto.
- Se uma palavra sair com o sotaque errado, me diga qual: eu troco a grafia no roteiro.

## Enviar os áudios
Coloque os 3 mp3 na pasta **gravacoes/** do repositório (GitHub → Add file → Upload files, na branch `claude/nova-era-app-6pqjx1`) e me avise.
Eu confiro, corto por cena e ligo na apresentação e nos tutoriais.

> Custo: o ElevenLabs cobra por caractere. O total abaixo é a soma dos 3 blocos; refazer um bloco gasta de novo aquele bloco.
> **Total dos 3 blocos: 7091 caracteres.**

---

## BLOCO 01 — Apresentação  (17 cenas · 2587 caracteres)

Cenas, em ordem: apresentacao/01-abertura · apresentacao/02-problema · apresentacao/03-entrar · apresentacao/04-inicio · apresentacao/05-nota · apresentacao/06-xml-ia · apresentacao/07-conferencia · apresentacao/08-etiquetas · apresentacao/09-avisos · apresentacao/10-estoque · apresentacao/11-contagem · apresentacao/12-equipe · apresentacao/13-frota · apresentacao/14-assistente · apresentacao/15-rastreio · apresentacao/16-site · apresentacao/17-fechamento

```text
Esse é o Confere Carga: o aplicativo da Nova Era que confere cada carga antes do caminhão sair.
<break time="3.0s" />
O problema é simples: peça que sai a mais não é cobrada, peça que falta vira reclamação, e o estoque fica errado. O aplicativo confere a carga com a nota e avisa na hora.
<break time="3.0s" />
Cada pessoa entra com o seu usuário e senha, e vê só o que precisa pra trabalhar.
<break time="3.0s" />
A tela inicial diz, numa frase, se está tudo certo. Se tiver problema, é só tocar em resolver agora.
<break time="3.0s" />
Uma nota nova entra na fila em quatro passos. Primeiro, como a nota chegou. Depois, o número e o cliente. Em seguida, os produtos e as quantidades. E por fim, confirmar. Pronto! <break time="0.4s" /> Rápido e sem papel. Os conferentes são avisados na hora, no celular.
<break time="3.0s" />
Com o arquivo xis ême éle, o aplicativo lê a nota sozinho: número, cliente e todos os itens. E na versão premium, até a foto da nota.
<break time="3.0s" />
O conferente toca na nota e escolhe o caminhão. Se a carga está certa, toca em tudo confere. Se tem diferença, informa quantas peças subiram. Depois, tira a foto da carga e da placa. Fica tudo registrado, com hora e nome, e ninguém apaga. Tudo em poucos toques.
<break time="3.0s" />
As etiquetas com quiú érre côde fazem a contagem peça por peça, só apontando a câmera.
<break time="3.0s" />
Peça a mais, peça faltando, estoque negativo: a administração é avisada na hora, no celular e no Uótsap.
<break time="3.0s" />
O estoque se atualiza sozinho a cada carga conferida, e mostra em uma palavra se está ok, baixo ou negativo.
<break time="3.0s" />
A contagem rápida leva uns três minutos. Se não bater, a administração decide: corrigir, ou contar de novo.
<break time="3.0s" />
Cadastrar uma pessoa é uma pergunta por tela: nome, função, Uótsap e foto. O aplicativo cria o acesso e manda no Uótsap, com um vídeo ensinando a função. E registra quem cadastrou. Leva um minuto.
<break time="3.0s" />
A frota fica cadastrada, com placa, dados e fotos. Na conferência, é só escolher o caminhão.
<break time="3.0s" />
Na versão completa, um assistente de inteligência artificial responde com os dados reais da empresa. E só fala sobre a Nova Era.
<break time="3.0s" />
O cliente acompanha a entrega por um link no Uótsap: horário de saída, o que foi carregado e a foto da carga.
<break time="3.0s" />
E o site da Nova Era mostra os produtos com fotos reais e maquetes em 3D, e o cliente monta o orçamento ali mesmo.
<break time="3.0s" />
Confere Carga: menos erro, menos prejuízo, mais controle. Obrigado.
```

---

## BLOCO 02 — Tutoriais · conferente, motorista e vendedor  (18 cenas · 2302 caracteres)

Cenas, em ordem: conferente/01-entrar · conferente/02-fila · conferente/03-conferir · conferente/04-diferenca · conferente/05-etiquetas · conferente/06-contagem · conferente/07-avisos · conferente/08-ajuda · motorista/01-entrar · motorista/02-fila · motorista/03-avisos · motorista/04-cliente · vendedor/01-entrar · vendedor/02-inicio · vendedor/03-nota · vendedor/04-cargas · vendedor/05-rastreio · vendedor/06-avisos

```text
Abra o endereço, digite o usuário e a senha da tela de boas-vindas, e toque em entrar. Você cai na fila de notas.
<break time="3.0s" />
Aqui ficam as notas esperando conferência. Com o caminhão carregado, toque na nota.
<break time="3.0s" />
Toque na nota e escolha o caminhão. Olhe a carga: se cada peça confere, toque em tudo confere. Depois, tire a foto do caminhão carregado e a foto da placa, e confirme. Pronto: fica registrado, com hora e foto. Passo a passo, sem pressa. Rápido e fácil.
<break time="3.0s" />
Se uma peça não confere, toque em diferente e diga quantas subiram. O aplicativo mostra se foi a mais ou a menos. A administração é avisada na hora.
<break time="3.0s" />
Pra conferir mais rápido, aponte a câmera para o quiú érre de cada peça. O aplicativo conta sozinho.
<break time="3.0s" />
Na contagem do dia, conte as pilhas e as peças soltas, sem ver o número do sistema. Leva uns três minutos.
<break time="3.0s" />
O sino mostra os seus avisos. Ligue os avisos do celular pra receber sem abrir o aplicativo.
<break time="3.0s" />
Com dúvida, toque em ajuda, no alto da tela. Bom trabalho!
<break time="3.0s" />
Abra o endereço, digite o usuário e a senha da tela de boas-vindas, e toque em entrar.
<break time="3.0s" />
Aqui você vê as notas esperando conferência. Quem confere é o conferente. Quando termina, o caminhão está liberado.
<break time="3.0s" />
Fique de olho no sino: os avisos pra você aparecem ali.
<break time="3.0s" />
O cliente acompanha a sua saída por um link. Por isso, só saia do pátio com a carga conferida.
<break time="3.0s" />
Abra o endereço, digite o usuário e a senha da tela de boas-vindas, e toque em entrar.
<break time="3.0s" />
A tela inicial mostra se está tudo certo, e os botões do que você faz: lançar nota e ver as cargas.
<break time="3.0s" />
Pra lançar uma nota: escolha como ela chegou, digite o número e o cliente, escolha os produtos, e confirme. Ela entra na fila, e os conferentes são avisados na hora, no celular. Sem papel, tudo no celular. Simples assim.
<break time="3.0s" />
Na aba cargas, toque numa carga pra ver itens, fotos e diferenças.
<break time="3.0s" />
Dentro da carga, toque em enviar ao cliente e escolha o Uótsap dele. Ele acompanha tudo por um link.
<break time="3.0s" />
Os avisos chegam no sino e no celular.
```

---

## BLOCO 03 — Tutoriais · expedição, administrativo e diretoria  (19 cenas · 2202 caracteres)

Cenas, em ordem: expedicao/01-entrar · expedicao/02-inicio · expedicao/03-nota · expedicao/04-cargas · expedicao/05-estoque · expedicao/06-equipe · expedicao/07-avisos · administrativo/01-entrar · administrativo/02-inicio · administrativo/03-xml · administrativo/04-equipe · administrativo/05-frota · administrativo/06-avisos · diretoria/01-entrar · diretoria/02-inicio · diretoria/03-resumo · diretoria/04-ia · diretoria/05-equipe · diretoria/06-avisos

```text
Abra o endereço, digite o usuário e a senha da tela de boas-vindas, e toque em entrar. Você comanda a operação.
<break time="3.0s" />
A tela inicial diz se está tudo certo. Se tiver problema, toque em resolver agora.
<break time="3.0s" />
Pra lançar uma nota, escolha: arquivo xis ême éle, foto, ou digitando. Com o xis ême éle, o aplicativo lê tudo sozinho.
<break time="3.0s" />
Na aba cargas, veja o que saiu, filtre as diferenças, e imprima as etiquetas.
<break time="3.0s" />
O estoque se atualiza sozinho. Se a contagem não bater, você decide: corrigir, ou contar de novo.
<break time="3.0s" />
Pra cadastrar alguém: nome, função, Uótsap e foto, um passo por vez. O aplicativo manda o acesso e o vídeo tutorial no Uótsap dela.
<break time="3.0s" />
Peça a mais, estoque baixo, nota parada, pedido de senha: tudo chega no sino e no celular.
<break time="3.0s" />
Abra o endereço, digite o usuário e a senha da tela de boas-vindas, e toque em entrar. Você cuida dos cadastros.
<break time="3.0s" />
A tela inicial mostra se está tudo certo, e botões simples levam a cada tarefa.
<break time="3.0s" />
Pra várias notas de uma vez, use o arquivo xis ême éle: escolha, confira e envie.
<break time="3.0s" />
Em mais, equipe: cadastre pessoas e gere uma senha nova pra quem esqueceu.
<break time="3.0s" />
Cadastre os caminhões com fotos, e os produtos com estoque mínimo.
<break time="3.0s" />
Os avisos mostram o que precisa de atenção, inclusive pedidos de senha.
<break time="3.0s" />
Abra o endereço, digite o usuário e a senha da tela de boas-vindas, e toque em entrar. Você vê a empresa inteira em uma tela.
<break time="3.0s" />
A tela inicial mostra como está a empresa. Verde, tudo certo. Amarelo ou vermelho, toque em resolver agora.
<break time="3.0s" />
O resumo completo traz os números do dia, da semana e do mês, e onde a operação mais erra.
<break time="3.0s" />
Na versão completa, pergunte ao assistente de inteligência artificial. Ele responde com os dados reais, e só fala da Nova Era.
<break time="3.0s" />
Na equipe, cada pessoa mostra qual administrador a cadastrou, e quando.
<break time="3.0s" />
Os avisos críticos chegam no sino e no celular, com botão pra chamar no Uótsap.
```

