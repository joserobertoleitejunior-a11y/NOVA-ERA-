# Pacotes do Confere Carga

O app tem três pacotes. O pacote em uso fica no banco e liga ou desliga telas, botões e avisos. Nada de preço aqui (este arquivo é público).

| | Básico | Intermediário | Premium |
|---|:-:|:-:|:-:|
| Site da Nova Era (produtos, orçamento no WhatsApp, calculadora) | ✔ | ✔ | ✔ |
| Conferência de carga: foto da carga e da placa, diferença com motivo, funciona sem sinal | ✔ | ✔ | ✔ |
| Lançar nota digitando (ou com a foto na mão) e fila de notas | ✔ | ✔ | ✔ |
| Link de rastreio para o cliente (prova de entrega) | ✔ | ✔ | ✔ |
| Equipe, caminhões e produtos; cartão de acesso com WhatsApp | ✔ | ✔ | ✔ |
| Avisos essenciais: carga com diferença ou saída sem nota, nota nova, pedido de senha | ✔ | ✔ | ✔ |
| Estoque: saldo, mínimo, entrada e perda, contagem com aprovação | — | ✔ | ✔ |
| Importar notas por XML (várias de uma vez) | — | ✔ | ✔ |
| Etiquetas com QR em 7 tamanhos de papel, impressão em qualquer impressora e leitura pela câmera (Mais → Imprimir) | — | ✔ | ✔ |
| Resumo completo e indicadores da diretoria | — | ✔ | ✔ |
| Painel do vendedor (função vendedor) | — | ✔ | ✔ |
| Avisos automáticos completos (estoque, nota parada, fora do horário, resumo do dia), WhatsApp de 1 toque e Ajustes | — | ✔ | ✔ |
| Planilhas (cargas e estoque) e relatórios para imprimir (movimentação, estoque, notas, cargas) | — | ✔ | ✔ |
| Vídeo tutorial por função na tela de boas-vindas | — | ✔ | ✔ |
| **Assistente com IA** (consulta e faz por comando, lê a nota por foto, assistente de vendas, oferece imprimir o que mostrou) | — | — | ✔ |
| **Histórico de atividades** (quem fez, quando, mercadoria e nota) | — | — | ✔ |

Serviço (fora do app): acompanhamento de 30 dias, treinamento da equipe e suporte prioritário são do Premium.

## Onde está escrito
- Etiquetas, QR e impressão: ver `ETIQUETAS-E-IMPRESSAO.md`.
- `assets/js/pacote.js`: a matriz (`DESDE`) e as regras (`tem`, `avisoPermitido`, `funcaoDisponivel`). É o único lugar. A cópia em `supabase/functions/assistente/pacote.js` é igual e vai junto na função.
- `tests/pacote.test.js`: prova que um pacote contém o anterior e que todo aviso do sistema tem decisão.

## Como trocar o pacote de um cliente
No editor SQL do Supabase (só o dono do sistema tem acesso; nenhum usuário do app consegue gravar nesta tabela):

```sql
update public.licenca set pacote = 'basico', atualizado_em = now() where id = 1;          -- ou 'intermediario' ou 'premium'
select pacote, atualizado_em from public.licenca;
```
O app lê no momento em que a pessoa entra. Quem já está com o app aberto vê a mudança ao fechar e abrir. Sem sinal, vale o último pacote conhecido; sem a tabela, vale Premium (nada some de quem já usa).

## O que é travado de verdade (no servidor) e o que é só de tela
- **IA:** a função `assistente` consulta a licença e recusa (403) `perguntar`, `executar` e `ler_nota` fora do Premium; `status` volta desligado e o botão nem aparece.
- **Histórico:** o banco só entrega as linhas no Premium (`pode_ver_historico()` confere `pacote_atual()`). O registro continua sendo gravado em todos os pacotes: ao subir para o Premium, o histórico já está lá.
- **Telas e botões** (estoque, XML, etiquetas, resumo, vendedor, avisos completos, planilhas, vídeos): escondidos no app, e quem digita o endereço de uma tela de outro pacote vê uma explicação com o botão **Quero este recurso** (abre o WhatsApp do suporte). Os dados continuam sendo gravados por baixo: ao subir de pacote, nada se perde. Faça uma contagem de estoque inicial ao ligar o Estoque.
- **Avisos:** no Básico só aparecem os essenciais (os outros continuam sendo gerados no banco, mas o app não mostra).

## Mostrar cada pacote na reunião
Na demonstração (endereço com `?demo=exemplo`) acrescente `&pacote=`:
- `app.html?demo=exemplo&pacote=basico`
- `app.html?demo=exemplo&pacote=intermediario`
- `app.html?demo=exemplo&pacote=premium` (igual a sem o parâmetro)

O parâmetro só vale na demonstração; no app de verdade quem manda é a licença do banco.

## Para a pessoa do cliente
Em **Mais → Meu pacote** (administração): mostra o que está ligado, o que dá para ligar e leva ao WhatsApp do suporte.
