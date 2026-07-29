import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useGroupScope } from "@/lib/group-scope";
import { ehPerfilInterno } from "@/lib/use-areas";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, session, profile, role } = useAuth();
  const { loading: groupLoading, isGroupView } = useGroupScope();

  if (loading || (session && groupLoading)) {
    return (
      <div className="auth-stage">
        <div className="auth-bg" />
        <p style={{ color: "#fff" }}>Carregando…</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" />;
  if (profile?.status === "pendente") return <Navigate to="/auth/pendente" />;
  // Matriz, Coordenador, Master, Supervisor e Franquia Full caem na visão de
  // comando; Vendedor e Franquia Individual caem em /inicio (mesma lógica de
  // useGroupScope/isGroupView usada na navegação lateral).
  if (ehPerfilInterno(role) || isGroupView) {
    return <Navigate to="/comando/visao-geral" />;
  }
  return <Navigate to="/inicio" />;
}
