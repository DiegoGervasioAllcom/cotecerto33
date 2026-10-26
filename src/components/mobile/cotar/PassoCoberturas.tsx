import type { Form } from "@/components/venda/novo-lead/types";

/** Coberturas padrão, somente leitura (edição fica no desktop). */
export function PassoCoberturas({ f }: { f: Form }) {
  const linhas: [string, string][] = [
    ["Plano", f.tipoCobertura],
    ["Modalidade", f.modalidade],
    ["Franquia", f.franquiaPrimeiraOpcao],
    ["Vidros", f.vidros],
    ["Carro reserva", f.carroReserva],
    ["Assistência 24h", f.assist24],
    ["Vigência", "Anual (1 ano a partir de hoje)"],
  ];
  return (
    <div className="m-card">
      {linhas.map(([k, v]) => (
        <div key={k} className="m-row">
          <span>{k}</span>
          <strong>{v}</strong>
        </div>
      ))}
    </div>
  );
}
