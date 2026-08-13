import { type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home,
  PlayCircle,
  GitBranch,
  UserPlus,
  FileText,
  Send,
  CheckSquare,
  ClipboardCheck,
  Receipt,
  MessageSquare,
  LayoutDashboard,
  Users,
  Share2,
  Building2,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Trophy,
  RotateCcw,
  RefreshCw,
  BarChart3,
  Mail,
  KeyRound,
  Settings,
  Briefcase,
  Activity,
  AlertTriangle,
  Search,
  HelpCircle,
} from "lucide-react";
import logoUrl from "@/assets/cotecerto-logo.png";
import { useAuth } from "@/lib/auth";
import { usePresence } from "@/lib/use-presence";
import { useGroupScope } from "@/lib/group-scope";
import { useNavBadges } from "@/lib/nav-badges";
import { useAreas, ehPerfilInterno, type AreaChave } from "@/lib/use-areas";
import { resolveNavExperiencia, ehAreaDaFull } from "@/lib/nav-experience";
import type { Perfil } from "@/integrations/supabase/client";
import { SidebarUserMenu, useAccessibilityPrefs } from "@/components/user-menu";
import {
  TUTORIAL_TRIGGER_ID,
  useTutorialController,
} from "@/components/tutorial/tutorial-controller-context";
import { resolveTutorialPersona } from "@/components/tutorial/tutorial-persona";

type Item = {
  to: string;
  label: string;
  icon: typeof Home;
  soon?: boolean;
  /**
   * Área que libera este item para o time interno (V11 · H7). Itens sem `area`
   * não passam pelo recorte — é o caso das navs de venda e de grupo, que são
   * por perfil, não por cargo.
   */
  area?: AreaChave;
};

type Group = {
  label: string;
  items: Item[];
};

/** Vendedor e Franquia Individual — 9 itens (nav de venda). */
const VENDA_GROUP: Group = {
  label: "VENDA",
  items: [
    { to: "/inicio", label: "Início", icon: Home },
    { to: "/venda/atender", label: "Atender agora", icon: PlayCircle },
    { to: "/venda/pipeline", label: "Pipeline", icon: GitBranch },
    { to: "/venda/novo-lead", label: "Lead Manual", icon: UserPlus },
    { to: "/venda/cotacoes", label: "Cotações", icon: FileText },
    { to: "/venda/propostas", label: "Propostas", icon: Send },
    { to: "/venda/aceite", label: "Aceite & transmissão", icon: CheckSquare },
    { to: "/venda/extrato", label: "Extrato de vendas", icon: Receipt },
    { to: "/venda/mensagens-prontas", label: "Mensagens prontas", icon: MessageSquare },
  ],
};

/**
 * Time interno da Matriz — as 17 áreas do V11 (`MATRIZ_AREAS` do protótipo r40),
 * na mesma ordem do menu dele. Quem vê o quê sai do cargo, não do perfil: cada
 * item declara sua `area` e o recorte acontece em `INTERNO_GROUPS`.
 *
 * Assim a Matriz continua com as 17, o Coordenador recebe as mesmas 17 (preset
 * `coord_com`), o Supervisor de Vendas 10, o Operacional 4, e um cargo criado na
 * tela de Configurações aparece sem tocar neste arquivo.
 */
const MATRIZ_COMANDO_GROUP: Group = {
  label: "COMANDO",
  items: [
    { to: "/comando/visao-geral", label: "Visão geral", icon: LayoutDashboard, area: "mdash" },
    { to: "/comando/leads", label: "Leads", icon: Users, area: "mleads" },
    { to: "/comando/distribuicao", label: "Distribuição", icon: Share2, area: "mdist" },
  ],
};

const MATRIZ_OPERACAO_GROUP: Group = {
  label: "OPERAÇÃO",
  items: [
    { to: "/operacao/aprovacoes", label: "Aprovações", icon: ClipboardCheck, area: "maprov" },
    { to: "/operacao/franquias", label: "Franquias", icon: Building2, area: "mfranq" },
    { to: "/operacao/vendedores", label: "Vendedores", icon: Briefcase, area: "mvend" },
    { to: "/operacao/supervisao", label: "Supervisão", icon: ShieldCheck, area: "msuperv" },
    { to: "/operacao/pipeline-geral", label: "Pipeline geral", icon: GitBranch, area: "mpipe" },
    { to: "/operacao/vendas", label: "Vendas", icon: TrendingUp, area: "mvendas" },
    { to: "/operacao/comissoes", label: "Comissões", icon: DollarSign, area: "mcomm" },
    { to: "/operacao/premiacoes", label: "Premiações", icon: Trophy, area: "mprem" },
    { to: "/operacao/estornos", label: "Estornos", icon: RotateCcw, area: "mestorno" },
    { to: "/operacao/renovacoes", label: "Renovações", icon: RefreshCw, area: "mren" },
    { to: "/operacao/relatorios", label: "Relatórios", icon: BarChart3, area: "mrel" },
    { to: "/operacao/mensagens", label: "Mensagens", icon: Mail, area: "mmsgs" },
    { to: "/operacao/acessos", label: "Acessos e permissões", icon: KeyRound, area: "macessos" },
    { to: "/operacao/configuracoes", label: "Configurações", icon: Settings, area: "mconf" },
  ],
};

/** Recorta os grupos internos pelas áreas do usuário, descartando grupo vazio. */
function recortarPorArea(groups: Group[], temArea: (a: AreaChave) => boolean): Group[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.area || temArea(i.area)) }))
    .filter((g) => g.items.length > 0);
}

/**
 * Rotas que a Matriz usa nas 17 áreas mas que, pra Franquia Full, já têm um
 * equivalente próprio construído em outra frente — a Full não acessa a tela
 * da Matriz (RLS/escopo diferente), usa a versão que já existe pra ela.
 * Só `macessos` hoje: a Matriz classifica cadastros da rede inteira em
 * `/operacao/acessos` (exclusivo dela); a Full acompanha o próprio time em
 * `/operacao/xacessos` — a mesma tela que Master já usa em `GRUPO_GROUP`.
 */
const FULL_ROTA_OVERRIDE: Partial<Record<AreaChave, string>> = {
  macessos: "/operacao/xacessos",
};

/**
 * Franquia Full — espelho da Matriz com 14 áreas (V11.5.2a abriu com 15;
 * V11.5.2b tirou `mmsgs` — ver abaixo). A exclusão em si (regra 8 das Regras
 * Decididas: só Franquias e Configurações globais ficam de fora, + Mensagens
 * por decisão desta task) mora em `ehAreaDaFull` (`nav-experience.ts`),
 * testável isolada.
 *
 * Reaproveita label/ícone/rota das listas da Matriz acima (mesma fonte, sem
 * duplicar) via `FULL_ROTA_OVERRIDE` para a única que precisa de tela
 * própria. Full NÃO passa pelo recorte de cargo (`temArea`/
 * `fn_areas_do_usuario` são exclusivos do time interno, ver docstring de
 * `useAreas`) — ganha o conjunto inteiro de uma vez, sem override por pessoa.
 *
 * V11.5.2b resolveu o gap apontado por V11.5.2a: `/comando/leads` e
 * `/comando/distribuicao` trocaram `useRequireRole("matriz")` por
 * `useRequireMatrizOuFranquiaFull()` (`require-role.tsx`) — a Full abre as
 * duas sem cair em `/inicio`. Distribuição usa uma visão reduzida pra Full
 * (SLA próprio via `sla_empresa_config`/V11.5.3 + canais próprios), nunca o
 * singleton `distribuicao_config` da Matriz. `/operacao/mensagens` NÃO foi
 * desbloqueada (mistura escopo global/pessoal, fora do recorte "só leads"
 * desta task) — por isso saiu do menu (`mmsgs` em `AREAS_FORA_DA_FULL`) em
 * vez de ficar quebrada no clique.
 */
const FULL_GRUPO_GROUP: Group = {
  label: "GRUPO",
  items: [MATRIZ_COMANDO_GROUP, MATRIZ_OPERACAO_GROUP]
    .flatMap((g) => g.items)
    .filter((i) => !i.area || ehAreaDaFull(i.area))
    .map((i) => {
      const override = i.area && FULL_ROTA_OVERRIDE[i.area];
      return override ? { ...i, to: override } : i;
    }),
};

/**
 * Master — 12 itens (área de grupo). O escopo dos dados é resolvido pelo RLS
 * (`empresas_visiveis` multinível) + `useGroupScope()`.
 *
 * Supervisor saiu daqui no H7 (virou time interno, menu por cargo). Franquia
 * Full sai daqui em V11.5.2a — ganha `FULL_GRUPO_GROUP`, o espelho de 14
 * áreas da Matriz (V11.5.2b), em vez do menu de 12 do Master.
 */
const GRUPO_GROUP: Group = {
  label: "GRUPO",
  items: [
    { to: "/comando/visao-geral", label: "Visão geral", icon: LayoutDashboard },
    { to: "/operacao/aprovacoes", label: "Aprovações", icon: ClipboardCheck },
    { to: "/operacao/vendedores", label: "Vendedores", icon: Briefcase },
    { to: "/operacao/supervisao", label: "Supervisão", icon: ShieldCheck },
    { to: "/operacao/pipeline-geral", label: "Pipeline geral", icon: GitBranch },
    { to: "/operacao/vendas", label: "Vendas", icon: TrendingUp },
    { to: "/operacao/comissoes", label: "Comissões", icon: DollarSign },
    { to: "/operacao/premiacoes", label: "Premiações", icon: Trophy },
    { to: "/operacao/estornos", label: "Estornos", icon: RotateCcw },
    { to: "/operacao/renovacoes", label: "Renovações", icon: RefreshCw },
    { to: "/operacao/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/operacao/xacessos", label: "Acessos", icon: KeyRound },
  ],
};

/**
 * Selo da marca (SUPPER · <selo>). Para o time interno o rótulo vem do CARGO,
 * não daqui: vários cargos moram no mesmo perfil (Assistente Comercial e
 * Marketing são `interno`; os três supervisores são `supervisor`), então o perfil
 * não distingue. Estes valores são o fallback de quem não tem cargo.
 */
const BRAND_LABEL: Record<Perfil, string> = {
  matriz: "MATRIZ",
  coordenador: "COORDENAÇÃO",
  interno: "MATRIZ",
  master: "MASTER",
  supervisor: "SUPERVISOR",
  franqueado: "FRANQUEADO",
  vendedor: "VENDEDOR",
};

export function AppShell({
  title,
  crumbs,
  children,
}: {
  title: string;
  crumbs?: string;
  children: ReactNode;
}) {
  const { role, profile, empresa, session, signOut } = useAuth();
  const { isGroupView, isFranqIndividual, isFranqFull, loading: scopeLoading } = useGroupScope();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isOpen: tutorialOpen, openTutorial } = useTutorialController();
  usePresence();
  useAccessibilityPrefs();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  // 3 experiências de navegação (ver docs/MAPA_PROTOTIPO_PERFIS.md §2-3 e
  // `resolveNavExperiencia`): venLike = vendedor + franquia Individual ·
  // fullLike = franquia Full (V11.5.2a) · grpLike = master/supervisor ·
  // interno = matriz/coordenador/supervisor, recortado por ÁREA (V11 · H7).
  // Só o franqueado depende da query de modelo (Individual/Full); enquanto ela
  // carrega, não computamos a experiência para não "piscar" a nav errada.
  const franqPend = role === "franqueado" && scopeLoading;
  const { venLike, fullLike, grpLike } = resolveNavExperiencia({
    role,
    isFranqIndividual,
    isFranqFull,
    isGroupView,
    franqPend,
  });
  const isMatriz = role === "matriz";
  const ehInterno = ehPerfilInterno(role);

  const { temArea, cargoNome, loading: areasLoading } = useAreas();

  const { leadsPendentes, aprovacoesPendentes, leadMaisAntigoElapsed } = useNavBadges({
    isMatriz,
    verLeads: temArea("mleads"),
    verAprovacoes: temArea("maprov") || grpLike || fullLike,
  });
  // Interno só entra depois das áreas carregarem — senão a nav pisca vazia (ou
  // completa) antes do recorte do cargo chegar.
  const visibleGroups: Group[] = [
    ...(ehInterno && !areasLoading
      ? recortarPorArea([MATRIZ_COMANDO_GROUP, MATRIZ_OPERACAO_GROUP], temArea)
      : []),
    ...(venLike ? [VENDA_GROUP] : []),
    ...(fullLike ? [FULL_GRUPO_GROUP] : []),
    ...(grpLike ? [GRUPO_GROUP] : []),
  ];

  // Time interno se identifica pelo cargo (como no protótipo); os demais, pelo
  // perfil. Sem cargo definido, cai no rótulo do perfil.
  const brandLabel =
    ehInterno && cargoNome ? cargoNome.toUpperCase() : role ? BRAND_LABEL[role] : "";
  const tutorialPersona = resolveTutorialPersona({
    role,
    profile,
    empresa,
    isGroupView,
    isFranqIndividual,
    scopeLoading,
  });

  return (
    <div className="app">
      <aside className="sidebar" data-tour="shell-sidebar">
        <div className="brand">
          <img src={logoUrl} alt="CoteCerto" className="logo-img" />
          <div className="sublabel">SUPPER · {brandLabel}</div>
        </div>
        <div className="nav-group">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                const badgeCount =
                  item.to === "/comando/leads"
                    ? leadsPendentes
                    : item.to === "/operacao/aprovacoes"
                      ? aprovacoesPendentes
                      : null;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`nav-item${active ? " active" : ""}`}
                    data-tour={
                      item.to === "/venda/atender"
                        ? "nav-atender"
                        : item.to === "/venda/novo-lead"
                          ? "nav-novo-lead"
                          : undefined
                    }
                  >
                    <Icon className="ic" />
                    <span>{item.label}</span>
                    {item.soon && <span className="soon-tag">EM FORMULAÇÃO</span>}
                    {!!badgeCount && badgeCount > 0 && <span className="badge">{badgeCount}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div className="sidebar-foot" data-tour="shell-user">
          <SidebarUserMenu
            profile={profile}
            empresa={empresa}
            role={role}
            brandLabel={brandLabel}
            isFranqIndividual={isFranqIndividual}
            onSignOut={handleSignOut}
          />
          <div style={{ marginTop: 8 }}>CoteCerto 3.3</div>
        </div>
      </aside>

      <main className="main">
        {/* V11 · Lead Manual — origem virou modal (ModalShell, z-index 70 no
            proto.css) mas continua sendo a própria página de /venda/novo-lead
            sem ?id= — não um modal aberto por cima de outra página. O botão
            Tutorial precisa ficar clicável mesmo com esse "gate" aberto (é
            assim que o tour reabre a demonstração depois de um passo que
            passa por lá), então a topbar precisa ficar acima do backdrop do
            modal aqui. */}
        <div className="topbar" style={{ position: "sticky", zIndex: 71 }}>
          <div className="page-title">
            {crumbs && <div className="crumbs">{crumbs}</div>}
            <h1>{title}</h1>
          </div>
          <div className="search" data-tour="shell-search">
            <Search className="si" />
            <input
              type="text"
              placeholder={
                venLike
                  ? "Buscar cliente, placa, nº de cotação..."
                  : "Buscar lead, vendedor, apólice..."
              }
            />
          </div>
          {isMatriz && !!leadsPendentes && leadsPendentes > 0 && (
            <button
              type="button"
              className="react-pill"
              data-tour="shell-react-pill"
              onClick={() => navigate({ to: "/comando/leads" })}
            >
              <Share2 style={{ width: 15, height: 15 }} />
              <span>Distribuir agora</span>
              <span className="rp-count">{leadsPendentes}</span>
              {leadMaisAntigoElapsed && <span className="rp-time">{leadMaisAntigoElapsed}</span>}
            </button>
          )}
          {tutorialPersona && (
            <button
              id={TUTORIAL_TRIGGER_ID}
              type="button"
              className="btn btn-yellow"
              aria-haspopup="dialog"
              aria-expanded={tutorialOpen}
              onClick={() => {
                if (session?.user.id) {
                  openTutorial({ persona: tutorialPersona, userId: session.user.id });
                }
              }}
            >
              <HelpCircle style={{ width: 15, height: 15 }} />
              <span>Tutorial</span>
            </button>
          )}
        </div>
        <div className="page active" data-tour="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PagePlaceholder({ description }: { description?: string }) {
  return (
    <div className="card">
      <div className="card-b" style={{ padding: "48px 32px", textAlign: "center" }}>
        <Activity
          style={{ width: 38, height: 38, color: "var(--yellow)", margin: "0 auto 12px" }}
        />
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "var(--slate)",
          }}
        >
          Tela em construção
        </h3>
        <p
          style={{
            marginTop: 8,
            color: "var(--muted)",
            fontSize: 13,
            maxWidth: 480,
            marginInline: "auto",
          }}
        >
          {description ??
            "Este módulo será implementado em uma das próximas iterações. A navegação e visibilidade por perfil já estão ativas."}
        </p>
      </div>
    </div>
  );
}
