# Vídeos do Confere Carga

Todos em **MP4**, gravados do aplicativo de verdade rodando. **Ainda sem voz**: a fala aparece
como legenda grande na tela. Quando a voz do ElevenLabs chegar, eu encaixo e gero de novo.

| Arquivo | Para quem | Dura |
|---|---|---|
| `apresentacao-*.mp4` | **Você**, no dia da oferta à empresa. Não vai no site. | ~4 min |
| `conferente-*.mp4` | Conferente e ajudante | ~2 min 20 s |
| `motorista-*.mp4` | Motorista | ~1 min |
| `vendedor-*.mp4` | Vendedor | ~2 min |
| `expedicao-*.mp4` | Expedição | ~2 min |
| `administrativo-*.mp4` | Administrativo | ~1 min 40 s |
| `diretoria-*.mp4` | Diretoria | ~1 min 20 s |

**Dois formatos de cada um:**
- `-vertical.mp4` (720×1280): celular em pé. É o que você manda no WhatsApp do funcionário.
- `-horizontal.mp4` (1280×720): TV, projetor e computador. É o que você usa na reunião.

## Como o funcionário recebe o vídeo dele
Ao cadastrar alguém, o botão **"Mandar acesso e vídeo no WhatsApp"** envia o link da tela de
boas-vindas. Essa tela já mostra o usuário, a senha **e o vídeo da função da pessoa**, rodando ali
mesmo. Não precisa mandar o MP4 à mão — ele serve para quando não há internet boa no pátio.

## Gerar os vídeos de novo
Qualquer mudança no app aparece no vídeo na próxima gravação, porque o vídeo é o app rodando.

```bash
python3 -m http.server 8765 &          # servidor local
python3 scripts/tutoriais.py           # roteiros dos tutoriais
python3 scripts/apresentacao.py        # roteiro da apresentação
node scripts/gravar-videos.mjs         # grava tudo, nos dois formatos
node scripts/gravar-videos.mjs conferente --formato v   # só um
```

O gravador avisa se alguma ação do roteiro não encontrou o alvo na tela. **Vídeo com falha não
deve ser entregue**: quer dizer que a narração está falando de um passo que não aconteceu.

## Pôr a voz
1. `python3 scripts/roteiro-voz.py gerar` → `assets/apresentacao/ROTEIRO-VOZ.md`
2. Gere as partes no ElevenLabs e salve com o nome que está no título de cada parte.
3. `python3 scripts/roteiro-voz.py cortar gravacoes/*.mp3`
4. `node scripts/gravar-videos.mjs` de novo: agora com voz, e o tempo de cada cena segue o áudio.

## O que vai para o GitHub
Só os `-vertical.mp4` dos tutoriais por função (a tela de boas-vindas toca esses). Os `-horizontal.mp4` e a apresentação comercial (`apresentacao-*`) ficam fora do repositório (`.gitignore`): são arquivos grandes e a apresentação não vai para o site.
