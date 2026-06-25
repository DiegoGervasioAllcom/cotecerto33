import { type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Home, PlayCircle, GitBranch, UserPlus, FileText, Send, CheckSquare, Receipt, MessageSquare,
  LayoutDashboard, Users, Share2, Building2, ShieldCheck, TrendingUp, DollarSign, Trophy,
  RotateCcw, RefreshCw, BarChart3, Mail, KeyRound, Settings, LogOut, Briefcase, Activity, AlertTriangle,
} from "lucide-react";
import logoAsset from "@/assets/cotecerto-logo.png.asset.json";
import { useAuth } from "@/lib/auth";
import type { Perfil } from "@/integrations/supabase/client";

type Item = {
  to: string;
  label: string;
  icon: typeof Home;
  roles?: Perfil[];
  soon?: boolean;
};

type Group = {
  label: string;
  roles?: Perfil[];
  items: Item[];
};

const GROUPS: Group[] = [
  {
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
  },
  {
    label: "COMANDO",
    roles: ["master", "matriz"],
    items: [
      { to: "/comando/visao-geral", label: "Visão geral", icon: LayoutDashboard },
      { to: "/comando/leads", label: "Leads", icon: Users },
      { to: "/comando/distribuicao", label: "Distribuição", icon: Share2 },
    ],
  },
  {
    label: "OPERAÇÃO",
    roles: ["matriz"],
    items: [
      { to: "/operacao/franquias", label: "Franquias", icon: Building2 },
      { to: "/operacao/vendedores", label: "Vendedores", icon: Briefcase },
      { to: "/operacao/supervisao", label: "Supervisão", icon: ShieldCheck },
      { to: "/operacao/pipeline-geral", label: "Pipeline geral", icon: GitBranch },
      { to: "/operacao/vendas", label: "Vendas", icon: TrendingUp },
      { to: "/operacao/comissoes", label: "Comissões", icon: DollarSign, soon: true },
      { to: "/operacao/premiacoes", label: "Premiações", icon: Trophy },
      { to: "/operacao/estornos", label: "Estornos", icon: RotateCcw },
      { to: "/operacao/renovacoes", label: "Renovações", icon: RefreshCw },
      { to: "/operacao/relatorios", label: "Relatórios", icon: BarChart3 },
      { to: "/operacao/mensagens", label: "Mensagens", icon: Mail },
      { to: "/operacao/acessos", label: "Acessos e permissões", icon: KeyRound },
      { to: "/operacao/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

function canSee(role: Perfil | null, roles?: Perfil[]) {
  if (!roles || roles.length === 0) return true;
  if (!role) return false;
  return roles.includes(role);
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export function AppShell({
  title,
  crumbs,
  children,
}: {
  title: string;
  crumbs?: string;
  children: ReactNode;
}) {
  const { role, profile, empresa, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src={logoAsset.url} alt="CoteCerto" className="logo-img" />
          <div className="sublabel">FRANQUIA</div>
        </div>
        <div className="nav-group">
          {GROUPS.filter((g) => canSee(role, g.roles)).map((group) => (
            <div key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.filter((i) => canSee(role, i.roles)).map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`nav-item${active ? " active" : ""}`}
                  >
                    <Icon className="ic" />
                    <span>{item.label}</span>
                    {item.soon && <span className="soon-tag">EM FORMULAÇÃO</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div className="sidebar-foot">CoteCerto 3.3</div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="page-title">
            {crumbs && <div className="crumbs">{crumbs}</div>}
            <h1>{title}</h1>
          </div>
          <button
            type="button"
            className="user-cluster"
            onClick={handleSignOut}
            title="Sair"
          >
            <div className="user-info">
              <div className="nm">{profile?.nome ?? "Usuário"}</div>
              <div className="co">
                {empresa?.nome ?? "—"} · {role ? role.toUpperCase() : ""}
              </div>
            </div>
            <div className="avatar">{initials(profile?.nome)}</div>
            <LogOut className="ic" style={{ width: 16, height: 16, color: "var(--muted)" }} />
          </button>
        </div>
        <div className="page active">{children}</div>
      </main>
    </div>
  );
}

export function PagePlaceholder({
  description,
}: {
  description?: string;
}) {
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
