import { ComboboxBusca } from "@/components/venda/novo-lead/ComboboxBusca";
import { RAMOS_ATIVIDADE_YELUM } from "@/components/venda/novo-lead/enumsRamoAtividadeYelum";
import { maskCpfCnpj } from "@/lib/masks";
import { RENDAS_MENSAIS_YELUM, TIPOS_LOGRADOURO_YELUM } from "@/lib/transmissao-yelum";
import type { DadosComplementaresTransmissao } from "../TransmissaoDadosComplementares.schema";

export type CamposYelum = Pick<
  DadosComplementaresTransmissao,
  | "ramoAtividade"
  | "rendaMensal"
  | "tipoLogradouro"
  | "cpfVendedor"
  | "veiculoAlienado"
  | "kitApolicePorEmail"
>;
type ErrosYelum = Partial<Record<keyof CamposYelum, string>>;

type Props = {
  dados: CamposYelum;
  erros: ErrosYelum;
  /** "Veículo alienado" do cadastro do veículo: o que o select mostra quando o estado ainda não tem valor. */
  alienadoPadrao: "Sim" | "Não";
  onChange: <K extends keyof CamposYelum>(chave: K, valor: CamposYelum[K]) => void;
};

// Campos que só a Efetivação da Yelum exige. Ramo, renda e tipo de logradouro são declarações do vendedor: sem valor padrão
// (o tipo vem pré-selecionado do endereço quando casa com a lista da Yelum). O CPF do vendedor vem do perfil e pode ser
// corrigido. Documento, órgão e renavam não são pedidos. Dado pessoal (CPF): só em memória.
export function TransmissaoDadosYelum({ dados, erros, alienadoPadrao, onChange }: Props) {
  const erro = (chave: keyof CamposYelum) =>
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
      <div className="acc-sec-t">Dados da proposta (Yelum)</div>
      <div className="wizard-grid cols-3" data-testid="transmissao-yelum-dados">
        {select("rendaMensal", "Faixa de renda", RENDAS_MENSAIS_YELUM)}
        {select("tipoLogradouro", "Tipo de logradouro", TIPOS_LOGRADOURO_YELUM)}
        <div className="field-group">
          <label htmlFor="transmissao-cpfVendedor">
            CPF do vendedor<span className="req">*</span>
          </label>
          <input
            id="transmissao-cpfVendedor"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            maxLength={14}
            placeholder="000.000.000-00"
            value={maskCpfCnpj(dados.cpfVendedor)}
            aria-invalid={Boolean(erros.cpfVendedor)}
            aria-describedby={erros.cpfVendedor ? "transmissao-cpfVendedor-erro" : undefined}
            onChange={(e) =>
              onChange("cpfVendedor", e.target.value.replace(/\D/g, "").slice(0, 11))
            }
          />
          {erro("cpfVendedor")}
        </div>
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
            options={RAMOS_ATIVIDADE_YELUM}
            onChange={(valor) => onChange("ramoAtividade", valor || undefined)}
          />
          {erro("ramoAtividade")}
        </div>
        <div className="field-group">
          <label htmlFor="transmissao-veiculoAlienado">Veículo alienado?</label>
          <select
            id="transmissao-veiculoAlienado"
            className="input"
            value={dados.veiculoAlienado ?? alienadoPadrao}
            onChange={(e) => onChange("veiculoAlienado", e.target.value as "Sim" | "Não")}
          >
            <option>Não</option>
            <option>Sim</option>
          </select>
        </div>
        <div className="field-group">
          <label htmlFor="transmissao-kitApolicePorEmail">Kit da apólice por e-mail?</label>
          <select
            id="transmissao-kitApolicePorEmail"
            className="input"
            value={dados.kitApolicePorEmail ?? "Sim"}
            onChange={(e) => onChange("kitApolicePorEmail", e.target.value as "Sim" | "Não")}
          >
            <option>Sim</option>
            <option>Não</option>
          </select>
        </div>
      </div>
      <div className="clt-note" style={{ marginBottom: 14 }}>
        <svg width="15" height="15">
          <use href="#i-info" />
        </svg>
        <div>
          O endereço e os telefones vêm do cadastro do cliente no portal. O CPF do vendedor vem do
          seu perfil e pode ser corrigido aqui.
        </div>
      </div>
    </>
  );
}
