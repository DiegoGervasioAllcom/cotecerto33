import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import "@/styles/m-banner.css";
import { bannerDispensado, dispensarBanner, ehDispositivoMobile } from "@/lib/banner-mobile";

export function BannerMobile() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    setVisivel(ehDispositivoMobile((q) => window.matchMedia(q)) && !bannerDispensado());
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
      <Link className="m-banner-btn pri" to="/m/cotacoes">
        Usar versão mobile
      </Link>
      <button type="button" className="m-banner-btn" onClick={fechar}>
        Agora não
      </button>
    </div>
  );
}
