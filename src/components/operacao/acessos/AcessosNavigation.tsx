import type { Tab } from "./types";

export function AcessosNavigation({
  tab,
  pendentes,
  desligamentos,
  onChange,
}: {
  tab: Tab;
  pendentes: number;
  desligamentos: number;
  onChange: (tab: Tab) => void;
}) {
  return (
    <div className="toggle" style={{ marginBottom: 18 }}>
      <button
        className={tab === "pend" ? "on" : ""}
        data-tour="acessos-tab-pendentes"
        onClick={() => onChange("pend")}
      >
        Pendentes de aprovação <span style={{ opacity: 0.7 }}>({pendentes})</span>
      </button>
      <button className={tab === "vendedores" ? "on" : ""} onClick={() => onChange("vendedores")}>
        Solicitações de vendedor
      </button>
      <button
        className={tab === "deslig" ? "on" : ""}
        data-tour="acessos-tab-desligamentos"
        onClick={() => onChange("deslig")}
      >
        Desligamentos <span style={{ opacity: 0.7 }}>({desligamentos})</span>
      </button>
      <button
        className={tab === "modelos" ? "on" : ""}
        data-tour="acessos-tab-modelos"
        onClick={() => onChange("modelos")}
      >
        Personalização geral
      </button>
    </div>
  );
}
