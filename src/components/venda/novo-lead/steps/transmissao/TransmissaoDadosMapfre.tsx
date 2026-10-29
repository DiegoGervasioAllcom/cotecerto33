import { ComboboxBusca } from "@/components/venda/novo-lead/ComboboxBusca";
import { RAMOS_ATIVIDADE_MAPFRE } from "@/components/venda/novo-lead/enumsRamoAtividadeMapfre";
import {
  ORGAOS_EMISSORES_MAPFRE,
  RENDAS_MENSAIS_MAPFRE,
  TIPOS_DOCUMENTO_MAPFRE,
} from "@/lib/transmissao-mapfre";
import { mascararData } from "@/lib/transmissao-pagador";
import type { DadosComplementaresTransmissao } from "../TransmissaoDadosComplementares.schema";

export type CamposMapfre = Pick<
  DadosComplementaresTransmissao,
  | "tipoDocumento"
  | "dataEmissaoRg"
  | "orgaoEmissorRg"
  | "ramoAtividade"
  | "rendaMensal"
  | "kitApolicePorEmail"
  | "certificadoEmNomeDe"
>;
type ErrosMapfre = Partial<Record<keyof CamposMapfre, string>>;

type Props = {
  dados: CamposMapfre;
  erros: ErrosMapfre;
  nomeSegurado: string;
  onChange: <K extends keyof CamposMapfre>(chave: K, valor: CamposMapfre[K]) => void;
};

// Campos que só a Efetivação da Mapfre exige. Documento, emissão, órgão, ramo e renda são declarações do vendedor:
// sem valor padrão. O número do documento, o renavam e o país de nascimento não são pedidos.
export function TransmissaoDadosMapfre({ dados, erros, nomeSegurado, onChange }: Props) {
  const erro = (chave: keyof CamposMapfre) =>
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
  const aria = (chave: keyof CamposMapfre) => ({
    "aria-invalid": Boolean(erros[chave]),
    "aria-describedby": erros[chave] ? `transmissao-${chave}-erro` : undefined,
  });

  const select = (
    chave: "tipoDocumento" | "orgaoEmissorRg" | "rendaMensal",
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
        {...aria(chave)}
        onChange={(e) => onChange(chave, (e.target.value || undefined) as never)}
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
      <div className="acc-sec-t">Dados da proposta (Mapfre)</div>
      <div className="wizard-grid cols-3" data-testid="transmissao-mapfre-dados">
        {select("tipoDocumento", "Tipo de documento", TIPOS_DOCUMENTO_MAPFRE)}
        <div className="field-group">
          <label htmlFor="transmissao-dataEmissaoRg">
            Data de emissão<span className="req">*</span>
          </label>
          <input
            id="transmissao-dataEmissaoRg"
            className="input"
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            maxLength={10}
            value={dados.dataEmissaoRg ?? ""}
            {...aria("dataEmissaoRg")}
            onChange={(e) => onChange("dataEmissaoRg", mascararData(e.target.value))}
          />
          {erro("dataEmissaoRg")}
        </div>
        {select("orgaoEmissorRg", "Órgão emissor", ORGAOS_EMISSORES_MAPFRE)}
        {select("rendaMensal", "Faixa de renda", RENDAS_MENSAIS_MAPFRE)}

        <div className="field-group" style={{ gridColumn: "span 2" }}>
          <label htmlFor="transmissao-ramoAtividade">
            Ramo de atividade / profissão<span className="req">*</span>
          </label>
          <ComboboxBusca
            id="transmissao-ramoAtividade"
            ariaLabel="Ramo de atividade / profissão"
            invalido={Boolean(erros.ramoAtividade)}
            descritoPor={erros.ramoAtividade ? "transmissao-ramoAtividade-erro" : undefined}
            value={dados.ramoAtividade ?? ""}
            options={RAMOS_ATIVIDADE_MAPFRE}
            onChange={(valor) => onChange("ramoAtividade", valor || undefined)}
          />
          {erro("ramoAtividade")}
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
        <div className="field-group" style={{ gridColumn: "span 2" }}>
          <label htmlFor="transmissao-certificadoEmNomeDe">Certificado em nome de (opcional)</label>
          <input
            id="transmissao-certificadoEmNomeDe"
            className="input"
            maxLength={60}
            placeholder={nomeSegurado || "Nome do segurado"}
            value={dados.certificadoEmNomeDe ?? ""}
            {...aria("certificadoEmNomeDe")}
            onChange={(e) => onChange("certificadoEmNomeDe", e.target.value)}
          />
          {erro("certificadoEmNomeDe")}
        </div>
      </div>
      <div className="clt-note" style={{ marginBottom: 14 }}>
        <svg width="15" height="15">
          <use href="#i-info" />
        </svg>
        <div>
          Em branco, o certificado sai no nome do segurado. O endereço, os telefones e o estado
          civil vêm do cadastro.
        </div>
      </div>
    </>
  );
}
