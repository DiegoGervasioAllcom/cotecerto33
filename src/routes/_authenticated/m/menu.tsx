import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MobileShell } from "@/components/mobile/MobileShell";
import { useAuth } from "@/lib/auth";
import { preferirVersaoCompleta } from "@/lib/banner-mobile";

export const Route = createFileRoute("/_authenticated/m/menu")({ component: MenuMobile });

function MenuMobile() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const sair = async () => {
    await signOut();
    void navigate({ to: "/auth" });
  };
  return (
    <MobileShell titulo="Menu">
      <a className="m-btn" href="/inicio" onClick={() => preferirVersaoCompleta()}>
        Versão completa
      </a>
      <button type="button" className="m-btn danger" onClick={() => void sair()}>
        Sair
      </button>
    </MobileShell>
  );
}
