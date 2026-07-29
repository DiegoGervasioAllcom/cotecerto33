import type { TutorialChapter, TutorialKind, TutorialStep } from "./tutorial-types";

export type TutorialPage =
  | "home"
  | "atender"
  | "pipeline"
  | "lead"
  | "compare"
  | "proposal"
  | "aceite"
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
  atender: "/venda/atender",
  pipeline: "/venda/pipeline",
  lead: "/venda/novo-lead",
  compare: "/venda/cotacoes",
  proposal: "/venda/propostas",
  aceite: "/venda/aceite",
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
  ".topbar .search": '[data-tour="shell-search"]',
  "#btnNovoLead": '[data-tour="nav-novo-lead"]',
  "#sideUser": '[data-tour="shell-user"]',
  "#reactPill": '[data-tour="shell-react-pill"]',
};

const PAGE_TARGETS: Partial<Record<TutorialPage, Record<string, string>>> = {
  home: {
    "#meuFunilCard": '[data-tour="home-funil"]',
    "#trendChart": '[data-tour="home-tendencia"]',
  },
  lead: {
    "#stepperBar": ".stepper",
    "#fldCpf": '.wizard-grid input[placeholder="000.000.000-00"]',
    "#fldCep": '.wizard-grid input[placeholder="00000-000"]',
    "#fldPlaca": '.wizard-grid input[placeholder="AAA-0A00"]',
    "#foldComp": ".wizard-card .fold:nth-of-type(1)",
    "#foldVeic": ".wizard-card .fold:nth-of-type(2)",
    "#advCotacao": ".wizard-card .fold",
    "#resumoCard": ".resumo",
    "#btnHistorico": '[data-tour="lead-historico"]',
    "#btnClassificarPerda": '[data-tour="lead-perda"]',
  },
  compare: {
    "#btnCompareMais": '[data-tour="comparar-mais"]',
  },
  proposal: {
    ".prop-section:nth-child(2)": '[data-tour="proposta-versao"]',
    ".payment-grid": '[data-tour="proposta-pagamento"]',
    ".prop-section:nth-child(5)": '[data-tour="proposta-nota"]',
    ".prop-card .row:last-child .btn-yellow": '[data-tour="proposta-enviar"]',
  },
  aceite: {
    ".timeline": '[data-tour="aceite-timeline"]',
    ".confer-grid": '[data-tour="aceite-conferencia"]',
    ".confer-check": '[data-tour="aceite-checkbox"]',
    "#btnTransmit": '[data-tour="aceite-transmitir"]',
    ".confer-card": '[data-tour="aceite-pendencia"]',
  },
  extrato: {
    "#page-extrato .kpi-grid": ".kpi-grid",
    "#page-extrato .extrato-filters": '[data-tour="extrato-filtros"]',
    "#page-extrato .extrato-table-card .table-pipe tbody tr:first-child":
      '[data-tour="extrato-venda-exemplo"]',
    "#page-extrato .extrato-estornos": '[data-tour="extrato-estornos"]',
    "#page-extrato .extrato-campanha": '[data-tour="extrato-campanha"]',
    "#page-extrato .extrato-pagamentos": '[data-tour="extrato-pagamentos"]',
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
  if (page === "compare") return "cotacao-comparativo";
  if (page === "proposal") return "proposta-selecionada";
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
