#!/usr/bin/env python3
"""Monta os roteiros dos tutoriais (um por função) em assets/tutoriais/<função>.json.

Cada cena é uma AULA: uma tarefa inteira, do começo ao fim, mostrada no app de verdade.
O tempo dos cliques é calculado a partir do tamanho da fala, para a mão acompanhar a voz.

    python3 scripts/tutoriais.py
"""
import json, pathlib

RAIZ = pathlib.Path(__file__).resolve().parent.parent
CAR_POR_SEG = 14.5          # velocidade de leitura da voz
RITMO_CHEIO = 0.6           # cenas com muitos cliques usam o cursor mais ligeiro

# Quanto cada ação demora (segundos), no ritmo normal
def custo(a):
    if "clicar" in a or "clicarTexto" in a: return 1.62
    if "digitar" in a: return 1.24 + 0.055 * len(str(a["digitar"][1]))
    if "destacar" in a: return 1.2
    if "ir" in a: return 0.6
    if "rolar" in a or "siteRolar" in a: return 0.6
    if "esperar" in a: return 0.8
    return 0.5

def montar(cenas):
    """Calcula ritmo e o instante (at) de cada ação para caberem dentro da fala."""
    saida = []
    for c in cenas:
        acoes = [dict(a) for a in c.get("acoes", [])]
        dur = len(c["fala"]) / CAR_POR_SEG + 0.4
        ritmo = RITMO_CHEIO if len(acoes) >= 6 else 1.0
        if acoes:
            total = sum(custo(a) * ritmo for a in acoes)
            if total > dur - 0.8 and ritmo == 1.0:
                ritmo = RITMO_CHEIO
                total = sum(custo(a) * ritmo for a in acoes)
            ini = 0.05 * dur
            fim = max(dur - custo(acoes[-1]) * ritmo - 0.6, ini + 0.4)
            n = len(acoes)
            for j, a in enumerate(acoes):
                a["at"] = round((ini + (fim - ini) * (j / (n - 1) if n > 1 else 0)) / dur, 3)
            # confere que o cursor termina antes da fala
            t = 0.0
            for a in acoes:
                t = max(a["at"] * dur, t) + custo(a) * ritmo
            if t > dur:
                print(f"  ! {c['id']}: cursor passa {t - dur:.1f}s da fala (fala {dur:.0f}s)")
        nova = {"id": c["id"], "titulo": c["titulo"], "fala": c["fala"], "pre": c.get("pre", {}), "acoes": acoes}
        if c.get("pontos"): nova["pontos"] = c["pontos"]
        if ritmo != 1.0: nova["ritmo"] = ritmo
        saida.append(nova)
    return saida

# ─────────────────────────────── atalhos de ação ───────────────────────────────
def clk(sel): return {"clicar": sel}
def txt(sel, t, i=0): return {"clicarTexto": [sel, t, i]}
def dig(sel, v): return {"digitar": [sel, v]}
def dst(sel): return {"destacar": sel}
def rol(sel): return {"rolar": sel}

ENTRAR = lambda usuario: [dig("#login-usuario", usuario), dig("#login-senha", "admin"), clk("#btn-entrar")]

# ─────────────────────────────── CONFERENTE ───────────────────────────────
CONFERENTE = [
 {"id": "01-entrar", "titulo": "Entrar no aplicativo", "pre": {"perfil": None},
  "fala": "Vamos começar. A expedição te mandou um link no WhatsApp, com o seu usuário e a sua senha. Abra esse link, digite os dois, e toque em entrar. Pronto: a sua tela é a fila de carga.",
  "acoes": ENTRAR("conferente")},
 {"id": "02-fila", "titulo": "A fila: o que conferir", "pre": {"perfil": "conferente", "rota": "notas"},
  "fala": "Esta é a fila. Cada linha é uma nota esperando conferência, e embaixo aparece há quanto tempo ela está esperando. A que está em vermelho é a mais antiga: comece por ela. Se chegou carga sem nota na fila, use o botão de cima.",
  "acoes": [dst("#lista-minhas"), dst(".linha-cartao"), dst("#btn-nova")]},
 {"id": "03-conferir", "titulo": "Conferir uma carga certa", "pre": {"perfil": "conferente", "rota": "notas"},
  "fala": "Agora a parte principal. Toque na nota. Escolha o caminhão que vai sair. Olhe a carga e compare com a lista: se cada peça bate, toque em tudo confere. Tire a foto do caminhão carregado e a foto da placa. Confira o resumo e registre. Pronto: carga conferida, com hora, foto e o seu nome. Ninguém consegue apagar isso depois.",
  "acoes": [clk(".linha-cartao"), clk(".escolha"), clk("#btn-seguir"), clk("#btn-tudo-confere"), clk("#btn-seguir"),
            txt(".link-acao", "Usar foto de teste", 0), txt(".link-acao", "Usar foto de teste", 1), clk("#btn-seguir"), clk("#btn-seguir")]},
 {"id": "04-diferenca", "titulo": "Quando falta ou sobra peça", "pre": {"perfil": "conferente", "rota": "notas"},
  "fala": "E quando a carga não bate? Comece igual: nota, caminhão, tudo confere. Aí, no item que está diferente, toque em diferente e diga quantas peças subiram de verdade no caminhão. O aplicativo mostra na hora se foi a mais ou a menos. Tire as fotos, escolha o motivo da diferença e registre. A administração é avisada na mesma hora, no celular dela.",
  "acoes": [clk(".linha-cartao"), clk(".escolha"), clk("#btn-seguir"), clk("#btn-tudo-confere"), clk(".opcao.diferente"),
            txt("button", "Diminuir", 0), clk("#btn-seguir"),
            txt(".link-acao", "Usar foto de teste", 0), txt(".link-acao", "Usar foto de teste", 1), clk("#btn-seguir"), clk(".chip"), clk("#btn-seguir")]},
 {"id": "05-etiquetas", "titulo": "Contar lendo as etiquetas", "pre": {"perfil": "conferente", "rota": "notas"},
  "fala": "Carga grande, com muita peça? Tem um jeito mais rápido. Dentro da conferência existe o botão contar lendo as etiquetas. Você aponta a câmera do celular para o QR de cada peça, e o aplicativo vai contando sozinho. Se a etiqueta for de outra nota, ele avisa na hora.",
  "acoes": [clk(".linha-cartao"), clk(".escolha"), clk("#btn-seguir"), dst("#btn-ler-etiquetas"), dst("#btn-ler-etiquetas")]},
 {"id": "06-contagem", "titulo": "A contagem do dia", "pre": {"perfil": "conferente", "rota": "contar"},
  "fala": "Uma vez por dia, quando der um tempo, faça a contagem. O aplicativo já escolhe os produtos que mais valem a pena contar. Conte quantas pilhas e quantas peças soltas tem de cada um. Você não vê o número do sistema, para ninguém ser influenciado. No fim, é só enviar. Leva uns três minutos.",
  "acoes": [clk("#btn-seguir"), txt("button", "Aumentar", 0), txt("button", "Aumentar", 0), clk("#btn-seguir"),
            txt("button", "Aumentar", 0), clk("#btn-seguir"), txt("button", "Aumentar", 0), clk("#btn-seguir")]},
 {"id": "07-avisos", "titulo": "Avisos e ajuda", "pre": {"perfil": "conferente", "rota": "alertas"},
  "fala": "Por último, duas coisas. O sino mostra os seus avisos: nota nova na fila e pedido de contagem. Ligue os avisos do celular para receber sem precisar abrir o aplicativo. E se travar em qualquer tela, toque em ajuda, lá em cima. Bom trabalho!",
  "acoes": [dst("#btn-ler-todos"), rol(".cartao-guia")]},
]

# ─────────────────────────────── MOTORISTA ───────────────────────────────
MOTORISTA = [
 {"id": "01-entrar", "titulo": "Entrar no aplicativo", "pre": {"perfil": None},
  "fala": "Seu aplicativo é bem simples. Abra o link que a expedição mandou, digite o usuário e a senha, e toque em entrar.",
  "acoes": ENTRAR("motorista")},
 {"id": "02-viagem", "titulo": "Posso sair do pátio?", "pre": {"perfil": "motorista", "rota": "inicio"},
  "fala": "Esta é a sua tela. Ela responde a única pergunta que importa para você: posso sair? Em cima aparece se ainda tem carga esperando conferência. Verde quer dizer que está tudo conferido. Amarelo quer dizer que alguma carga ainda não passou pelo conferente.",
  "acoes": [dst(".status-simples"), dst(".numeros-simples")]},
 {"id": "03-fila", "titulo": "A fila de carga", "pre": {"perfil": "motorista", "rota": "notas"},
  "fala": "Na fila você vê o que está esperando conferência. Você não precisa conferir nada: quem confere é o conferente. Quando a sua carga sai da fila, ela foi conferida e o caminhão está liberado. Nunca saia do pátio antes disso: a conferência é o que protege você se o cliente reclamar depois.",
  "acoes": [dst("#lista-minhas"), dst(".linha-cartao")]},
 {"id": "04-avisos", "titulo": "Os seus avisos", "pre": {"perfil": "motorista", "rota": "alertas"},
  "fala": "E o sino guarda os avisos para você. Ligue os avisos do celular e eles chegam mesmo com o aplicativo fechado. É só isso. Boa viagem!",
  "acoes": [rol(".cartao-guia")]},
]

# ─────────────────────────────── VENDEDOR ───────────────────────────────
VENDEDOR = [
 {"id": "01-entrar", "titulo": "Entrar no aplicativo", "pre": {"perfil": None},
  "fala": "Abra o link que a empresa mandou, digite o seu usuário e a sua senha, e toque em entrar.",
  "acoes": ENTRAR("adminvendas")},
 {"id": "02-inicio", "titulo": "Sua tela: só o que é seu", "pre": {"perfil": "adminvendas", "rota": "inicio"},
  "fala": "A sua tela mostra só o que é seu: quantas notas suas esperam carregar, e quantas entregas suas já saíram hoje. Se uma nota sua está parada, ou uma carga saiu com diferença, aparece aqui em cima com um botão, para você agir antes de o cliente ligar.",
  "acoes": [dst(".status-simples"), dst(".numeros-simples"), dst(".tiles")]},
 {"id": "03-nota", "titulo": "Lançar uma nota", "pre": {"perfil": "adminvendas", "rota": "inicio"},
  "fala": "Fechou a venda? Lance a nota. Escolha como ela chegou. Vamos digitar: número e cliente. Você já entra como vendedor da nota. Agora os produtos: cada um mostra quanto tem disponível, e se você pedir mais do que tem, o aplicativo avisa antes de você prometer ao cliente. Confira e coloque na fila.",
  "acoes": [clk("#tile-nota"), txt(".escolha", "Vou digitar"), clk("#btn-seguir"), dig("#nn-numero", "48500"), dig("#nn-cliente", "Construtora Alfa"),
            clk("#btn-seguir"), dst(".lista-produtos"), clk(".lp-linha"), clk("#btn-seguir"), clk("#btn-seguir")]},
 {"id": "04-estoque", "titulo": "Quanto tem para vender", "pre": {"perfil": "adminvendas", "rota": "estoque"},
  "fala": "Antes de prometer uma entrega, olhe o estoque. O número grande é o que está disponível de verdade: já desconta o que está vendido em notas esperando carregar. Dá para buscar um produto e mostrar só o que está pouco ou em falta. Aqui você só consulta.",
  "acoes": [dst(".busca-linha"), dst(".linha-cartao"), txt(".chip", "Pouco ou sem")]},
 {"id": "05-notas", "titulo": "Minhas notas e a busca por cliente", "pre": {"perfil": "adminvendas", "rota": "notas"},
  "fala": "Em notas ficam as suas: as que esperam carregar e as que já saíram. Quer ver as de todos os vendedores? Toque em de todos. E escreva o nome de um cliente: o aplicativo acha as notas dele em qualquer situação.",
  "acoes": [dst(".chips"), dig("#busca-notas", "alfa"), dst(".filtro-ativo")]},
 {"id": "06-rastreio", "titulo": "Mandar o rastreio ao cliente", "pre": {"perfil": "adminvendas", "rota": "cargas"},
  "fala": "Em minhas cargas ficam as entregas das suas notas. Toque numa carga e você vê os itens, as fotos e se teve diferença. E tem o botão de enviar ao cliente: ele recebe um link no WhatsApp com a hora da saída, o que foi carregado e a foto da carga. Menos ligação para você, mais confiança para ele.",
  "acoes": [dst(".filtros"), clk(".conf"), dst(".janela")]},
 {"id": "07-avisos", "titulo": "Os seus avisos", "pre": {"perfil": "adminvendas", "rota": "alertas"},
  "fala": "E o sino avisa quando uma carga sua sai, quando sai com diferença, ou quando uma nota sua fica parada. Do próprio aviso você manda o rastreio ao cliente com um toque, antes de ele ligar.",
  "acoes": [dst(".alerta-item"), rol(".alerta-item")]},
]

# ─────────────────────────────── EXPEDIÇÃO ───────────────────────────────
EXPEDICAO = [
 {"id": "01-entrar", "titulo": "Entrar no aplicativo", "pre": {"perfil": None},
  "fala": "Você comanda a operação do pátio. Abra o link, digite o usuário e a senha, e entre.",
  "acoes": ENTRAR("adminexpedicao")},
 {"id": "02-patio", "titulo": "O pátio agora", "pre": {"perfil": "adminexpedicao", "rota": "inicio"},
  "fala": "A sua tela é o pátio em tempo real: quantas notas esperam conferência e quantas cargas já saíram hoje. Se tem algo errado, aparece em cima com o botão de resolver agora. Embaixo ficam os botões do seu dia a dia.",
  "acoes": [dst(".status-simples"), dst(".numeros-simples"), dst(".tiles")]},
 {"id": "03-nota", "titulo": "Lançar uma nota", "pre": {"perfil": "adminexpedicao", "rota": "inicio"},
  "fala": "Chegou nota nova. Toque em lançar uma nota e escolha como ela chegou. Vamos digitar: número e cliente, depois os produtos e as quantidades. Confira e coloque na fila. Os conferentes recebem o aviso na hora.",
  "acoes": [clk("#tile-nota"), txt(".escolha", "Vou digitar"), clk("#btn-seguir"), dig("#nn-numero", "48500"), dig("#nn-cliente", "Construtora Alfa"),
            clk("#btn-seguir"), clk(".lp-linha"), clk("#btn-seguir"), clk("#btn-seguir")]},
 {"id": "04-xml", "titulo": "Várias notas de uma vez", "pre": {"perfil": "adminexpedicao", "rota": "guia", "params": {"fluxo": "xml"}},
  "fala": "Quando o escritório te manda os arquivos XML, não precisa digitar nada. Escolha os arquivos de uma vez, o aplicativo lê número, cliente e todos os itens, e você só confere e envia. Produto que ainda não existe no cadastro, ele cria sozinho.",
  "acoes": [dst("#btn-escolher-xml"), dst("#btn-escolher-xml")]},
 {"id": "05-cargas", "titulo": "Acompanhar o que saiu", "pre": {"perfil": "adminexpedicao", "rota": "cargas"},
  "fala": "Em cargas você vê tudo que saiu, por dia. Dá para filtrar só as que tiveram diferença, que são as que interessam. Toque numa carga para ver as fotos, os itens e quem conferiu. E dá para baixar a planilha dos últimos trinta dias.",
  "acoes": [dst(".filtros"), txt(".chip", "Com diferença"), clk(".conf")]},
 {"id": "06-contagem", "titulo": "Pedir e resolver a contagem", "pre": {"perfil": "adminexpedicao", "rota": "estoque", "params": {"aba": "contagens"}},
  "fala": "O estoque se atualiza sozinho a cada carga conferida. Quando quiser conferir na prática, peça a contagem do dia à equipe. Se a contagem não bater, você decide: corrigir o estoque com o número contado, ou pedir para contar de novo.",
  "acoes": [dst(".chips"), txt("button", "Pedir contagem"), clk(".escolha")]},
 {"id": "07-equipe", "titulo": "Cadastrar uma pessoa", "pre": {"perfil": "adminexpedicao", "rota": "guia", "params": {"fluxo": "novaPessoa"}},
  "fala": "Entrou gente nova? É uma pergunta por tela: nome, função, WhatsApp e foto. O aplicativo cria o usuário e a senha sozinho e manda no WhatsApp da pessoa um link com o acesso e o vídeo tutorial da função dela. E fica registrado que foi você quem cadastrou.",
  "acoes": [dig("#cad-nome", "Carlos Souza"), clk("#btn-seguir"), txt(".escolha", "Conferente"), clk("#btn-seguir"),
            dig("#cad-tel", "15999990001"), clk("#btn-seguir"), clk("#btn-seguir"), clk("#btn-seguir")]},
]

# ─────────────────────────────── ADMINISTRATIVO ───────────────────────────────
ADMINISTRATIVO = [
 {"id": "01-entrar", "titulo": "Entrar no aplicativo", "pre": {"perfil": None},
  "fala": "Você cuida dos cadastros e das notas. Abra o link, digite o usuário e a senha, e entre.",
  "acoes": ENTRAR("adminadministrativo")},
 {"id": "02-inicio", "titulo": "A sua tela", "pre": {"perfil": "adminadministrativo", "rota": "inicio"},
  "fala": "A sua tela mostra quantas notas estão na fila e quantas pessoas estão cadastradas. Embaixo ficam os atalhos do que você mais faz: importar XML, lançar nota, cadastrar gente, caminhões e produtos.",
  "acoes": [dst(".numeros-simples"), dst(".tiles")]},
 {"id": "03-xml", "titulo": "Importar as notas por XML", "pre": {"perfil": "adminadministrativo", "rota": "guia", "params": {"fluxo": "xml"}},
  "fala": "Este é o caminho mais rápido. Escolha os arquivos XML, pode ser vários de uma vez. O aplicativo lê o número, o cliente e todos os itens de cada nota. Você confere o que ele leu e envia. Produto que ainda não existe, ele cadastra sozinho.",
  "acoes": [dst("#btn-escolher-xml"), dst("#btn-escolher-xml")]},
 {"id": "04-pessoa", "titulo": "Cadastrar uma pessoa", "pre": {"perfil": "adminadministrativo", "rota": "guia", "params": {"fluxo": "novaPessoa"}},
  "fala": "Para cadastrar alguém é uma pergunta por tela: nome, função, WhatsApp e foto. No fim o aplicativo cria o usuário e a senha, e o botão manda tudo no WhatsApp da pessoa, junto com o vídeo da função dela. Fica registrado quem cadastrou e quando.",
  "acoes": [dig("#cad-nome", "Carlos Souza"), clk("#btn-seguir"), txt(".escolha", "Conferente"), clk("#btn-seguir"),
            dig("#cad-tel", "15999990001"), clk("#btn-seguir"), clk("#btn-seguir"), clk("#btn-seguir")]},
 {"id": "05-cadastros", "titulo": "Caminhões e produtos", "pre": {"perfil": "adminadministrativo", "rota": "cadastros", "params": {"aba": "produtos"}},
  "fala": "Em produtos você guarda o estoque mínimo e quantas peças tem cada pilha. Isso é o que deixa o aviso de estoque baixo e a contagem funcionarem direito. Na aba do lado ficam os caminhões, com placa, dados e fotos. Cada cadastro tem editar e apagar.",
  "acoes": [dst(".acoes-cadastro"), txt(".aba", "Caminhões"), dst(".lista-simples")]},
 {"id": "06-ajustes", "titulo": "Os ajustes da empresa", "pre": {"perfil": "adminadministrativo", "rota": "guia", "params": {"fluxo": "ajustes"}},
  "fala": "E aqui você diz ao aplicativo como a empresa trabalha: o horário de expediente e em quanto tempo uma nota parada vira aviso. É isso que faz o aplicativo avisar na hora certa, sem encher ninguém de recado à toa.",
  "acoes": [dst("#conteudo")]},
]

# ─────────────────────────────── DIRETORIA ───────────────────────────────
DIRETORIA = [
 {"id": "01-entrar", "titulo": "Entrar no aplicativo", "pre": {"perfil": None},
  "fala": "Abra o link, digite o usuário e a senha, e entre. Em uma tela você vê a empresa inteira.",
  "acoes": ENTRAR("admindiretoria")},
 {"id": "02-empresa", "titulo": "Como está a empresa", "pre": {"perfil": "admindiretoria", "rota": "inicio"},
  "fala": "A primeira coisa é um semáforo. Verde: nada precisa de você agora. Amarelo ou vermelho: tem algo para olhar, e o botão leva direto na tela que resolve. Embaixo, os números do dia: quantas cargas saíram e quantas tiveram diferença.",
  "acoes": [dst(".status-simples"), dst(".numeros-simples")]},
 {"id": "03-resumo", "titulo": "O resumo completo", "pre": {"perfil": "admindiretoria", "rota": "resumo"},
  "fala": "O resumo completo é o raio-x. Escolha o período: hoje, ontem, sete ou trinta dias. Você vê quantas conferências foram feitas, quantas deram diferença, quantas notas estão paradas e quantos produtos pedem atenção. Mais abaixo, onde a empresa mais erra e como está cada pessoa da equipe.",
  "acoes": [txt(".chip", "30 dias"), dst(".kpis"), rol(".barras")]},
 {"id": "04-cargas", "titulo": "Onde está o prejuízo", "pre": {"perfil": "admindiretoria", "rota": "cargas"},
  "fala": "Este é o filtro que mais importa para você: só as cargas com diferença. Cada uma mostra o que saiu a mais ou a menos, a foto do caminhão e quem conferiu. É aqui que aparece, em número, quanto a empresa estava perdendo sem saber.",
  "acoes": [txt(".chip", "Com diferença"), clk(".conf")]},
 {"id": "05-equipe", "titulo": "A equipe e os avisos", "pre": {"perfil": "admindiretoria", "rota": "equipe"},
  "fala": "Na equipe você vê quem confere, quanto cada um erra, e qual administrador cadastrou cada pessoa. E os avisos críticos chegam no seu celular na hora, com um botão para chamar no WhatsApp quem precisa resolver.",
  "acoes": [dst(".pessoa-linha"), rol(".lista-simples")]},
]

TUDO = {
    "conferente":     ("Tutorial · Conferente",     "Conferir carga, do começo ao fim", "Agora é com você. Boa conferência!", CONFERENTE),
    "motorista":      ("Tutorial · Motorista",      "O que você precisa saber",         "Só saia com a carga conferida. Boa viagem!", MOTORISTA),
    "vendedor":       ("Tutorial · Vendedor",       "Notas, estoque, cargas e o cliente",        "Agora é com você. Boas vendas!", VENDEDOR),
    "expedicao":      ("Tutorial · Expedição",      "Comandar o pátio pelo celular",    "Agora é com você. Bom trabalho!", EXPEDICAO),
    "administrativo": ("Tutorial · Administrativo", "Cadastros e notas sem digitar",    "Agora é com você. Bom trabalho!", ADMINISTRATIVO),
    "diretoria":      ("Tutorial · Diretoria",      "A empresa em uma tela",            "A empresa na palma da mão.", DIRETORIA),
}

if __name__ == "__main__":
    for nome, (titulo, sub, fim, cenas) in TUDO.items():
        print(f"{nome}:")
        doc = {"titulo": titulo, "audio": f"assets/tutoriais/audio/{nome}",
               "voz": {"modelo": "eleven_multilingual_v2", "estabilidade": 0.35, "similaridade": 0.75, "estilo": 0.45},
               "inicio": {"titulo": titulo, "sub": sub, "botao": "Começar o tutorial"},
               "fim": {"titulo": "Tutorial concluído", "sub": fim},
               "cenas": montar(cenas)}
        p = RAIZ / f"assets/tutoriais/{nome}.json"
        p.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf8")
        seg = sum(len(c["fala"]) / CAR_POR_SEG + 0.4 for c in cenas)
        print(f"  {len(cenas)} aulas · {sum(len(c['fala']) for c in cenas)} caracteres · ~{seg / 60:.1f} min")
