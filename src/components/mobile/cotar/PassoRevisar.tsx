import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  marcaModelo: string;
  faltantes: string[];
  erro: string | null;
  calculando: boolean;
};

export function PassoRevisar({ f, marcaModelo, faltantes, erro, calculando }: Props) {
  const linhas: [string, string][] = [
    ["Segurado", f.nome],
    ["CPF", f.cpf],
    ["Celular", f.celular],
    ["CEP", f.cep],
    [f.ramo === "Moto" ? "Moto" : "Veículo", `${marcaModelo} ${f.anoModelo}`.trim()],
    ["Placa", f.placa],
    ["Km/mês", f.kmMensal],
    ["Pernoite", f.cepPernoite],
    ["Seguradoras", f.seguradorasSel.join(", ")],
  ];
  return (
    <>
      <div className="m-card">
        {linhas.map(([k, v]) => (
          <div key={k} className="m-row">
            <span>{k}</span>
            <strong>{v || "—"}</strong>
          </div>
        ))}
      </div>
      {faltantes.length > 0 && <div className="m-state err">Falta: {faltantes.join(", ")}.</div>}
      {erro && <div className="m-state err">{erro}</div>}
      {calculando && <div className="m-state">Enviando para cálculo…</div>}
    </>
  );
}
