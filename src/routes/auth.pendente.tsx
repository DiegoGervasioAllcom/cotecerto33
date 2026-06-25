import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import logoAsset from "@/assets/cotecerto-logo.png.asset.json";

export const Route = createFileRoute("/auth/pendente")({
  head: () => ({ meta: [{ title: "Aguardando aprovação · CoteCerto" }] }),
  component: PendentePage,
});

function PendentePage() {
  const { profile, signOut, refresh } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="auth-stage">
      <div className="auth-bg" />
      <div className="auth-brand">
        <img src={logoAsset.url} alt="CoteCerto" className="auth-logo" />
      </div>
      <div className="auth-card" style={{ textAlign: "center" }}>
        <h3>Cadastro recebido</h3>
        <p className="lead">
          {profile?.nome ? `Olá, ${profile.nome}. ` : ""}
          Sua franquia está aguardando aprovação pela Matriz. Você receberá um aviso assim que
          for liberada para uso.
        </p>
        <button
          className="auth-btn"
          style={{ marginBottom: 10 }}
          onClick={async () => {
            await refresh();
          }}
        >
          Já fui aprovado · atualizar
        </button>
        <button
          className="auth-btn outline"
          onClick={async () => {
            await signOut();
            navigate({ to: "/auth", replace: true });
          }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}
