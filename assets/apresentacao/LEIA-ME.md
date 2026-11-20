# Apresentação "Como funciona o Confere Carga"

Vídeo em HTML: roda o aplicativo de verdade dentro de um celular, com um cursor que abre cada função,
legenda e voz. É a apresentação para os diretores.

## Como abrir
- Pelo endereço publicado do site: `…/apresentacao.html` (pode ser GitHub Pages).
- Ou no computador, dentro da pasta do projeto: `python3 -m http.server 8000` e abra `http://localhost:8000/apresentacao.html`.
  (Abrir o arquivo com duplo clique **não funciona**: o navegador bloqueia o app dentro da apresentação.)

Controles: **espaço** pausa, **← →** troca de cena, **F** tela cheia, **C** liga/desliga a legenda.
Para conferir o roteiro 4× mais rápido: `apresentacao.html?rapido=1`.

## Voz do ElevenLabs
Sem áudios, a apresentação usa a voz do navegador (provisória). Para usar a voz do ElevenLabs:

1. No ElevenLabs, copie sua chave em *Profile → API Keys*.
2. No terminal, na pasta do projeto:
   ```bash
   export ELEVENLABS_API_KEY="sua-chave"
   node scripts/gerar-voz-elevenlabs.mjs --listar          # lista as vozes; escolha uma em português
   export ELEVENLABS_VOICE_ID="id-da-voz"
   node scripts/gerar-voz-elevenlabs.mjs                   # gera um mp3 por cena em assets/apresentacao/audio/
   ```
3. Abra a apresentação: ela encontra os mp3 sozinha, e os cliques seguem o tempo de cada fala.

Para mudar uma frase: edite o campo `fala` em `assets/apresentacao/roteiro.json` e gere de novo
(`--cena 07 --refazer` refaz só a cena 07). A legenda usa o mesmo texto.

## Como o roteiro funciona
Cada cena do `roteiro.json` tem: `titulo`, `pontos` (o que aparece na tela), `fala` (voz e legenda),
`pre` (onde o app deve estar quando a cena começa: perfil e tela) e `acoes`: cliques, digitação e destaques
que acontecem numa fração (`at`, de 0 a 1) do tempo da fala.

## Segurança
A chave do ElevenLabs só é usada no seu computador, pelo script. Ela não fica no repositório nem no site.
