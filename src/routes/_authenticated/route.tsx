import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  // O Supabase guarda a sessão no localStorage; SSR não tem acesso.
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { loading, session, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    if (profile?.status === "pendente") {
      navigate({ to: "/auth/pendente", replace: true });
      return;
    }
    if (profile && profile.status !== "aprovada") {
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, session, profile, navigate]);

  if (loading || !session) {
    return (
      <div className="auth-stage">
        <div className="auth-bg" />
        <p style={{ color: "#fff" }}>Carregando…</p>
      </div>
    );
  }

  if (profile && profile.status !== "aprovada") {
    return null;
  }

  return <Outlet />;
}
