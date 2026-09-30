// Roteiro do vendedor (persona "sales" — vale para todo vendedor e para a
// franquia Individual) — texto literal de `TOUR_CHAPTERS`, protótipo V12
// (`cotecerto_prototipo_v12.html`, build 28/07 · r40, abertura `curTourCfg`
// ~linha 8767, engine ~8771). Task V12.3.10.
//
// Três ajustes aprovados (decisão do usuário, V12.3.10):
// 1) Onde a função está desabilitada no app hoje, o texto ganha só
//    " (em breve)" junto do nome dela: Prêmio/VIP (cap. 4, "As cinco
//    ferramentas") e Documentos/Consultar (cap. 5 e 6); Mensagens perdeu o
//    "(em breve)" em V12.4.5, quando passou a abrir as mensagens da seguradora. Na
//    Engrenagem, "Análise do envio" e "Personalizar coberturas" (V12.3.7);
//    sem "prêmios por cobertura" — não existe, ver AnaliseEnvioModal.tsx.
// 2) "Filtrar por tipo de cobertura" (`.cob-filtro`) entrou em V12.3.12, com
//    o dado real de seção do robô. "Personalizar uma seguradora sem sair
//    daqui" (cap. 4) e "E depois personalize por seguradora" (cap. 3,
//    `.seg-perso`) entraram em V12.3.7. O passo "Cliente VIP" (cap. 4) foi
//    removido: não há Cliente VIP implementado.
//
// O passo "Os documentos originais" (cap. 5) também precisou de um ajuste
// de conteúdo: no protótipo ele descreve arquivos (proposta original,
// boleto, cotação) dentro de `.doc-li` — mas no app o `.doc-li` real
// (`TransmissaoTransmitidaCard.tsx`) é um resumo de dados (cálculo,
// segurado, modelo, seguradora), não uma lista de documentos. Os
// documentos de verdade vivem em `.acc-pills` ("Documentos e envio" /
// "Consultar protocolo"), hoje desabilitados. O passo foi reapontado para
// `.acc-pills` com "(em breve)", para não descrever algo que não existe.
import type { TutorialSourceChapter } from "./tutorial-targets";

export const salesTutorialChapters = [
  /* =========== M1 — O LEAD CHEGOU =========== */
  {
    id: 1,
    module: "M1 · O LEAD CHEGOU",
    title: "Primeiro dia no CoteCerto",
    hook: '"Abri o sistema. Por onde eu começo?"',
    duration: "~5 min",
    steps: [
      {
        page: "home",
        target: null,
        pos: "center",
        title: "O menu é o ciclo da venda",
        body: "<p>Não decore telas: leia o menu de cima para baixo e você tem o caminho de um seguro inteiro. <strong>Atender agora</strong> é o lead que acabou de chegar. <strong>Minha agenda</strong> é o que você prometeu fazer. <strong>Pipeline</strong> é tudo que está aberto. Depois vêm as três fases — <strong>Em cotação</strong>, <strong>Em negociação</strong>, <strong>Em finalização</strong> — e por fim <strong>Emissão &amp; histórico</strong>, quando a apólice sai.</p><p>Os números amarelos ao lado de cada item são <strong>quantidade de trabalho parado ali</strong>. Menu sem número é menu sem dívida.</p>",
        tip: {
          label: "A regra da casa",
          text: 'Comece o dia de cima para baixo. Se "Atender agora" tem número, ele vem antes de qualquer outra coisa — é o único item do menu com relógio correndo.',
        },
        prepare: "lead-step-0",
      },
      {
        page: "home",
        target: '.nav-item[data-nav="atender"]',
        pos: "right",
        title: "Atender agora — e o relógio de 3 minutos",
        body: "<p>Quando a Matriz distribui um lead de campanha para você, ele cai aqui e <strong>começa a contar 3 minutos</strong>. Sem reação nesse tempo, o lead volta para a fila da Matriz e é redistribuído para outro vendedor.</p><p>Por isso esse item tem badge vermelho e pulsa: é o único lugar do sistema onde você pode <strong>perder o lead por demora</strong>.</p>",
        tip: {
          label: "Por que 3 minutos",
          text: "O cliente pediu cotação agora e provavelmente pediu em mais de um lugar. Quem responde primeiro conversa com ele antes do concorrente. Depois de algumas horas, a mesma pessoa nem lembra que pediu.",
        },
      },
      {
        page: "atender",
        target: ".atender-grid",
        pos: "top",
        title: "Só existe uma ação nesta tela",
        body: "<p>Cada card é um lead com o cronômetro correndo. A barra embaixo do nome mostra quanto tempo ainda resta. E há um único botão: <strong>Assumir e iniciar</strong>.</p><p>É de propósito. <strong>Abrir para olhar não segura o lead</strong> — o relógio continua correndo. Assumir é o que tira ele da fila da Matriz e põe no seu nome; e o mesmo clique já te leva para a primeira etapa da cotação.</p>",
        tip: {
          label: "A pílula vermelha do topo",
          text: "O contador também vive na barra superior, em qualquer tela. Se ela estiver acesa enquanto você faz outra coisa, tem lead esfriando.",
        },
      },
      {
        page: "home",
        target: ".topbar .search",
        pos: "bottom",
        title: "A busca acha por placa",
        body: "<p>Cliente que liga raramente diz o número da cotação. Diz o nome, ou a placa do carro. A busca aceita os três: <strong>nome, placa ou número da cotação</strong>.</p>",
        tip: { label: "Atalho", text: 'A tecla "/" em qualquer tela põe o cursor na busca.' },
      },
      {
        page: "home",
        target: "#btnNovoLead",
        pos: "bottom",
        title: "Lead Manual — quem chegou por fora",
        body: "<p>Indicação, ligação direta, WhatsApp de conhecido, contato de evento: esses não vêm da Matriz, então você mesmo cadastra por aqui.</p><p>O formulário pede nome, telefone, placa e <strong>canal</strong> (de onde veio), mais o <strong>tipo de seguro</strong> — os mesmos ícones em círculo que você vê na etapa 2 da cotação. É essa escolha que define a jornada.</p><p>A diferença que importa: <strong>Lead Manual não tem os 3 minutos</strong>. Ninguém vai tirar ele de você. O que não quer dizer que possa dormir em cima — ele entra no Pipeline como qualquer outro e passa a contar dias parados.</p>",
      },
      {
        page: "home",
        target: "#sideUser",
        pos: "right",
        title: "Você, no pé do menu",
        body: "<p>Seu perfil e o sininho de notificações ficam no rodapé do menu. Ali você confere seus dados, vê os avisos e sai do sistema.</p>",
      },
      {
        page: "home",
        target: ".hero-placar",
        pos: "bottom",
        title: "Seu placar do mês",
        body: "<p>Quantas apólices você fez, quantas faltam para a meta e <strong>quanto isso vale em comissão</strong>. O anel mostra a porcentagem; ao lado dele vem o ritmo necessário — quantas vendas por dia para chegar lá.</p><p>Não é enfeite: é o número que responde se você pode desacelerar hoje ou não.</p>",
      },
      {
        page: "home",
        target: ".dia-fila",
        pos: "bottom",
        title: "O que fazer agora",
        body: "<p>Logo abaixo do placar fica a <strong>fila do dia</strong>, na ordem em que ela cobra: o atrasado vem primeiro, depois o de hoje, depois o resto.</p><p>Ela junta tudo que espera por você — retorno que você marcou com o cliente, lembrete que você mesmo criou, negócio em risco, pendência da seguradora e aprovação que você pediu. Clicar em uma linha te leva direto ao lugar de resolver, <strong>com o item já destacado</strong>.</p>",
        tip: {
          label: "Dá para riscar daqui mesmo",
          text: "Retornos e lembretes trazem um visto verde na ponta direita: marcou como feito, o item sai da fila na hora — sem precisar abrir a agenda.",
        },
      },
    ],
    outro: {
      hook: '"Pronto: você já sabe entrar, achar e assumir. Agora vamos ao que não pode ser esquecido."',
    },
  },

  {
    id: 2,
    module: "M1 · O LEAD CHEGOU",
    title: "Minha agenda",
    hook: '"Prometi ligar hoje pra três pessoas. Onde isso fica?"',
    duration: "~3 min",
    steps: [
      {
        page: "agenda",
        target: null,
        pos: "center",
        title: "Tudo que espera por você, num lugar só",
        body: "<p>Vendedor perde negócio por esquecimento, não por falta de talento. Esta tela junta as cinco coisas que costumam se perder em cadernos e post-its:</p><p><strong>Retornos agendados</strong> — o que você marcou com o cliente.<br><strong>Negócios em risco</strong> — cotação parada tempo demais, proposta sem resposta.<br><strong>Pendências da seguradora</strong> — documento ou vistoria que travou a emissão.<br><strong>Aprovações que você pediu</strong> — desconto ou VIP esperando resposta de quem manda.<br><strong>Meus lembretes</strong> — o que você mesmo anotou, com ou sem cliente.</p>",
      },
      {
        page: "agenda",
        target: "#btnNovoLembrete",
        pos: "left",
        title: "Anotar o que não nasce de um lead",
        body: "<p>As quatro primeiras listas o sistema monta sozinho. Esta última é sua: <strong>Novo lembrete</strong> serve para o compromisso que não vem de nenhuma cotação — ligar para o contador, levar documento na seguradora, a reunião de segunda.</p><p>Você escolhe o tipo (tarefa, ligação, reunião ou pessoal), a data e a hora. O campo <strong>Cliente é opcional</strong>: vincule só quando o lembrete for sobre um atendimento específico — aí clicar nele te leva direto ao lead.</p>",
        tip: {
          label: "Por que aqui e não no papel",
          text: "O que está no papel não entra na sua fila de urgência. O que está aqui aparece no Início, na ordem certa, junto com tudo o mais que vence hoje.",
        },
      },
      {
        page: "agenda",
        target: ".summary-chips",
        pos: "bottom",
        title: "Atrasado, hoje, total",
        body: "<p>Leia da esquerda para a direita e você sabe o tamanho do estrago antes de rolar a lista. <strong>Atrasado</strong> é o que já passou da hora e devia ter sido o primeiro clique do seu dia.</p>",
      },
      {
        page: "agenda",
        target: ".ag-filtros",
        pos: "bottom",
        title: "Filtrar por tipo de pendência",
        body: "<p>Às vezes você quer despachar tudo de uma natureza só — todos os retornos, ou todas as pendências de seguradora. Os chips filtram por tipo, e o número em cada um já diz quanto tem.</p>",
      },
      {
        page: "agenda",
        target: ".ag-item",
        pos: "right",
        title: "Clicar leva para a origem — e destaca",
        body: "<p>Este é o ponto mais importante da agenda. Cada linha é <strong>um atalho para o lugar onde a tarefa se resolve</strong>, não um lembrete solto.</p><p>Ao clicar, o sistema te leva à tela certa, <strong>rola até o item</strong> e o marca com um contorno amarelo — junto com uma faixa no topo lembrando de onde você veio e por quê. Você não precisa procurar o cliente na lista.</p>",
        tip: {
          label: "Saindo do foco",
          text: "O X na faixa amarela desliga o destaque e devolve a tela ao normal. O lembrete só some da agenda quando a tarefa é feita de verdade.",
        },
        prepare: "agenda-exemplo",
      },
      {
        page: "agenda",
        target: ".ic-btn.ok",
        pos: "left",
        title: "Marcar como feito",
        body: "<p>Retorno cumprido ou lembrete feito, clique no visto verde: a linha sai da agenda na hora.</p><p>O mesmo visto existe na fila do <strong>Início</strong>, então dá para riscar de lá também — você não marca a mesma coisa em dois lugares.</p>",
        prepare: "agenda-exemplo",
      },
    ],
    outro: { hook: '"Com a agenda limpa, dá pra trabalhar. Vamos cotar."' },
  },

  /* =========== M2 — DA CONVERSA À COTAÇÃO =========== */
  {
    id: 3,
    module: "M2 · DA CONVERSA À COTAÇÃO",
    title: "A jornada em 7 etapas",
    hook: '"Assumi o lead. E agora, o que eu pergunto?"',
    duration: "~5 min",
    steps: [
      {
        page: "lead",
        target: "#stepperBar",
        pos: "bottom",
        title: "A trilha inteira, sempre à vista",
        body: "<p>São sete etapas, na ordem em que a conversa acontece: <strong>Segurado, Seguro, Veículo, Perfil, Coberturas, Cálculo e Transmissão</strong>. A barra mostra onde você está e o que já ficou para trás.</p><p>Você pode voltar em qualquer etapa clicando nela. <strong>Nada se perde</strong> — o que já foi preenchido continua lá.</p>",
        tip: {
          label: "Se o cliente desligar no meio",
          text: "Pode fechar. O sistema guarda a etapa exata em que parou e a retoma no mesmo ponto, seja pelo Pipeline, pela lista Em cotação ou pela busca.",
        },
        prepare: "lead-step-0",
      },
      {
        page: "lead",
        target: "#btnHistorico",
        pos: "bottom",
        title: "Registros & agendamentos — a memória do atendimento",
        body: '<p>Este botão acompanha você em toda a jornada, e faz três coisas.</p><p><strong>Agendar retorno</strong> — data, hora e o que combinou. Vira uma linha na sua agenda e no card do lead.<br><strong>Adicionar observação</strong> — só o texto, sem data: "o cliente pediu para ligar depois das 18h", "vai mandar a foto da CNH". É o que você esqueceria até a próxima ligação.<br><strong>Linha do tempo</strong> — o sistema anota sozinho cada avanço seu na cotação, com data e hora.</p>',
        tip: {
          label: "Clicar na linha do tempo retoma o ponto",
          text: "Cada evento registrado guarda a etapa em que você estava. Clicar nele te devolve exatamente àquela etapa da jornada — útil quando o cliente liga perguntando de algo que você tratou dias atrás.",
        },
        prepare: "lead-step-0",
      },
      {
        page: "lead",
        target: "#fldCpf",
        pos: "right",
        title: "Etapa 1 — comece pelo CPF",
        body: "<p>Digite o CPF ou CNPJ e o sistema busca o cadastro. Se a pessoa já foi cliente ou já foi cotada antes, <strong>o resto vem preenchido</strong> e você só confirma.</p><p>É por isso que essa é a primeira pergunta da ligação: ela pode economizar dois minutos de digitação.</p>",
        prepare: "lead-step-0",
      },
      {
        page: "lead",
        target: "#fldCep",
        pos: "right",
        title: "O CEP muda o preço",
        body: "<p>O endereço onde o carro dorme é um dos maiores fatores de preço do seguro auto. O CEP puxa rua, bairro e cidade sozinho.</p>",
        tip: {
          label: "Cuidado aqui",
          text: "CEP do trabalho no lugar do CEP de casa é um erro comum e caro: o cálculo sai com o risco errado e a seguradora pode recusar depois.",
        },
        prepare: "lead-step-0",
      },
      {
        page: "lead",
        target: ".tipo-item",
        pos: "bottom",
        title: "Etapa 2 — que item vai ser segurado",
        body: "<p>O lead já chega marcado como Auto, Moto ou Vida, porque a campanha que o trouxe dizia isso. Mas campanha erra, e cliente muda de ideia no meio da conversa.</p><p>Se ele ligou pelo carro e no fim quer segurar a moto, é <strong>aqui</strong> que você troca — sem recomeçar o cadastro. Hoje só o <strong>Automóvel</strong> tem jornada completa; os outros aparecem marcados e entram em breve.</p>",
        prepare: "lead-step-1",
      },
      {
        page: "lead",
        target: ".seg-pick",
        pos: "top",
        title: "Quais seguradoras vão calcular",
        body: "<p>Marque e desmarque as seguradoras que vão receber esta cotação. <strong>Todas marcadas por padrão</strong> — quanto mais cotações, mais chance de achar o preço bom.</p><p>Desmarcar faz sentido em casos específicos: cliente que já teve problema com uma delas, ou negativa recente de aceitação.</p>",
        prepare: "lead-step-1",
      },
      {
        page: "lead",
        target: "#fldPlaca",
        pos: "right",
        title: "Etapa 3 — a placa preenche o carro",
        body: "<p>Digite a placa e o sistema traz modelo, ano, combustível e código Fipe. Se for <strong>zero-quilômetro</strong> ainda sem placa, você busca pela descrição ou pelo próprio código Fipe.</p>",
        prepare: "lead-step-2",
      },
      {
        page: "lead",
        target: "#foldVeic",
        pos: "top",
        title: "Acessórios e blindagem entram aqui",
        body: "<p>Kit gás, blindagem, rastreador, acessórios: o que não estiver declarado <strong>não está coberto</strong>. Vale mais gastar trinta segundos perguntando do que descobrir isso no sinistro.</p>",
        prepare: "lead-step-2",
      },
      {
        page: "lead",
        target: "#swCond",
        pos: "right",
        title: "Etapa 4 — o perfil de quem dirige",
        body: "<p>Garagem, principal condutor e jovens na casa. São três perguntas curtas que <strong>mexem muito no prêmio</strong>.</p><p>O principal condutor é quem mais usa o carro, não necessariamente o dono. Se o filho de 19 anos dirige todo dia e o pai declarou a si mesmo, a apólice sai barata e <strong>o sinistro é negado</strong>.</p>",
        tip: {
          label: "O que conta como garagem",
          text: "Vale garagem, box ou estacionamento fechado de uso do segurado. Rua, mesmo que tranquila, não conta.",
        },
        prepare: "lead-step-3",
      },
      {
        page: "lead",
        target: ".plano-pick",
        pos: "top",
        title: "Etapa 5 — comece por um plano pronto",
        body: "<p>Em vez de montar cobertura por cobertura, escolha um dos pacotes: <strong>Fácil</strong> (casco, terceiros e assistência), <strong>Pleno</strong> (mais vidros e carro reserva) ou <strong>Completo</strong>.</p><p>O plano é o pacote base que <strong>vai para todas as seguradoras ao mesmo tempo</strong> — é o que torna a comparação justa.</p>",
        prepare: "lead-step-4",
      },
      {
        page: "lead",
        target: ".seg-perso",
        pos: "top",
        title: "E depois personalize por seguradora",
        body: "<p>Aqui você ajusta o que é diferente em cada uma — franquia, carro reserva, vidros — sem mexer no pacote das outras.</p><p>Mas o normal é <strong>calcular primeiro</strong> e só personalizar depois de ver os preços. Você personaliza para resolver uma objeção concreta do cliente, não no escuro.</p>",
        prepare: "lead-step-4",
      },
      {
        page: "lead",
        target: "#resumoCard",
        pos: "left",
        title: "O resumo lateral acompanha tudo",
        body: "<p>À direita, o resumo vai se preenchendo conforme você digita. Serve para conferir com o cliente em voz alta antes de calcular — e para não descobrir um dado errado depois de nove cotações voltarem.</p>",
        prepare: "lead-step-4",
      },
    ],
    outro: { hook: '"Dados na mão. Agora as nove seguradoras respondem de uma vez."' },
  },

  {
    id: 4,
    module: "M2 · DA CONVERSA À COTAÇÃO",
    title: "O cálculo",
    hook: '"Voltaram nove preços. Como eu vendo isso?"',
    duration: "~6 min",
    steps: [
      {
        page: "lead",
        target: ".calc-ctx",
        pos: "bottom",
        title: "A barra de contexto",
        body: "<p>Antes dos preços, a faixa de cima diz de quem é esta cotação: <strong>número, cliente, plano e validade</strong>.</p><p>O número da cotação é o que o cliente usa para falar com você depois, e o que você usa para achar tudo na busca. A validade importa: <strong>preço de seguro vence</strong> — passou da data, recalcule antes de prometer.</p>",
        prepare: "lead-calculo-lista",
      },
      {
        page: "lead",
        target: ".calc-lista",
        pos: "top",
        title: "A lista comparativa é a visão de venda",
        body: "<p>Seguradoras nas colunas, coberturas nas linhas. É a tela que você lê ao telefone com o cliente, porque mostra <strong>onde uma é melhor que a outra</strong>, e não só qual é a mais barata.</p><p>Por isso ela já vem aberta assim quando você chega do Coberturas.</p>",
        prepare: "lead-calculo-lista",
      },
      {
        page: "lead",
        target: ".cl-nav",
        pos: "bottom",
        title: "Ver as seguradoras que não couberam na tela",
        body: "<p>São até nove — a tela não mostra todas de uma vez. As setas rolam para os lados e o contador diz <strong>quantas ficaram de fora da visão</strong>, para você não fechar negócio achando que viu tudo.</p>",
        prepare: "lead-calculo-lista",
      },
      // "Filtrar por tipo de cobertura" (V12.3.12): texto do protótipo V12; o
      // portal chama a segunda seção de "Ofertas adicionais" (o protótipo, "Demais").
      {
        page: "lead",
        target: ".cob-filtro",
        pos: "bottom",
        title: "Filtrar por tipo de cobertura",
        body: "<p><strong>Compreensiva</strong> mostra as coberturas principais; <strong>Ofertas adicionais</strong>, os adicionais; <strong>Todas</strong>, a lista inteira. Serve para encurtar a conversa quando o cliente só quer saber de uma coisa.</p>",
        prepare: "lead-calculo-lista",
      },
      {
        page: "lead",
        target: ".seg-acoes",
        pos: "left",
        title: "As cinco ferramentas de cada seguradora",
        body: "<p>Toda seguradora do comparativo traz a mesma fileira de cinco botões — e eles agem <strong>só naquela cia</strong>, não no cálculo inteiro:</p><p><strong>Mensagens</strong> — o que ela respondeu sobre o risco.<br><strong>%</strong> — solicitar desconto adicional nesta seguradora.<br><strong>Prêmio (em breve)</strong> — pedir atendimento VIP para este cliente.<br><strong>Engrenagem</strong> — opções: análise do envio e personalizar coberturas.<br><strong>Recalcular</strong> — refazer o cálculo só desta cia.</p>",
        tip: {
          label: '"Sem retorno" não é erro',
          text: "Seguradora pode recusar o perfil, estar fora do ar ou não operar naquela região. Quando aparece o aviso de sem retorno, vale ler o motivo: às vezes é um dado que você corrige e recota ali mesmo, pelo botão Recalcular.",
        },
        prepare: "lead-calculo-lista",
      },
      {
        page: "lead",
        target: ".seg-acoes",
        pos: "left",
        title: "Personalizar uma seguradora sem sair daqui",
        body: "<p>Se o cliente quer só a franquia de uma delas mais baixa, abra a <strong>engrenagem</strong> daquela seguradora e escolha <strong>Personalizar coberturas</strong>: você ajusta num modal e recalcula só ela.</p><p>Não precisa voltar para a etapa Coberturas e refazer as nove — isso quebrava o fluxo da conversa e derrubava o resto do comparativo.</p>",
        prepare: "lead-calculo-lista",
      },
      {
        page: "lead",
        target: ".calc-toolset",
        pos: "bottom",
        title: "Lista ou cards",
        body: "<p>A <strong>lista</strong> é para comparar; os <strong>cards</strong> são para fechar, com o preço grande e o parcelamento em destaque. Passe o mouse sobre um parcelamento e aparece o botão <strong>Contratar</strong>.</p><p>Ao lado ficam os dois filtros da barra: <strong>faixa de preço</strong> e <strong>ordenação</strong> — menor preço, maior preço ou a ordem em que as cias responderam.</p>",
        prepare: "lead-calculo-lista",
      },
      {
        page: "lead",
        target: ".seg-acoes",
        pos: "left",
        title: "Desconto: até onde você vai sozinho",
        body: "<p>Você tem uma <strong>alçada própria</strong> de desconto e pode aplicar na hora, sem pedir nada a ninguém. Acima dela, o pedido <strong>sobe automaticamente para o seu Supervisor</strong> — e, se passar da alçada dele, sobe de novo.</p><p>É por isso que se chama escalável: você não precisa saber a quem pedir. Pede, e o sistema roteia. A resposta volta em <strong>Minha agenda</strong>, na aba Aprovações que você pediu.</p>",
        tip: {
          label: "Enquanto espera",
          text: 'Não deixe o cliente no vácuo. Mande a cotação com o preço atual e avise que está tentando melhorar — negócio que esfria esperando aprovação é o que mais aparece em "Negócios em risco".',
        },
        prepare: "lead-calculo-lista",
      },
      // Removido (não entra): "Cliente VIP" — não há Cliente VIP
      // implementado hoje.
      {
        page: "lead",
        target: ".calc-bar-r",
        pos: "bottom",
        title: "Imprimir e mandar para o cliente",
        body: "<p>Duas versões: a <strong>resumida</strong>, de uma página, que é a que se manda no WhatsApp; e a <strong>detalhada</strong>, com todas as coberturas, para quem quer estudar.</p><p>Você escolhe <strong>quais seguradoras entram no PDF</strong> — e isso é decisão de venda. Mandar as nove costuma confundir; três bem escolhidas fecham mais.</p>",
        prepare: "lead-calculo-lista",
      },
    ],
    outro: { hook: '"Cliente escolheu. Hora de transformar cotação em proposta."' },
  },

  /* =========== M3 — FECHAR =========== */
  {
    id: 5,
    module: "M3 · FECHAR",
    title: "Transmissão à seguradora",
    hook: '"Ele disse sim. E agora?"',
    duration: "~5 min",
    steps: [
      {
        page: "lead",
        target: ".acc-sol",
        pos: "bottom",
        title: "Etapa 7 — os passos até a seguradora",
        body: "<p>Contratar no cálculo traz você para cá. A sequência é <strong>Dados complementares</strong>, <strong>Confirmação</strong> e, por fim, a proposta <strong>Transmitida</strong>. Quando a forma escolhida é <strong>cartão de crédito</strong>, entra um passo a mais entre eles: <strong>Pagamento</strong>.</p><p>No topo fica o resumo do que foi contratado — seguradora, forma de pagamento, vigência e modalidade — para você conferir sem voltar ao cálculo.</p>",
        tip: {
          label: "Sai e volta no mesmo lugar",
          text: 'A transmissão guarda o passo de cada lead. Antes de efetivar, se você sair no meio (Dados complementares, Confirmação ou Pagamento) e voltar depois, o sistema reabre em Dados complementares com a mesma oferta escolhida. Depois de efetivar, o lead aparece na lista Em finalização e reabre exatamente no ponto — o botão muda entre "Consultar status" (aguardando a seguradora) e "Tentar novamente" (se deu falha).',
        },
        prepare: "lead-transmissao-dados",
      },
      {
        page: "lead",
        target: ".wizard-grid",
        pos: "top",
        title: "Passo 1 — o que a cotação não pediu",
        body: "<p>Para cotar bastava um punhado de dados. Para <strong>emitir apólice</strong>, a seguradora quer o cadastro completo: RG e órgão emissor, telefones, e-mail e endereço com número.</p><p>Aqui não dá para chutar. Dado errado nesta tela vira <strong>recusa ou pendência</strong> lá na frente, e aí você refaz tudo.</p>",
        tip: {
          label: "Endereço de correspondência",
          text: "Se for diferente do endereço do segurado, o botão abre um segundo endereço para preencher. Sendo o mesmo, deixe fechado — o sistema repete o de cima.",
        },
        prepare: "lead-transmissao-dados",
      },
      {
        page: "lead",
        target: ".ff-table",
        pos: "top",
        title: "Passo 2 — a última conferida",
        body: "<p>Tudo que vai ser enviado, numa tela só: veículo, uso, condutor, coberturas e valores.</p><p>Leia com atenção, porque <strong>depois de transmitir a seguradora assume o processo</strong>. Corrigir vira endosso ou cancelamento — muito mais trabalho do que ler agora.</p>",
        prepare: "lead-transmissao-confirmacao",
      },
      {
        page: "lead",
        target: ".wizard-foot .btn-yellow",
        pos: "top",
        title: "Efetivar proposta",
        body: "<p>Este é o clique que envia. A partir daqui a cotação vira <strong>proposta</strong>, ganha número e protocolo, e sai do seu controle.</p><p>A resposta pode demorar — por isso aparece uma tela de espera enquanto a seguradora processa.</p>",
        prepare: "lead-transmissao-confirmacao",
      },
      {
        page: "lead",
        target: ".acc-pills",
        pos: "top",
        title: "Transmitida — o que você recebe de volta",
        body: "<p>Voltam o <strong>número da proposta</strong> e o <strong>protocolo</strong>, mais o status na seguradora. Pode vir <strong>Em análise</strong>, com uma pendência descrita — vistoria prévia agendada, documento faltando.</p><p>Se houver pendência, ela também nasce em <strong>Minha agenda</strong>, para não depender de você lembrar de voltar aqui.</p>",
        prepare: "lead-transmitida",
      },
      {
        page: "lead",
        target: ".acc-pills",
        pos: "right",
        title: "Os documentos originais",
        body: "<p>Aqui ficam os atalhos desta proposta: <strong>Proposta (PDF)</strong> e <strong>Consultar protocolo (em breve)</strong>. O PDF chega sozinho alguns minutos depois da transmissão; enquanto isso o botão mostra <em>Preparando documento…</em>. Para enviar ao cliente, use o <strong>seu WhatsApp</strong> — o CoteCerto não reenvia o arquivo.</p>",
        prepare: "lead-transmitida",
      },
      {
        page: "lead",
        target: ".atalhos",
        pos: "top",
        title: "Em cima, esta proposta; embaixo, o próximo passo",
        body: '<p>A parte de cima é tudo que diz respeito a <strong>esta</strong> proposta. A de baixo são atalhos para <strong>recomeçar o ciclo</strong> — abrir nova cotação, voltar ao Pipeline, ir para a Emissão.</p><p>Separado assim de propósito: misturar as duas coisas fazia o vendedor clicar em "nova cotação" achando que estava agindo sobre a proposta que acabou de mandar.</p>',
        prepare: "lead-transmitida",
      },
    ],
    outro: { hook: '"Transmitida. Agora é acompanhar até a apólice sair."' },
  },

  {
    id: 6,
    module: "M3 · FECHAR",
    title: "Emissão & histórico",
    hook: '"Mandei semana passada. Saiu ou não saiu?"',
    duration: "~3 min",
    steps: [
      {
        page: "emissao",
        target: null,
        pos: "center",
        title: "Duas listas, duas naturezas",
        body: "<p>Em cima, <strong>Aguardando a seguradora</strong>: o que depende de vistoria, pagamento ou análise. Em baixo, <strong>Concluídas</strong>: apólice emitida, negócio fechado.</p><p>A de cima é trabalho; a de baixo é histórico. Se algo está na de cima há dias demais, é você quem cobra.</p>",
      },
      {
        page: "emissao",
        target: ".table-pipe",
        pos: "top",
        title: "A coluna Situação é o que importa",
        body: "<p><strong>Transmitida</strong> — enviada, seguradora ainda não se manifestou.<br><strong>Em análise</strong> — tem pendência, e ela aparece escrita ali do lado.<br><strong>Emitida</strong> — apólice saiu, e o número dela é o seu comprovante.</p>",
      },
      {
        page: "emissao",
        target: ".table-pipe",
        pos: "top",
        title: "Documentos e consulta de status",
        body: '<p><strong>Proposta (PDF)</strong> abre o PDF original da proposta, que chega sozinho depois da transmissão; para reenviar ao cliente, use o seu WhatsApp. Se aparecer <em>Documento indisponível</em>, o responsável pela cotação ou a Matriz pode usar <strong>Tentar de novo</strong>. <strong>Consultar (em breve)</strong> pergunta o status atual à seguradora pelo protocolo — é o que responde "saiu ou não saiu" sem telefonema.</p>',
      },
    ],
    outro: { hook: '"Ciclo completo. Vamos ao painel onde tudo isso aparece junto."' },
  },

  /* =========== M4 — O SEU PAINEL DE TRABALHO =========== */
  {
    id: 7,
    module: "M4 · O SEU PAINEL DE TRABALHO",
    title: "O Pipeline anda sozinho",
    hook: '"Preciso arrastar os cards pra manter isso organizado?"',
    duration: "~4 min",
    steps: [
      {
        page: "pipeline",
        target: null,
        pos: "center",
        title: "Não. E é essa a ideia",
        body: "<p>A coluna de cada lead é <strong>consequência do trabalho feito</strong>, não de arrastar card. Você preencheu até Coberturas, ele está em <em>Em cotação</em>. Calculou, ele vira <em>Em negociação</em>. Contratou, vai para <em>Em finalização</em>. Transmitiu, cai em <em>Fechamento</em>.</p><p>Ninguém precisa manter o quadro em dia, e <strong>ninguém consegue maquiar</strong> o próprio funil.</p>",
        tip: {
          label: "Por que isso muda o seu dia",
          text: "Em quadro arrastado à mão, card parado pode ser esquecimento de mover. Aqui, card parado é negócio parado de verdade — dá para confiar no que você está vendo.",
        },
      },
      {
        page: "pipeline",
        target: ".kcol",
        pos: "right",
        title: "As cinco colunas",
        body: "<p><strong>Lead novo</strong> — chegou, ninguém abriu.<br><strong>Em cotação</strong> — preenchendo os dados.<br><strong>Em negociação</strong> — já calculou, ajustando com o cliente.<br><strong>Em finalização</strong> — na transmissão.<br><strong>Fechamento</strong> — transmitida, esperando a seguradora.</p><p>São as cinco etapas em que ainda há trabalho seu. <strong>Lead perdido não aparece aqui</strong>: ele já foi devolvido à Matriz e não pede mais nada de você — some do quadro para não competir por atenção com quem ainda pode fechar.</p>",
        tip: {
          label: "O título fica parado",
          text: 'Cada coluna rola por dentro: o nome da etapa e o contador ficam fixos no topo enquanto os cards passam. Quando há mais do que cabe, aparece "mais 4 ⌄" no pé — e o último card desbota para avisar que tem coisa abaixo.',
        },
      },
      {
        page: "pipeline",
        target: ".kcard",
        pos: "right",
        title: "O card diz onde parou e há quanto tempo",
        body: '<p>Cada card mostra o cliente, o produto com seu ícone, e a frase que mais importa: <strong>"parou em Coberturas há 6 dias"</strong>.</p><p>Não é o estágio genérico — é o ponto exato de onde você retoma. E clicar abre o lead <strong>naquela etapa</strong>, não no começo.</p>',
      },
      {
        page: "pipeline",
        target: ".filters-bar",
        pos: "bottom",
        title: "Filtrar por estágio, produto, canal e dias parados",
        body: '<p>Os filtros que resolvem perguntas reais: "o que está parado há mais de 7 dias?", "quais são os leads de moto?", "o que veio de indicação?".</p><p>Não existe filtro por preço nem por seguradora aqui — nesta altura a maioria ainda nem calculou, então esses campos estariam vazios e enganariam a conta.</p>',
      },
      {
        page: "pipeline",
        target: ".toggle",
        pos: "bottom",
        title: "Kanban ou tabela",
        body: "<p>O <strong>kanban</strong> mostra o formato do funil: onde tem gargalo. A <strong>tabela</strong> é para trabalhar em série, quando você quer despachar muitos leads seguidos.</p>",
      },
      {
        page: "lead",
        target: "#btnClassificarPerda",
        pos: "bottom",
        title: "Classificar a perda",
        body: "<p>Quando o negócio morre, registre o motivo — preço, concorrência, sem contato, momento de compra. Leva cinco segundos, e o botão fica no topo da jornada do lead.</p><p>Ao classificar, o lead <strong>sai do seu pipeline</strong> e volta para a Matriz: dependendo do motivo, ele entra na carteira de recuperação para uma nova abordagem ou é descartado.</p><p>Não é burocracia: é o que a Matriz lê para negociar comissão com as seguradoras e para ajustar as campanhas que geram os seus leads. Perda sem motivo é informação jogada fora.</p>",
        prepare: "lead-step-0",
      },
    ],
    outro: { hook: '"E se você quiser ir direto para uma fase específica?"' },
  },

  {
    id: 8,
    module: "M4 · O SEU PAINEL DE TRABALHO",
    title: "Os atalhos por fase",
    hook: '"Hoje eu só quero despachar as cotações paradas."',
    duration: "~3 min",
    steps: [
      {
        page: "emcotacao",
        target: null,
        pos: "center",
        title: "A mesma coisa do Pipeline, em modo lista",
        body: "<p><strong>Em cotação</strong>, <strong>Em negociação</strong> e <strong>Em finalização</strong> são as colunas do funil, abertas em lista e com a ação daquela fase já pronta no botão.</p><p>O Pipeline serve para <strong>enxergar</strong> o conjunto. Estas telas servem para <strong>trabalhar em série</strong> dentro de uma fase só.</p>",
      },
      {
        page: "emcotacao",
        target: ".table-pipe",
        pos: "top",
        title: "Em cotação — continuar de onde parou",
        body: "<p>A coluna <strong>Onde parou</strong> diz a etapa exata, e o botão te leva direto lá. O ícone do WhatsApp ao lado abre a conversa com o cliente sem sair da lista.</p>",
      },
      {
        page: "emnegociacao",
        target: "#page-emnegociacao .card",
        pos: "top",
        title: "Em negociação tem duas listas",
        body: '<p>O multi-cálculo não volta todo junto: cada seguradora responde no seu tempo. Por isso a fase é dividida em duas.</p><p>Em cima, <strong>Aguardando cotação</strong> — as seguradoras ainda estão calculando. A linha mostra quantas já responderam ("7 de 8") e não oferece o botão de abrir o cálculo, porque ainda não existe preço fechado para levar ao cliente.</p><p>Embaixo, <strong>Cotação finalizada</strong> — todas responderam. Aqui sim você abre o comparativo, ajusta e negocia.</p>',
        tip: {
          label: "A de cima alimenta a de baixo",
          text: "Você não move nada à mão: quando a última seguradora devolve o preço, a cotação desce sozinha para a lista de baixo.",
        },
      },
      {
        page: "emnegociacao",
        target: ".fase-acoes",
        pos: "left",
        title: "Em negociação — duas ações",
        body: "<p><strong>Abrir cálculo</strong> volta ao comparativo — é de lá que você ajusta coberturas e recalcula, quando o cliente pede. A <strong>impressora</strong> gera a cotação para mandar de novo.</p><p>São as duas coisas que se faz com um cliente que já viu preço e está pensando.</p>",
      },
      {
        page: "emnegociacao",
        target: '.nav-item[data-nav="emnegociacao"]',
        pos: "right",
        title: "O sistema te avisa quando o preço chega",
        body: '<p>Você não precisa ficar atualizando a tela. Assim que a última seguradora responde, aparece um <strong>cartão no canto inferior direito</strong> — "COTAÇÃO FINALIZADA · nome do cliente" — com dois botões: <strong>Abrir cálculo</strong> e <strong>Depois</strong>.</p><p>Ele não some sozinho como um aviso comum: fica ali até você agir ou dispensar. E aqui no menu, <strong>Em negociação</strong> fica verde e pulsando enquanto houver cotação nova que você ainda não abriu.</p>',
        tip: {
          label: "Por que isso importa",
          text: "O melhor momento para ligar é logo depois de o preço sair — o cliente ainda está esperando resposta. Meia hora depois ele já está em outra coisa.",
        },
      },
      {
        page: "emfinalizacao",
        target: ".fase-acoes",
        pos: "left",
        title: "Em finalização — consultar status",
        body: "<p>O botão leva à tela do protocolo, para checar o que a seguradora respondeu. Ao lado, a <strong>impressora</strong> gera a cotação aprovada, caso o cliente peça o documento de novo.</p><p>O que <strong>não</strong> existe aqui é voltar ao cálculo: o cliente já aceitou uma proposta e ela está em transmissão. Trocar de seguradora nesta altura desfaz o aceite — se for mesmo o caso, classifique a perda e recomece.</p>",
        prepare: "em-finalizacao-exemplo",
      },
    ],
    outro: { hook: '"Falta a parte que interessa: quanto disso virou dinheiro."' },
  },

  /* =========== M5 — O QUE VOCÊ GANHA =========== */
  {
    id: 9,
    module: "M5 · O QUE VOCÊ GANHA",
    title: "Extrato de vendas",
    hook: '"Quanto eu já fiz esse mês?"',
    duration: "~4 min",
    steps: [
      {
        page: "extrato",
        target: ".kpi-grid",
        pos: "bottom",
        title: "Seis números que contam o mês",
        body: "<p><strong>Quantidade</strong> e <strong>valor vendido</strong> mostram o volume. <strong>Comissão bruta</strong> é o que você gerou; <strong>estornos</strong>, o que voltou; <strong>líquido a receber</strong> é a conta final — e é esse número que cai na sua mão.</p><p>Por último, a <strong>meta</strong>, com a barra de quanto falta.</p>",
      },
      {
        page: "extrato",
        target: ".extrato-estornos",
        pos: "top",
        title: "Estorno é comissão que volta",
        body: "<p>Cliente que cancela nos primeiros dias ou não paga a primeira parcela faz a comissão ser <strong>descontada de você</strong>. Cada linha aqui traz o motivo.</p>",
        tip: {
          label: "O que dá para evitar",
          text: "Boa parte dos estornos é inadimplência de primeira parcela. Confirmar com o cliente que o boleto chegou, na semana seguinte à emissão, evita muito estorno — e é um retorno que vale agendar em Minha agenda.",
        },
        prepare: "extrato-venda",
      },
      {
        page: "extrato",
        target: ".extrato-table",
        pos: "top",
        title: "Venda por venda",
        body: "<p>A tabela detalha cada apólice: data, número, segurado, seguradora, prêmio, <strong>percentual e valor da sua comissão</strong>, parcelamento e se já foi paga.</p><p>É onde você confere se a comissão que caiu bate com o que era esperado.</p>",
        prepare: "extrato-venda",
      },
      {
        page: "extrato",
        target: ".extrato-filters",
        pos: "bottom",
        title: "Filtrar por período e status",
        body: '<p>Escolha o intervalo de datas, a seguradora, o tipo e o status de pagamento. A pergunta mais comum — <strong>"o que ainda não me pagaram?"</strong> — se responde filtrando por Pendentes.</p>',
      },
    ],
    outro: { hook: '"Última parada: falar com o cliente sem travar."' },
  },

  {
    id: 10,
    module: "M5 · O QUE VOCÊ GANHA",
    title: "Mensagens prontas",
    hook: '"O que eu escrevo pra ele?"',
    duration: "~2 min",
    steps: [
      {
        page: "msgs",
        target: null,
        pos: "center",
        title: "Textos aprovados, já preenchidos",
        body: "<p>São modelos oficiais da Supper, com <strong>nome do cliente, veículo, valor e o seu nome</strong> já dentro do texto. Você copia, ajusta uma frase e manda.</p><p>Não é preguiça: é o que garante que todo cliente ouça a mesma coisa, com a mesma qualidade, no mesmo dia da jornada.</p>",
      },
      {
        page: "msgs",
        target: ".msg-cat-bar",
        pos: "bottom",
        title: "Organizadas pelo momento da conversa",
        body: "<p><strong>Primeiro contato</strong>, <strong>Follow-up</strong>, <strong>Lead recebido</strong>, <strong>Pós-cotação</strong>, <strong>Documentos</strong> e <strong>Reativação</strong>. Você não escolhe pelo texto: escolhe pelo momento em que o cliente está.</p>",
      },
      {
        page: "msgs",
        target: ".msg-card",
        pos: "right",
        title: "Copiar ou abrir no WhatsApp",
        body: "<p>Cada card mostra o objetivo da mensagem e o texto inteiro. O botão verde <strong>abre a conversa com o texto já colado</strong>.</p>",
        tip: {
          label: "A cadência importa",
          text: "As mensagens estão numeradas por dia — Dia 1, Dia 3, Dia 7. Seguir a sequência converte mais do que insistir na mesma abordagem.",
        },
      },
    ],
    outro: {
      hook: '"É isso. Lead que chega, cotação que sai, proposta que transmite e comissão que cai — você já sabe o caminho inteiro. Volte a qualquer capítulo quando precisar."',
      big: true,
      final: true,
    },
  },
] satisfies TutorialSourceChapter[];
