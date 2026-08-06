import { Navigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { resolverAcessoAreaInterna } from "@/lib/route-access";
import { ehPerfilInterno, useAreas } from "@/lib/use-areas";

function areaLoading() {
  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <p style={{ color: "#fff" }}>Carregando permissões…</p>
    </div>
  );
}

function areaRestrita() {
  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <div className="auth-card">
        <h1>Acesso restrito</h1>
        <p className="muted">
          Seu acesso não possui nenhuma área disponível. Fale com a Matriz para revisar sua
          visualização.
        </p>
      </div>
    </div>
  );
}

/**
 * Guard único das 17 áreas do time interno. Perfis externos não são recortados
 * aqui e continuam obedecendo aos guards e à RLS próprios de cada experiência.
 */
export function useRequireAreaAtual(): ReactNode | null {
  const { loading: authLoading, role } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { loading: areasLoading, areas } = useAreas();

  if (authLoading || !role) return null;
  if (!ehPerfilInterno(role)) return null;

  if (areasLoading) return areaLoading();

  const resolucao = resolverAcessoAreaInterna({ role, pathname, areas });
  if (resolucao.tipo === "permitir") return null;
  if (resolucao.tipo === "redirecionar") return <Navigate to={resolucao.to} replace />;
  return areaRestrita();
}
