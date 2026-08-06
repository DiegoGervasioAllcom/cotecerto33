import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { TutorialControllerProvider } from "@/components/tutorial/tutorial-controller";
import { getProfileAccessState, useAuth } from "@/lib/auth";
import { useRequireAreaAtual } from "@/lib/require-area";

export const Route = createFileRoute("/_authenticated")({
  // O Supabase guarda a sessão no localStorage; SSR não tem acesso.
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { loading, session, profile } = useAuth();
  const areaGuard = useRequireAreaAtual();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    const profileAccess = getProfileAccessState(profile);
    if (profileAccess === "pending") {
      navigate({ to: "/auth/pendente", replace: true });
      return;
    }
    if (profileAccess !== "active") {
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

  if (getProfileAccessState(profile) !== "active") {
    return null;
  }

  if (areaGuard) return areaGuard;

  return (
    <TutorialControllerProvider>
      <Outlet />
    </TutorialControllerProvider>
  );
}
