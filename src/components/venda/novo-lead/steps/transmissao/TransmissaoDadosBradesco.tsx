import { ComboboxBusca } from "@/components/venda/novo-lead/ComboboxBusca";
import { RAMOS_ATIVIDADE_BRADESCO } from "@/components/venda/novo-lead/enumsRamoAtividadeBradesco";
import { RENDAS_MENSAIS_BRADESCO, TIPOS_LOGRADOURO_BRADESCO } from "@/lib/transmissao-bradesco";
import type { DadosComplementaresTransmissao } from "../TransmissaoDadosComplementares.schema";

export type CamposBradesco = Pick<
  DadosComplementaresTransmissao,
  "ramoAtividade" | "rendaMensal" | "tipoLogradouro"
>;
type ErrosBradesco = Partial<Record<keyof CamposBradesco, string>>;

type Props = {
  dados: CamposBradesco;
  erros: ErrosBradesco;
  onChange: <K extends keyof CamposBradesco>(chave: K, valor: CamposBradesco[K]) => void;
};

// Campos que só a Efetivação da Bradesco exige. Ramo, renda e tipo de logradouro são declarações do vendedor: sem valor
// padrão (o tipo vem pré-selecionado do endereço do cadastro, mas pode ser corrigido). Documento e órgão vêm do portal.
export function TransmissaoDadosBradesco({ dados, erros, onChange }: Props) {
  const erro = (chave: keyof CamposBradesco) =>
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
    chave: "rendaMensal" | "tipoLogradouro",
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
      <div className="acc-sec-t">Dados da proposta (Bradesco)</div>
      <div className="wizard-grid cols-3" data-testid="transmissao-bradesco-dados">
        {select("rendaMensal", "Faixa de renda", RENDAS_MENSAIS_BRADESCO)}
        {select("tipoLogradouro", "Tipo de logradouro", TIPOS_LOGRADOURO_BRADESCO)}
        <div className="field-group" style={{ gridColumn: "span 3" }}>
          <label htmlFor="transmissao-ramoAtividade">
            Ramo de atividade / profissão<span className="req">*</span>
          </label>
          <ComboboxBusca
            id="transmissao-ramoAtividade"
            ariaLabel="Ramo de atividade / profissão"
            invalido={Boolean(erros.ramoAtividade)}
            descritoPor={erros.ramoAtividade ? "transmissao-ramoAtividade-erro" : undefined}
            value={dados.ramoAtividade ?? ""}
            options={RAMOS_ATIVIDADE_BRADESCO}
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
          O documento, o órgão emissor, o endereço e os telefones vêm do cadastro do cliente no
          portal.
        </div>
      </div>
    </>
  );
}
