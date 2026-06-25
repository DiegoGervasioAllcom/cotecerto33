import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, session, profile, role } = useAuth();

  if (loading) {
    return (
      <div className="auth-stage">
        <div className="auth-bg" />
        <p style={{ color: "#fff" }}>Carregando…</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" />;
  if (profile?.status === "pendente") return <Navigate to="/auth/pendente" />;
  if (role === "matriz") return <Navigate to="/comando/visao-geral" />;
  return <Navigate to="/inicio" />;
}
