// Abas da personalização por seguradora (V12.3.7) — as 4 do protótipo V12;
// "Coberturas" e "Comissões" são funcionais, as outras aparecem desabilitadas.
export type AbaPersonalizacao = "assist" | "cob" | "desc" | "com";

const ABAS: readonly [AbaPersonalizacao, string][] = [
  ["assist", "+ Assistências"],
  ["cob", "+ Coberturas"],
  ["desc", "% Descontos"],
  ["com", "+ Comissões"],
];

const FUNCIONAIS: readonly AbaPersonalizacao[] = ["cob", "com"];

export function AbasPersonalizacao({
  className = "",
  ativa = "cob",
  onChange,
}: {
  className?: string;
  ativa?: AbaPersonalizacao;
  onChange?: (aba: AbaPersonalizacao) => void;
}) {
  return (
    <div className={`toggle toggle-sub ${className}`.trim()}>
      {ABAS.map(([id, rotulo]) => {
        const func = FUNCIONAIS.includes(id);
        return (
          <button
            key={id}
            type="button"
            className={id === ativa ? "on" : ""}
            disabled={!func}
            title={func ? undefined : "Em breve"}
            onClick={() => onChange?.(id)}
          >
            {rotulo}
            {func ? "" : " (em breve)"}
          </button>
        );
      })}
    </div>
  );
}
