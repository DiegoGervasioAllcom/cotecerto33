import { type MouseEvent, type ReactNode, useRef, useState } from "react";
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
import logoAsset from "@/assets/cotecerto-logo.png.asset.json";
import { useAuth } from "@/lib/auth";
import { usePresence } from "@/lib/use-presence";
import { useGroupScope } from "@/lib/group-scope";
import { useNavBadges } from "@/lib/nav-badges";
import type { Perfil } from "@/integrations/supabase/client";
import { SidebarUserMenu, useAccessibilityPrefs } from "@/components/user-menu";
import { TutorialProvider } from "@/components/tutorial/tutorial-provider";
import { resolveTutorialKind } from "@/components/tutorial/tutorial-persona";

type Item = {
  to: string;
  label: string;
  icon: typeof Home;
  soon?: boolean;
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
    { to: "/venda/novo-lead", label: "Novo lead", icon: UserPlus },
    { to: "/venda/cotacoes", label: "Cotações", icon: FileText },
    { to: "/venda/propostas", label: "Propostas", icon: Send },
    { to: "/venda/aceite", label: "Aceite & transmissão", icon: CheckSquare },
    { to: "/venda/extrato", label: "Extrato de vendas", icon: Receipt },
    { to: "/venda/mensagens-prontas", label: "Mensagens prontas", icon: MessageSquare },
  ],
};

/** Matriz — 16 itens (COMANDO 3 + OPERAÇÃO 13). */
const MATRIZ_COMANDO_GROUP: Group = {
  label: "COMANDO",
  items: [
    { to: "/comando/visao-geral", label: "Visão geral", icon: LayoutDashboard },
    { to: "/comando/leads", label: "Leads", icon: Users },
    { to: "/comando/distribuicao", label: "Distribuição", icon: Share2 },
  ],
};

const MATRIZ_OPERACAO_GROUP: Group = {
  label: "OPERAÇÃO",
  items: [
    { to: "/operacao/aprovacoes", label: "Aprovações", icon: ClipboardCheck },
    { to: "/operacao/franquias", label: "Franquias", icon: Building2 },
    { to: "/operacao/vendedores", label: "Vendedores", icon: Briefcase },
    { to: "/operacao/supervisao", label: "Supervisão", icon: ShieldCheck },
    { to: "/operacao/pipeline-geral", label: "Pipeline geral", icon: GitBranch },
    { to: "/operacao/vendas", label: "Vendas", icon: TrendingUp },
    { to: "/operacao/comissoes", label: "Comissões", icon: DollarSign },
    { to: "/operacao/premiacoes", label: "Premiações", icon: Trophy },
    { to: "/operacao/estornos", label: "Estornos", icon: RotateCcw },
    { to: "/operacao/renovacoes", label: "Renovações", icon: RefreshCw },
    { to: "/operacao/relatorios", label: "Relatórios", icon: BarChart3 },
    { to: "/operacao/mensagens", label: "Mensagens", icon: Mail },
    { to: "/operacao/acessos", label: "Acessos e permissões", icon: KeyRound },
    { to: "/operacao/configuracoes", label: "Configurações", icon: Settings },
  ],
};

/**
 * Master / Supervisor / Franquia Full — 12 itens (área de grupo).
 * As telas são as mesmas para os 3 perfis; o escopo dos dados é resolvido
 * pelo RLS (`empresas_visiveis` multinível) + `useGroupScope()`.
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

/** Selo da marca por perfil (SUPPER · <selo>). */
const BRAND_LABEL: Record<Perfil, string> = {
  matriz: "MATRIZ",
  master: "MASTER",
  supervisor: "SUPERVISOR",
  franqueado: "FRANQUEADO",
  vendedor: "CORRETOR",
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
  const { isGroupView, isFranqIndividual, loading: scopeLoading } = useGroupScope();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  usePresence();
  useAccessibilityPrefs();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  // 3 experiências de navegação (ver docs/MAPA_PROTOTIPO_PERFIS.md §2-3):
  // venLike = vendedor + franquia Individual · grpLike = master/supervisor/franquia Full · matriz.
  // Só o franqueado depende da query de modelo (Individual/Full); enquanto ela
  // carrega, não computamos a experiência para não "piscar" a nav errada.
  const franqPend = role === "franqueado" && scopeLoading;
  const venLike =
    !franqPend && (role === "vendedor" || (role === "franqueado" && isFranqIndividual));
  const grpLike = !franqPend && isGroupView;
  const isMatriz = role === "matriz";

  const { leadsPendentes, aprovacoesPendentes, leadMaisAntigoElapsed } = useNavBadges({
    isMatriz,
    grpLike,
  });
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tutorialTriggerRef = useRef<HTMLElement | null>(null);

  const openTutorial = (event: MouseEvent<HTMLButtonElement>) => {
    tutorialTriggerRef.current = event.currentTarget;
    setTutorialOpen(true);
  };

  const visibleGroups: Group[] = [
    ...(isMatriz ? [MATRIZ_COMANDO_GROUP, MATRIZ_OPERACAO_GROUP] : []),
    ...(venLike ? [VENDA_GROUP] : []),
    ...(grpLike ? [GRUPO_GROUP] : []),
  ];

  const brandLabel = role ? BRAND_LABEL[role] : "";
  const tutorialKind = resolveTutorialKind({
    role,
    isGroupView,
    isFranqIndividual,
    scopeLoading,
  });

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src={logoAsset.url} alt="CoteCerto" className="logo-img" />
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
                  <Link key={item.to} to={item.to} className={`nav-item${active ? " active" : ""}`}>
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
        <div className="sidebar-foot">
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
        <div className="topbar">
          <div className="page-title">
            {crumbs && <div className="crumbs">{crumbs}</div>}
            <h1>{title}</h1>
          </div>
          <div className="search">
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
              onClick={() => navigate({ to: "/comando/leads" })}
            >
              <Share2 style={{ width: 15, height: 15 }} />
              <span>Distribuir agora</span>
              <span className="rp-count">{leadsPendentes}</span>
              {leadMaisAntigoElapsed && <span className="rp-time">{leadMaisAntigoElapsed}</span>}
            </button>
          )}
          {tutorialKind && (
            <button type="button" className="btn btn-yellow" onClick={openTutorial}>
              <HelpCircle style={{ width: 15, height: 15 }} />
              <span>Tutorial</span>
            </button>
          )}
        </div>
        <div className="page active">{children}</div>
      </main>

      {tutorialOpen && tutorialKind && session?.user.id && (
        <TutorialProvider
          kind={tutorialKind}
          userId={session.user.id}
          returnFocusElement={tutorialTriggerRef.current}
          onClose={() => setTutorialOpen(false)}
        />
      )}
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
