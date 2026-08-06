import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useGroupScope } from "@/lib/group-scope";
import { resolverLanding } from "@/lib/landing";

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
  const destino = resolverLanding({ role, isGroupView, groupLoading });
  return destino ? <Navigate to={destino} /> : null;
}
