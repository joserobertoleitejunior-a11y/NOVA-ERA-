#!/usr/bin/env python3
"""Monta o roteiro da apresentação comercial em assets/apresentacao/roteiro.json.

Não é tutorial: é a oferta. Mostra o problema em dinheiro, a solução rodando e o que muda na empresa.

    python3 scripts/apresentacao.py
"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from tutoriais import montar, clk, txt, dig, dst, rol, CAR_POR_SEG

RAIZ = pathlib.Path(__file__).resolve().parent.parent

CENAS = [
 {"id": "01-problema", "titulo": "Onde o dinheiro escapa", "pre": {"perfil": None},
  "fala": "Toda fábrica de pré-moldados perde dinheiro no mesmo lugar: no portão. Peça que sobe no caminhão e não está na nota, ninguém cobra. Peça que falta, vira reclamação do cliente e um frete de volta. E, no meio disso, o estoque do sistema vai ficando diferente do estoque do pátio. O problema não é falta de gente boa. É que ninguém tem como provar o que saiu.",
  "acoes": []},
 {"id": "02-solucao", "titulo": "O Confere Carga", "pre": {"perfil": "conferente", "rota": "notas"},
  "fala": "O Confere Carga resolve isso com uma regra simples: nenhum caminhão sai sem conferência. A nota entra numa fila. O conferente abre no celular, compara a carga com a nota, tira as fotos e registra. Leva um minuto, e fica tudo guardado.",
  "acoes": [dst("#lista-minhas"), dst(".linha-cartao")]},
 {"id": "03-conferencia", "titulo": "Um minuto no pátio", "pre": {"perfil": "conferente", "rota": "notas"},
  "fala": "Veja como é no celular do conferente. Ele toca na nota, escolhe o caminhão, compara a carga. Se tudo bate, um toque. A foto do caminhão carregado, a foto da placa, e registra. Pronto: a carga está conferida, com hora, foto e nome de quem conferiu. E ninguém consegue apagar depois.",
  "acoes": [clk(".linha-cartao"), clk(".escolha"), clk("#btn-seguir"), clk("#btn-tudo-confere"), clk("#btn-seguir"),
            txt(".link-acao", "Usar foto de teste", 0), txt(".link-acao", "Usar foto de teste", 1), clk("#btn-seguir"), clk("#btn-seguir")]},
 {"id": "04-diferenca", "titulo": "Quando a carga não bate", "pre": {"perfil": "conferente", "rota": "notas"},
  "fala": "E quando não bate? O conferente informa quantas peças subiram de verdade, escolhe o motivo e registra. Nesse instante a administração é avisada no celular. Essa é a diferença entre descobrir no fim do mês e descobrir com o caminhão ainda no pátio.",
  "acoes": [clk(".linha-cartao"), clk(".escolha"), clk("#btn-seguir"), clk("#btn-tudo-confere"), clk(".opcao.diferente"),
            txt("button", "Diminuir", 0), clk("#btn-seguir"),
            txt(".link-acao", "Usar foto de teste", 0), txt(".link-acao", "Usar foto de teste", 1), clk("#btn-seguir"), clk(".chip"), clk("#btn-seguir")]},
 {"id": "05-papeis", "titulo": "Cada um vê o que é dele", "pre": {"perfil": "motorista", "rota": "inicio"},
  "fala": "Um detalhe que faz o aplicativo ser usado de verdade: cada função tem a sua tela. O motorista vê só uma coisa: se a carga já foi conferida e se ele pode sair. Nada de menu cheio, nada que não é dele.",
  "acoes": [dst(".status-simples"), dst(".nav-inferior")]},
 {"id": "06-vendedor", "titulo": "O vendedor e o cliente", "pre": {"perfil": "adminvendas", "rota": "inicio"},
  "fala": "O vendedor vê as notas dele e as entregas do dia. Depois da conferência, ele manda um link no WhatsApp e o cliente acompanha sozinho: a hora da saída, o que foi carregado e a foto da carga. Isso corta ligação e corta discussão.",
  "acoes": [dst(".numeros-simples"), dst(".tiles")]},
 {"id": "07-expedicao", "titulo": "A expedição comanda o pátio", "pre": {"perfil": "adminexpedicao", "rota": "inicio"},
  "fala": "A expedição vê o pátio em tempo real: quantas notas esperam e quantas cargas já saíram. Lança nota em quatro passos, ou importa o arquivo XML e o aplicativo lê tudo sozinho. Sem digitar nada.",
  "acoes": [dst(".status-simples"), clk("#tile-nota"), txt(".escolha", "Vou digitar"), clk("#btn-seguir"), dig("#nn-numero", "48500"), dig("#nn-cliente", "Construtora Alfa"), clk("#btn-seguir")]},
 {"id": "08-avisos", "titulo": "O problema vem até você", "pre": {"perfil": "adminexpedicao", "rota": "alertas"},
  "fala": "Ninguém precisa abrir o aplicativo para procurar problema. Saiu peça a mais, faltou peça, estoque negativo, nota parada na fila: a administração é avisada na hora, no celular, mesmo com o aplicativo fechado. E tem um botão para chamar no WhatsApp quem precisa resolver.",
  "acoes": [dst("#lista-alertas"), rol(".alerta-item")]},
 {"id": "09-estoque", "titulo": "O estoque se acerta sozinho", "pre": {"perfil": "adminexpedicao", "rota": "estoque"},
  "fala": "Cada carga conferida desconta do estoque automaticamente. Cada produto mostra em uma palavra se está certo, baixo ou negativo. E uma vez por dia a equipe faz a contagem rápida, que leva três minutos e escolhe sozinha o que mais vale a pena contar.",
  "acoes": [dst(".chips"), rol(".linha-cartao"), dst(".linha-cartao")]},
 {"id": "10-diretoria", "titulo": "A empresa em uma tela", "pre": {"perfil": "admindiretoria", "rota": "resumo"},
  "fala": "E para a direção, tudo vira número. Quantas cargas saíram, quantas tiveram diferença, onde a empresa mais erra e como está cada pessoa da equipe. No dia, na semana e no mês. É aqui que aparece, em número, quanto estava escapando sem ninguém ver.",
  "acoes": [txt(".chip", "30 dias"), dst(".kpis"), rol(".barras")]},
 {"id": "11-fechamento", "titulo": "O que muda na prática", "pre": {"perfil": "admindiretoria", "rota": "inicio"},
  "fala": "Funciona em qualquer celular, sem instalar nada, e funciona offline: se faltar sinal no pátio, a conferência fica guardada e sobe sozinha depois. O que muda é simples: toda carga tem prova, toda diferença tem dono e hora, e o estoque para de mentir. Obrigado.",
  "acoes": [dst(".status-simples")]},
]

if __name__ == "__main__":
    doc = {"titulo": "Confere Carga · Nova Era", "selo": "Confere Carga",
           "audio": "assets/apresentacao/audio",
           "voz": {"modelo": "eleven_multilingual_v2", "estabilidade": 0.35, "similaridade": 0.75, "estilo": 0.45},
           "inicio": {"titulo": "Confere Carga", "sub": "Nenhum caminhão sai sem conferência", "botao": "Começar"},
           "fim": {"titulo": "Confere Carga", "sub": "Nova Era · Drenagem e pré-moldados"},
           "cenas": montar(CENAS)}
    (RAIZ / "assets/apresentacao/roteiro.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
    seg = sum(len(c["fala"]) / CAR_POR_SEG + 0.4 for c in CENAS)
    print(f"apresentação: {len(CENAS)} cenas · {sum(len(c['fala']) for c in CENAS)} caracteres · ~{seg/60:.1f} min de fala")
