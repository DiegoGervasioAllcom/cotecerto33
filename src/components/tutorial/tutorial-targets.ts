import type { TutorialChapter, TutorialKind, TutorialStep } from "./tutorial-types";

export type TutorialPage =
  | "home"
  | "agenda"
  | "atender"
  | "pipeline"
  | "lead"
  | "emcotacao"
  | "emnegociacao"
  | "emfinalizacao"
  | "emissao"
  | "msgs"
  | "extrato"
  | "mdash"
  | "maprov"
  | "mleads"
  | "mdist"
  | "mfranq"
  | "mvend"
  | "msuperv"
  | "mpipe"
  | "mvendas"
  | "mcomm"
  | "mren"
  | "mmsgs"
  | "mprem"
  | "mestorno"
  | "mrel"
  | "mconf"
  | "macessos"
  | "xdash"
  | "xacessos";

type TutorialSourceStep = Omit<TutorialStep, "route" | "target" | "position"> & {
  page: TutorialPage;
  target: string | null;
  pos: NonNullable<TutorialStep["position"]>;
};

export type TutorialSourceChapter = Omit<TutorialChapter, "steps"> & {
  steps: TutorialSourceStep[];
};

const ROUTES: Record<TutorialPage, string> = {
  home: "/inicio",
  agenda: "/venda/agenda",
  atender: "/venda/atender",
  pipeline: "/venda/pipeline",
  lead: "/venda/novo-lead",
  emcotacao: "/venda/em-cotacao",
  emnegociacao: "/venda/em-negociacao",
  emfinalizacao: "/venda/em-finalizacao",
  emissao: "/venda/emissao",
  msgs: "/venda/mensagens-prontas",
  extrato: "/venda/extrato",
  mdash: "/comando/visao-geral",
  maprov: "/operacao/aprovacoes",
  mleads: "/comando/leads",
  mdist: "/comando/distribuicao",
  mfranq: "/operacao/franquias",
  mvend: "/operacao/vendedores",
  msuperv: "/operacao/supervisao",
  mpipe: "/operacao/pipeline-geral",
  mvendas: "/operacao/vendas",
  mcomm: "/operacao/comissoes",
  mren: "/operacao/renovacoes",
  mmsgs: "/operacao/mensagens",
  mprem: "/operacao/premiacoes",
  mestorno: "/operacao/estornos",
  mrel: "/operacao/relatorios",
  mconf: "/operacao/configuracoes",
  macessos: "/operacao/acessos",
  xdash: "/comando/visao-geral",
  xacessos: "/operacao/xacessos",
};

const SHARED_TARGETS: Record<string, string> = {
  ".sidebar": '[data-tour="shell-sidebar"]',
  '.nav-item[data-nav="atender"]': '[data-tour="nav-atender"]',
  '.nav-item[data-nav="emnegociacao"]': '[data-tour="nav-em-negociacao"]',
  ".topbar .search": '[data-tour="shell-search"]',
  "#btnNovoLead": '[data-tour="nav-novo-lead"]',
  "#sideUser": '[data-tour="shell-user"]',
  "#reactPill": '[data-tour="shell-react-pill"]',
};

const PAGE_TARGETS: Partial<Record<TutorialPage, Record<string, string>>> = {
  home: {
    "#meuFunilCard": '[data-tour="home-funil"]',
    "#trendChart": '[data-tour="home-tendencia"]',
    ".dia-fila": '[data-tour="home-fila"]',
  },
  agenda: {
    "#btnNovoLembrete": '[data-tour="agenda-novo-lembrete"]',
    ".summary-chips": '[data-tour="agenda-resumo"]',
    ".ag-filtros": '[data-tour="agenda-filtros"]',
    ".ag-item": '[data-tour="agenda-item"]',
    ".ic-btn.ok": '[data-tour="agenda-concluir"]',
  },
  lead: {
    "#stepperBar": ".stepper",
    "#fldCpf": '.wizard-grid input[placeholder="000.000.000-00"]',
    "#fldCep": '.wizard-grid input[placeholder="00000-000"]',
    "#fldPlaca": '.wizard-grid input[placeholder="AAA0A00"]',
    "#foldComp": ".wizard-card .fold:nth-of-type(1)",
    "#foldVeic": ".wizard-card .fold:nth-of-type(2)",
    "#advCotacao": ".wizard-card .fold",
    "#resumoCard": ".resumo",
    ".tipo-item": '[data-tour="seguro-tipo-item"]',
    "#swCond": '[data-tour="perfil-condutor"]',
    "#btnHistorico": '[data-tour="lead-historico"]',
    "#btnClassificarPerda": '[data-tour="lead-perda"]',
    // Etapa 7 (Transmissão) — a Confirmação (`.ff-table`) e o botão
    // "Efetivar proposta" vivem no mesmo `data-tour` do resumo/rodapé real
    // (`TransmissaoConfirmacao.tsx`), tanto no preview do tutorial
    // (`lead-transmissao-confirmacao`) quanto na tela de verdade.
    ".wizard-grid": '[data-tour="transmissao-dados"]',
    ".ff-table": '[data-tour="transmissao-confirmacao"]',
    ".wizard-foot .btn-yellow": '[data-tour="transmissao-efetivar"]',
    ".acc-pills": '[data-tour="transmitida-acoes"]',
  },
  emcotacao: {
    ".table-pipe": '[data-tour="em-cotacao-lista"]',
  },
  emnegociacao: {
    "#page-emnegociacao .card": '[data-tour="em-negociacao-aguardando"]',
    ".fase-acoes": '[data-tour="em-negociacao-fase-acoes"]',
  },
  emfinalizacao: {
    ".fase-acoes": '[data-tour="em-finalizacao-fase-acoes"]',
  },
  emissao: {
    ".table-pipe": '[data-tour="emissao-aguardando"]',
  },
  extrato: {
    "#page-extrato .kpi-grid": ".kpi-grid",
    "#page-extrato .extrato-filters": '[data-tour="extrato-filtros"]',
    "#page-extrato .extrato-table-card .table-pipe tbody tr:first-child":
      '[data-tour="extrato-venda-exemplo"]',
    "#page-extrato .extrato-estornos": '[data-tour="extrato-estornos"]',
    "#page-extrato .extrato-campanha": '[data-tour="extrato-campanha"]',
    "#page-extrato .extrato-pagamentos": '[data-tour="extrato-pagamentos"]',
    ".extrato-filters": '[data-tour="extrato-filtros"]',
    // Primeira ocorrência de `.table-pipe.mtable` na página — o passo usa
    // `prepare: "extrato-venda"` (`ExtratoTutorialSalePreview`, em
    // `extrato-tutorial-preview.tsx`), que desenha essa mesma tabela mesmo
    // sem nenhuma venda real (a tabela de verdade só existe com
    // `rows.length > 0`).
    ".extrato-table": ".table-pipe.mtable",
    ".extrato-estornos": '[data-tour="extrato-estornos"]',
  },
  mfranq: {
    "#page-mfranq .mtable": '[data-tour="franquias-lista"]',
    "#page-mfranq .funnel": '[data-tour="franquia-funil"]',
  },
  mvend: {
    "#page-mvend .mtable": '[data-tour="vendedores-lista"]',
    "#page-mvend .funnel": '[data-tour="vendedor-funil"]',
  },
  mdist: {
    "#mTriagemCard": '[data-tour="distribuicao-triagem"]',
    "#simResult": '[data-tour="distribuicao-simulacao"]',
  },
};

function removePrototypePagePrefix(target: string) {
  return target.replace(/^#page-[\w-]+\s+/, "");
}

function resolveTarget(page: TutorialPage, target: string | null) {
  if (!target) return undefined;
  return (
    PAGE_TARGETS[page]?.[target] ?? SHARED_TARGETS[target] ?? removePrototypePagePrefix(target)
  );
}

function resolveDestination(
  page: TutorialPage,
  target: string | null,
): TutorialStep["destination"] | undefined {
  if (page === "mfranq" && target?.includes(".funnel")) return "franquia-detalhe";
  if (page === "mvend" && target?.includes(".funnel")) return "vendedor-detalhe";
  return undefined;
}

export function defineTutorial(
  kind: TutorialKind,
  sourceChapters: TutorialSourceChapter[],
): { kind: TutorialKind; chapters: TutorialChapter[] } {
  return {
    kind,
    chapters: sourceChapters.map((chapter) => ({
      ...chapter,
      steps: chapter.steps.map(({ page, target, pos, ...step }) => ({
        ...step,
        route: ROUTES[page],
        target: resolveTarget(page, target),
        position: pos,
        destination: resolveDestination(page, target),
      })),
    })),
  };
}
