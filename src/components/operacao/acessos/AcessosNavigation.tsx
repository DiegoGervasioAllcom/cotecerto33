import type { Tab } from "./types";

export function AcessosNavigation({
  tab,
  cadastros,
  pendentes,
  desligamentos,
  onChange,
}: {
  tab: Tab;
  /** Total de cadastros ativos — o "(N)" da aba, igual ao protótipo. null enquanto não carregou. */
  cadastros?: number | null;
  pendentes: number;
  desligamentos: number;
  onChange: (tab: Tab) => void;
}) {
  return (
    <div className="toggle" style={{ marginBottom: 18 }}>
      <button className={tab === "cadastros" ? "on" : ""} onClick={() => onChange("cadastros")}>
        Cadastros Rede{cadastros != null && <span style={{ opacity: 0.7 }}> ({cadastros})</span>}
      </button>
      <button
        className={tab === "pend" ? "on" : ""}
        data-tour="acessos-tab-pendentes"
        onClick={() => onChange("pend")}
      >
        Pendentes de aprovação <span style={{ opacity: 0.7 }}>({pendentes})</span>
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
