// Abas da personalização por seguradora (V12.3.7) — as 4 do protótipo V12, mas
// só "Coberturas" é funcional; as outras aparecem desabilitadas "(em breve)".
const ABAS = [
  ["assist", "+ Assistências"],
  ["cob", "+ Coberturas"],
  ["desc", "% Descontos"],
  ["com", "+ Comissões"],
] as const;

export function AbasPersonalizacao({ className = "" }: { className?: string }) {
  return (
    <div className={`toggle toggle-sub ${className}`.trim()}>
      {ABAS.map(([id, rotulo]) => {
        const ativa = id === "cob";
        return (
          <button
            key={id}
            type="button"
            className={ativa ? "on" : ""}
            disabled={!ativa}
            title={ativa ? undefined : "Em breve"}
          >
            {rotulo}
            {ativa ? "" : " (em breve)"}
          </button>
        );
      })}
    </div>
  );
}
