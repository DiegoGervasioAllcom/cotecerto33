import { ComboboxBusca } from "@/components/venda/novo-lead/ComboboxBusca";
import { OCUPACOES_HDI } from "@/components/venda/novo-lead/enumsOcupacaoHdi";
import { FAIXAS_SALARIAIS_HDI, PEP_HDI, UFS_HDI } from "@/lib/transmissao-hdi";
import type { DadosComplementaresTransmissao } from "../TransmissaoDadosComplementares.schema";

export type CamposHdi = Pick<
  DadosComplementaresTransmissao,
  "ramoAtividade" | "rendaMensal" | "pessoaPoliticamenteExposta" | "ufPlaca"
>;
type ErrosHdi = Partial<Record<keyof CamposHdi, string>>;

type Props = {
  dados: CamposHdi;
  erros: ErrosHdi;
  onChange: <K extends keyof CamposHdi>(chave: K, valor: CamposHdi[K]) => void;
};

// Campos que só a Efetivação da HDI exige. Ocupação, faixa salarial e PEP são declarações do vendedor: sem valor padrão.
// A UF da placa vem pré-selecionada da UF do endereço do segurado e pode ser corrigida. Sem documento, renavam nem CPF.
export function TransmissaoDadosHdi({ dados, erros, onChange }: Props) {
  const erro = (chave: keyof CamposHdi) =>
    erros[chave] ? (
      <span
        id={`transmissao-${chave}-erro`}
        role="alert"
        className="small"
        style={{ color: "var(--alert)" }}
      >
        {erros[chave]}
      </span>
    ) : null;

  const select = (
    chave: "rendaMensal" | "pessoaPoliticamenteExposta" | "ufPlaca",
    label: string,
    opcoes: readonly string[],
  ) => (
    <div className="field-group">
      <label htmlFor={`transmissao-${chave}`}>
        {label}
        <span className="req">*</span>
      </label>
      <select
        id={`transmissao-${chave}`}
        className="input"
        value={dados[chave] ?? ""}
        aria-invalid={Boolean(erros[chave])}
        aria-describedby={erros[chave] ? `transmissao-${chave}-erro` : undefined}
        onChange={(e) => onChange(chave, e.target.value || undefined)}
      >
        <option value="">Selecione</option>
        {opcoes.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {erro(chave)}
    </div>
  );

  return (
    <>
      <div className="acc-sec-t">Dados da proposta (HDI)</div>
      <div className="wizard-grid cols-3" data-testid="transmissao-hdi-dados">
        {select("rendaMensal", "Faixa salarial", FAIXAS_SALARIAIS_HDI)}
        {select("pessoaPoliticamenteExposta", "Pessoa politicamente exposta?", PEP_HDI)}
        {select("ufPlaca", "UF da placa", UFS_HDI)}
        <div className="field-group" style={{ gridColumn: "span 3" }}>
          <label htmlFor="transmissao-ramoAtividade">
            Ocupação<span className="req">*</span>
          </label>
          <ComboboxBusca
            id="transmissao-ramoAtividade"
            ariaLabel="Ocupação"
            invalido={Boolean(erros.ramoAtividade)}
            descritoPor={erros.ramoAtividade ? "transmissao-ramoAtividade-erro" : undefined}
            value={dados.ramoAtividade ?? ""}
            options={OCUPACOES_HDI}
            onChange={(valor) => onChange("ramoAtividade", valor || undefined)}
          />
          {erro("ramoAtividade")}
        </div>
      </div>
      <div className="clt-note" style={{ marginBottom: 14 }}>
        <svg width="15" height="15">
          <use href="#i-info" />
        </svg>
        <div>
          O endereço e os telefones vêm do cadastro do cliente no portal. A UF da placa vem do
          endereço do segurado e pode ser corrigida aqui.
        </div>
      </div>
    </>
  );
}
