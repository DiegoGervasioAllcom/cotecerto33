import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import "@/styles/m-banner.css";
import {
  bannerDispensado,
  deveRedirecionar,
  dispensarBanner,
  ehDispositivoMobile,
  jaRedirecionouNaSessao,
  lerPreferenciaVersao,
  limparPreferenciaVersao,
  marcarRedirecionouNaSessao,
} from "@/lib/banner-mobile";

export function BannerMobile() {
  const [visivel, setVisivel] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mobile = ehDispositivoMobile((q) => window.matchMedia(q));
    // Só a primeira avaliação da sessão decide: depois disso, navegar para a
    // landing não redireciona (a pessoa pode ter vindo de um deep link).
    const ja = jaRedirecionouNaSessao();
    marcarRedirecionouNaSessao();
    const preferencia = lerPreferenciaVersao();
    if (deveRedirecionar({ mobile, preferencia, jaRedirecionouNaSessao: ja, pathname })) {
      void navigate({ to: "/m/cotacoes", replace: true });
      return;
    }
    setVisivel(mobile && (preferencia === "completa" || !bannerDispensado()));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- decisão só no mount
  }, []);

  if (!visivel) return null;
  const fechar = () => {
    dispensarBanner();
    setVisivel(false);
  };
  return (
    <div className="m-banner" role="region" aria-label="Versão mobile">
      <span className="m-banner-txt">
        Está no celular? Use a versão mobile para cotar mais rápido.
      </span>
      <button
        type="button"
        className="m-banner-btn pri"
        onClick={() => {
          limparPreferenciaVersao();
          void navigate({ to: "/m/cotacoes" });
        }}
      >
        Usar versão mobile
      </button>
      <button type="button" className="m-banner-btn" onClick={fechar}>
        Agora não
      </button>
    </div>
  );
}
