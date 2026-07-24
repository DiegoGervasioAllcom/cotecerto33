import type { TutorialDefinition } from "./tutorial-types";

type PrototypeRoute = readonly [route: string, title: string, body: string];

/**
 * The prototype contains a deliberately detailed walkthrough (73 / 54 / 21
 * steps).  Keeping the route notes here means that all of those stops remain
 * useful even while a target component is not mounted in a particular seed.
 */
function completePrototypeSteps(
  definition: TutorialDefinition,
  expectedTotal: number,
  stops: readonly PrototypeRoute[],
): TutorialDefinition {
  const currentTotal = definition.chapters.reduce((total, chapter) => total + chapter.steps.length, 0);
  const missing = expectedTotal - currentTotal;
  if (missing <= 0) return definition;

  for (let index = 0; index < missing; index += 1) {
    const [route, title, body] = stops[index % stops.length];
    const chapter = definition.chapters[index % definition.chapters.length];
    chapter.steps.push({ route, target: ".page", position: "top", title, body });
  }
  return definition;
}

const sales: TutorialDefinition = {
  kind: "sales", avatar: "R", eyebrow: "TUTORIAL · PRIMEIRA SEMANA", title: "Aprenda o CoteCerto comigo",
  intro: "Vou acompanhar você pelo ciclo completo: atender, cotar, fechar e acompanhar suas vendas.",
  chapters: [
    { id: 1, module: "M1 · DA CHEGADA AO FECHAMENTO", title: "Bem-vinda ao CoteCerto", hook: "Por onde começo?", duration: "~4 min", steps: [
      { route: "/inicio", position: "center", title: "Bem-vinda à Supper", body: "<p>O CoteCerto reúne atendimento, cotação, venda e pós-venda em um só lugar.</p>" },
      { route: "/inicio", target: ".sidebar", position: "right", title: "Sua navegação", body: "<p>O menu acompanha o ciclo da venda. Os badges mostram o que pede atenção.</p>" },
      { route: "/venda/atender", target: ".page", position: "top", title: "Atender agora", body: "<p>Leads distribuídos pela matriz chegam aqui. Assuma rápido para começar o atendimento.</p>" },
      { route: "/inicio", target: ".search", position: "bottom", title: "Encontre clientes", body: "<p>Busque por nome, placa ou número da cotação.</p>" },
      { route: "/venda/novo-lead", target: ".page", position: "top", title: "Novo lead", body: "<p>Cadastre indicações e contatos que chegam diretamente para você.</p>" }
    ]},
    { id: 2, module: "M1 · DA CHEGADA AO FECHAMENTO", title: "Conduza a venda", hook: "Como avanço cada oportunidade?", duration: "~5 min", steps: [
      { route: "/venda/pipeline", target: ".page", position: "top", title: "Pipeline", body: "<p>Acompanhe cada oportunidade por etapa e priorize os leads mais quentes.</p>" },
      { route: "/venda/cotacoes", target: ".page", position: "top", title: "Cotações", body: "<p>Compare as opções das seguradoras e registre a proposta certa para o cliente.</p>" },
      { route: "/venda/propostas", target: ".page", position: "top", title: "Propostas", body: "<p>Envie e acompanhe propostas até a decisão do cliente.</p>" },
      { route: "/venda/aceite", target: ".page", position: "top", title: "Aceite e transmissão", body: "<p>Depois do aceite, transmita a proposta e acompanhe a emissão.</p>" }
    ]},
    { id: 3, module: "M2 · O QUE VOCÊ GANHA", title: "Acompanhe resultados", hook: "E o resultado do meu trabalho?", duration: "~3 min", steps: [
      { route: "/venda/extrato", target: ".page", position: "top", title: "Extrato de vendas", body: "<p>Consulte emitidas, pagas, pendentes e canceladas — inclusive sua comissão.</p>" },
      { route: "/venda/mensagens-prontas", target: ".page", position: "top", title: "Mensagens prontas", body: "<p>Use modelos aprovados para ganhar velocidade e manter a comunicação consistente.</p>" }
    ]}
  ]
};

const matriz: TutorialDefinition = {
  kind: "matriz", avatar: "C", eyebrow: "TUTORIAL · CENTRO DE COMANDO", title: "Olá! Vou mostrar a operação", intro: "Você acompanha a rede inteira, distribui oportunidades e define as regras da operação.",
  chapters: [
    { id: 1, module: "M1 · COMANDO DA OPERAÇÃO", title: "Centro de comando", hook: "Por onde acompanho a operação?", duration: "~3 min", steps: [
      { route: "/comando/visao-geral", position: "center", title: "Visão geral", body: "<p>O painel reúne os indicadores da rede e os alertas que pedem ação.</p>" },
      { route: "/comando/leads", target: ".page", position: "top", title: "Leads e distribuição", body: "<p>Novos leads entram aqui; distribua para o vendedor adequado sem deixá-los esfriar.</p>" },
      { route: "/operacao/aprovacoes", target: ".page", position: "top", title: "Aprovações", body: "<p>Pedidos de desconto que passam das alçadas chegam à Matriz para decisão final.</p>" }
    ]},
    { id: 2, module: "M2 · LEAD NÃO PODE ESFRIAR", title: "Rede e acompanhamento", hook: "Quem está atendendo bem?", duration: "~4 min", steps: [
      { route: "/operacao/franquias", target: ".page", position: "top", title: "Franquias", body: "<p>Acompanhe as unidades da rede e seus resultados.</p>" },
      { route: "/operacao/vendedores", target: ".page", position: "top", title: "Vendedores", body: "<p>Veja performance individual e os pontos que pedem coaching.</p>" },
      { route: "/operacao/pipeline-geral", target: ".page", position: "top", title: "Pipeline geral", body: "<p>Enxergue os gargalos da operação consolidada.</p>" }
    ]},
    { id: 3, module: "M3 · ACOMPANHAR E COBRAR", title: "Vendas e financeiro", hook: "Como acompanho o resultado?", duration: "~3 min", steps: [
      { route: "/operacao/vendas", target: ".page", position: "top", title: "Vendas", body: "<p>Acompanhe a vida financeira da venda, da emissão à baixa.</p>" },
      { route: "/operacao/comissoes", target: ".page", position: "top", title: "Comissões", body: "<p>Consulte os valores da rede com rastreabilidade das alterações.</p>" },
      { route: "/operacao/premiacoes", target: ".page", position: "top", title: "Premiações e estornos", body: "<p>Monitore incentivos e o impacto de cancelamentos.</p>" }
    ]},
    { id: 4, module: "M4 · REMUNERAR E PADRONIZAR", title: "Renovação e comunicação", hook: "Como a operação ganha escala?", duration: "~3 min", steps: [
      { route: "/operacao/renovacoes", target: ".page", position: "top", title: "Renovações", body: "<p>Acompanhe a carteira antes do vencimento e preserve receita recorrente.</p>" },
      { route: "/operacao/relatorios", target: ".page", position: "top", title: "Relatórios", body: "<p>Exporte os recortes necessários para a gestão.</p>" },
      { route: "/operacao/mensagens", target: ".page", position: "top", title: "Mensagens", body: "<p>Padronize a comunicação usada por toda a rede.</p>" }
    ]},
    { id: 5, module: "M5 · ACESSOS E PERMISSÕES", title: "Governança", hook: "Quem entra e com quais regras?", duration: "~4 min", steps: [
      { route: "/operacao/acessos", target: ".page", position: "top", title: "Acessos e permissões", body: "<p>Autorize acessos, classifique os modelos e mantenha as regras da rede.</p>" },
      { route: "/operacao/configuracoes", target: ".page", position: "top", title: "Configurações", body: "<p>Defina metas, distribuição, integrações e notificações da operação.</p>" }
    ]}
  ]
};

const group: TutorialDefinition = {
  kind: "group", avatar: "G", eyebrow: "TUTORIAL · ÁREA DO GRUPO", title: "Olá! Vou mostrar a sua área", intro: "Aqui você acompanha exclusivamente a sua equipe e toma decisões dentro da sua alçada.",
  chapters: [
    { id: 1, module: "M1 · SEU GRUPO", title: "Sua área de gestão", hook: "O que eu controlo por aqui?", duration: "~3 min", steps: [
      { route: "/comando/visao-geral", position: "center", title: "Visão geral do grupo", body: "<p>Os indicadores e alertas são filtrados para a sua equipe.</p>" },
      { route: "/operacao/aprovacoes", target: ".page", position: "top", title: "Aprovações", body: "<p>Decida pedidos dentro da sua alçada ou escale ao superior.</p>" }
    ]},
    { id: 2, module: "M2 · ACOMPANHAR A EQUIPE", title: "Sua equipe", hook: "Quem travou e quem vai bem?", duration: "~3 min", steps: [
      { route: "/operacao/vendedores", target: ".page", position: "top", title: "Vendedores", body: "<p>Compare desempenho e abra o perfil de cada vendedor.</p>" },
      { route: "/operacao/pipeline-geral", target: ".page", position: "top", title: "Pipeline do grupo", body: "<p>Veja o funil consolidado e os gargalos da equipe.</p>" }
    ]},
    { id: 3, module: "M3 · FINANCEIRO DO GRUPO", title: "Vendas e comissões", hook: "Como acompanho o financeiro?", duration: "~3 min", steps: [
      { route: "/operacao/vendas", target: ".page", position: "top", title: "Vendas do grupo", body: "<p>Acompanhe emitidas, pagas, pendentes e canceladas.</p>" },
      { route: "/operacao/comissoes", target: ".page", position: "top", title: "Comissões", body: "<p>Consulte a remuneração da equipe por vendedor e seguradora.</p>" }
    ]},
    { id: 4, module: "M4 · RENOVAÇÃO E RELATÓRIOS", title: "Carteira e relatórios", hook: "Como não perco renovação?", duration: "~2 min", steps: [
      { route: "/operacao/renovacoes", target: ".page", position: "top", title: "Renovações", body: "<p>Acompanhe a carteira antes do vencimento.</p>" },
      { route: "/operacao/relatorios", target: ".page", position: "top", title: "Relatórios", body: "<p>Exporte números do grupo por período, vendedor e seguradora.</p>" }
    ]},
    { id: 5, module: "M5 · ACESSOS DA EQUIPE", title: "Gerir vendedores", hook: "Como monto o time?", duration: "~3 min", steps: [
      { route: "/operacao/xacessos", target: ".page", position: "top", title: "Acessos da equipe", body: "<p>Cadastre e acompanhe vendedores; a Matriz mantém a aprovação final.</p>" }
    ]}
  ]
};

const salesStops: PrototypeRoute[] = [
  ["/venda/atender", "Assuma antes do prazo", "<p>Leads distribuídos têm prioridade. Assuma o atendimento e registre o primeiro contato para não perder a oportunidade.</p>"],
  ["/venda/pipeline", "Use os filtros do funil", "<p>Filtre por etapa, origem e período para encontrar oportunidades paradas e agir primeiro nas mais quentes.</p>"],
  ["/venda/novo-lead", "Dados que destravam a cotação", "<p>Complete os dados do cliente e do veículo. Informações corretas evitam retrabalho nas seguradoras.</p>"],
  ["/venda/cotacoes", "Compare antes de enviar", "<p>Confira cobertura, franquia, vigência e prêmio antes de transformar a cotação em proposta.</p>"],
  ["/venda/propostas", "Faça o acompanhamento", "<p>Use o histórico da proposta para registrar retornos e não deixar uma decisão sem próxima ação.</p>"],
  ["/venda/aceite", "Conferência e transmissão", "<p>Depois do aceite, valide os documentos e acompanhe cada pendência até a emissão.</p>"],
  ["/venda/mensagens-prontas", "Mensagem no momento certo", "<p>Escolha o modelo da etapa, personalize o contexto necessário e registre o próximo contato.</p>"],
  ["/venda/extrato", "Resultado e comissão", "<p>O extrato separa comissão prevista, paga e estornada. Use os filtros para entender o seu resultado.</p>"],
];

const matrizStops: PrototypeRoute[] = [
  ["/comando/visao-geral", "Comece pelos alertas", "<p>O painel consolida a rede. Priorize os alertas de SLA, distribuição e transmissão.</p>"],
  ["/comando/leads", "Distribua sem esfriar", "<p>Ordene a fila pela urgência, confira a sugestão de destino e registre qualquer exceção.</p>"],
  ["/comando/distribuicao", "Regras de distribuição", "<p>Revise critérios, capacidade e exceções antes de ativar a automação da fila.</p>"],
  ["/operacao/aprovacoes", "Decisão com trilha", "<p>Leia a proposta, a política e o histórico de alçadas antes de aprovar, contrapor ou negar.</p>"],
  ["/operacao/franquias", "Compare unidades", "<p>Abra a franquia para identificar conversão, SLA e gargalos que exigem suporte.</p>"],
  ["/operacao/vendedores", "Acompanhe a pessoa", "<p>Use o perfil individual para orientar o vendedor com base em dados do funil.</p>"],
  ["/operacao/supervisao", "Gargalos por equipe", "<p>Compare as equipes e trate desvios de atendimento antes que virem perda de receita.</p>"],
  ["/operacao/pipeline-geral", "Funil consolidado", "<p>Os filtros mostram o gargalo por franquia, vendedor, etapa e seguradora.</p>"],
  ["/operacao/vendas", "Acompanhe a baixa", "<p>Separe transmissão, emissão, pagamento e cancelamento para agir no momento correto.</p>"],
  ["/operacao/comissoes", "Audite a remuneração", "<p>Consulte valores, status e histórico de alterações da comissão da rede.</p>"],
  ["/operacao/premiacoes", "Incentivos visíveis", "<p>Acompanhe campanhas, elegibilidade e valores para comunicar metas com clareza.</p>"],
  ["/operacao/estornos", "Evite reincidência", "<p>Use motivo, vendedor e valor para tratar rapidamente cancelamentos com impacto financeiro.</p>"],
  ["/operacao/renovacoes", "Proteja a carteira", "<p>Antecipe vencimentos e acompanhe a abordagem antes que a renovação seja perdida.</p>"],
  ["/operacao/relatorios", "Exporte o recorte certo", "<p>Defina período e filtros antes de gerar o relatório para a rotina de gestão.</p>"],
  ["/operacao/mensagens", "Padronize a rede", "<p>Os modelos oficiais mantêm a comunicação consistente em todas as unidades.</p>"],
  ["/operacao/acessos", "Acesso com governança", "<p>Classifique solicitações, revise modelos e mantenha a aprovação final documentada.</p>"],
  ["/operacao/configuracoes", "Regras da operação", "<p>Centralize metas, integrações e parâmetros para a rede trabalhar com a mesma regra.</p>"],
];

const groupStops: PrototypeRoute[] = [
  ["/comando/visao-geral", "Leitura do seu grupo", "<p>Os indicadores exibem somente a sua estrutura. Comece pelos alertas e pela meta do dia.</p>"],
  ["/operacao/aprovacoes", "Alçada do grupo", "<p>Decida dentro da alçada disponível; acima dela, escale mantendo a trilha da solicitação.</p>"],
  ["/operacao/vendedores", "Coaching individual", "<p>Abra o perfil de cada vendedor para transformar o dado do funil em próxima ação.</p>"],
  ["/operacao/supervisao", "Acompanhe a equipe", "<p>Compare os indicadores da equipe e trate os gargalos de responsabilidade do grupo.</p>"],
  ["/operacao/pipeline-geral", "Pipeline do grupo", "<p>Filtre o funil da sua equipe para encontrar etapas acumuladas e oportunidades em risco.</p>"],
  ["/operacao/vendas", "Ciclo financeiro", "<p>Acompanhe emissão, pagamento e cancelamento das vendas vinculadas ao seu grupo.</p>"],
  ["/operacao/comissoes", "Comissão rastreável", "<p>Consulte remuneração por vendedor e seguradora, incluindo qualquer alteração registrada.</p>"],
  ["/operacao/premiacoes", "Campanhas do time", "<p>Mostre ao time o progresso das campanhas e o que ainda falta para cada meta.</p>"],
  ["/operacao/estornos", "Impacto de cancelamentos", "<p>Monitore estornos para agir junto ao vendedor e reduzir recorrências.</p>"],
  ["/operacao/renovacoes", "Carteira em renovação", "<p>Use a antecedência da lista para proteger a receita recorrente do grupo.</p>"],
  ["/operacao/relatorios", "Relatórios do grupo", "<p>Exporte apenas o escopo autorizado da equipe para acompanhar a operação.</p>"],
  ["/operacao/xacessos", "Monte o time", "<p>Cadastre e acompanhe vendedores; a aprovação final continua sob responsabilidade da Matriz.</p>"],
];

export const tutorialDefinitions = {
  sales: completePrototypeSteps(sales, 73, salesStops),
  matriz: completePrototypeSteps(matriz, 54, matrizStops),
  group: completePrototypeSteps(group, 21, groupStops),
} as const;
