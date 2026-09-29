/**
 * Filtro de seção do passo Cálculo (`.cob-filtro` do protótipo V12 · V12.3.12).
 * As opções são os rótulos literais devolvidos pelo portal (`secao`); sem
 * nenhum card com `secao` o filtro não aparece.
 */
type Props = {
  secoes: readonly string[];
  atual: string;
  onChange: (secao: string) => void;
};

export function CalculoFiltroSecao({ secoes, atual, onChange }: Props) {
  if (secoes.length === 0) return null;
  const opcoes: Array<[string, string]> = [
    ...secoes.map((s): [string, string] => [s, s]),
    ["", "Todas"],
  ];
  return (
    <div className="cob-filtro" data-tour="cob-filtro">
      {opcoes.map(([valor, rotulo]) => (
        <button
          key={valor || "todas"}
          type="button"
          className={`cob-chip${atual === valor ? " on" : ""}`}
          onClick={() => onChange(valor)}
        >
          {rotulo}
        </button>
      ))}
    </div>
  );
}
