import { ComboboxBusca } from "@/components/venda/novo-lead/ComboboxBusca";
import { RENDAS_MENSAIS_ALLIANZ } from "@/components/venda/novo-lead/enumsPorto";
import { RAMOS_ATIVIDADE_ALLIANZ } from "@/components/venda/novo-lead/enumsRamoAtividadeAllianz";
import type { DadosComplementaresTransmissao } from "../TransmissaoDadosComplementares.schema";

export type CamposAllianz = Pick<
  DadosComplementaresTransmissao,
  "rendaMensal" | "ramoAtividade" | "veiculoAlienado"
>;
type ErrosAllianz = Partial<Record<keyof CamposAllianz, string>>;

type Props = {
  dados: CamposAllianz;
  erros: ErrosAllianz;
  /** Plano do card escolhido (o cabeçalho que a Allianz mostra na Confirmação), só para exibição. */
  plano?: string;
  /** "Veículo alienado" do cadastro do veículo: o que o select mostra quando o estado ainda não tem valor. */
  alienadoPadrao: "Sim" | "Não";
  onChange: <K extends keyof CamposAllianz>(chave: K, valor: CamposAllianz[K]) => void;
};

// Campos que só a Efetivação da Allianz exige (mapa de DOM ao vivo em 29/10/2026). Renda e ramo são declarações do cliente:
// sem valor padrão. "Veículo alienado" vem do cadastro do veículo e pode ser corrigido aqui.
export function TransmissaoDadosAllianz({ dados, erros, plano, alienadoPadrao, onChange }: Props) {
  const erro = (chave: keyof CamposAllianz) =>
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

  return (
    <>
      <div className="acc-sec-t">Dados da proposta (Allianz)</div>
      <div className="wizard-grid cols-3" data-testid="transmissao-allianz-dados">
        {plano && (
          <div className="field-group">
            <label htmlFor="transmissao-plano">Plano</label>
            <input id="transmissao-plano" className="input" value={plano} disabled />
          </div>
        )}

        <div className="field-group">
          <label htmlFor="transmissao-rendaMensal">
            Faixa de renda<span className="req">*</span>
          </label>
          <select
            id="transmissao-rendaMensal"
            className="input"
            value={dados.rendaMensal ?? ""}
            aria-invalid={Boolean(erros.rendaMensal)}
            aria-describedby={erros.rendaMensal ? "transmissao-rendaMensal-erro" : undefined}
            onChange={(e) =>
              onChange(
                "rendaMensal",
                (e.target.value || undefined) as DadosComplementaresTransmissao["rendaMensal"],
              )
            }
          >
            <option value="">Selecione</option>
            {RENDAS_MENSAIS_ALLIANZ.map((renda) => (
              <option key={renda}>{renda}</option>
            ))}
          </select>
          {erro("rendaMensal")}
        </div>

        <div className="field-group">
          <label htmlFor="transmissao-ramoAtividade">
            Ramo de atividade / profissão<span className="req">*</span>
          </label>
          <ComboboxBusca
            id="transmissao-ramoAtividade"
            ariaLabel="Ramo de atividade / profissão"
            invalido={Boolean(erros.ramoAtividade)}
            descritoPor={erros.ramoAtividade ? "transmissao-ramoAtividade-erro" : undefined}
            value={dados.ramoAtividade ?? ""}
            options={RAMOS_ATIVIDADE_ALLIANZ}
            onChange={(valor) => onChange("ramoAtividade", valor || undefined)}
          />
          {erro("ramoAtividade")}
        </div>

        <div className="field-group">
          <label htmlFor="transmissao-veiculoAlienado">
            Veículo alienado?<span className="req">*</span>
          </label>
          <select
            id="transmissao-veiculoAlienado"
            className="input"
            value={dados.veiculoAlienado ?? alienadoPadrao}
            aria-invalid={Boolean(erros.veiculoAlienado)}
            aria-describedby={
              erros.veiculoAlienado ? "transmissao-veiculoAlienado-erro" : undefined
            }
            onChange={(e) => onChange("veiculoAlienado", e.target.value as "Sim" | "Não")}
          >
            <option>Não</option>
            <option>Sim</option>
          </select>
          {erro("veiculoAlienado")}
        </div>
      </div>
      <div className="clt-note" style={{ marginBottom: 14 }}>
        <svg width="15" height="15">
          <use href="#i-info" />
        </svg>
        <div>
          O endereço, os telefones e o estado civil vêm do cadastro. "Veículo alienado" vem do
          cadastro do veículo — corrija aqui se estiver diferente. No pagamento parcelado, escolha o
          dia de vencimento das demais parcelas abaixo.
        </div>
      </div>
    </>
  );
}
