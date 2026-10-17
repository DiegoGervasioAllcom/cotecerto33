import { ComboboxBusca } from "@/components/venda/novo-lead/ComboboxBusca";
import { PEP_PORTO, RENDAS_MENSAIS_PORTO } from "@/components/venda/novo-lead/enumsPorto";
import { RAMOS_ATIVIDADE_PORTO } from "@/components/venda/novo-lead/enumsRamoAtividade";
import { mascararDdd, mascararTelefoneFixo } from "@/lib/telefone-fixo";
import type { DadosComplementaresTransmissao } from "../TransmissaoDadosComplementares.schema";

export type CamposPorto = Pick<
  DadosComplementaresTransmissao,
  | "rendaMensal"
  | "ramoAtividade"
  | "pessoaPoliticamenteExposta"
  | "dddTelefoneResidencial"
  | "telefoneResidencial"
  | "dddTelefoneComercial"
  | "telefoneComercial"
>;
type ErrosPorto = Partial<Record<keyof CamposPorto, string>>;

type Props = {
  dados: CamposPorto;
  erros: ErrosPorto;
  onChange: <K extends keyof CamposPorto>(chave: K, valor: CamposPorto[K]) => void;
};

// Declarações do cliente que a Efetivação da Porto exige. Sem valor padrão de
// propósito: quem responde é o segurado, não o sistema. Não são gravadas —
// ficam só no estado do passo (ver `TransmissaoDadosComplementares.schema.ts`).
export function TransmissaoDadosPorto({ dados, erros, onChange }: Props) {
  const erro = (chave: keyof CamposPorto) =>
    erros[chave] ? (
      <span id={`transmissao-${chave}-erro`} className="small" style={{ color: "var(--alert)" }}>
        {erros[chave]}
      </span>
    ) : null;

  return (
    <>
      <div className="acc-sec-t">Declarações do segurado (Porto)</div>
      <div className="wizard-grid cols-3" data-testid="transmissao-porto-declaracoes">
        <div className="field-group">
          <label htmlFor="transmissao-rendaMensal">
            Renda mensal<span className="req">*</span>
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
            {RENDAS_MENSAIS_PORTO.map((renda) => (
              <option key={renda}>{renda}</option>
            ))}
          </select>
          {erro("rendaMensal")}
        </div>

        <div className="field-group">
          <label htmlFor="transmissao-pessoaPoliticamenteExposta">
            Pessoa politicamente exposta?<span className="req">*</span>
          </label>
          <select
            id="transmissao-pessoaPoliticamenteExposta"
            className="input"
            value={dados.pessoaPoliticamenteExposta ?? ""}
            aria-invalid={Boolean(erros.pessoaPoliticamenteExposta)}
            aria-describedby={
              erros.pessoaPoliticamenteExposta
                ? "transmissao-pessoaPoliticamenteExposta-erro"
                : undefined
            }
            onChange={(e) =>
              onChange(
                "pessoaPoliticamenteExposta",
                (e.target.value ||
                  undefined) as DadosComplementaresTransmissao["pessoaPoliticamenteExposta"],
              )
            }
          >
            <option value="">Selecione</option>
            {PEP_PORTO.map((opcao) => (
              <option key={opcao}>{opcao}</option>
            ))}
          </select>
          {erro("pessoaPoliticamenteExposta")}
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
            options={RAMOS_ATIVIDADE_PORTO}
            onChange={(valor) => onChange("ramoAtividade", valor || undefined)}
          />
          {erro("ramoAtividade")}
        </div>
      </div>

      <div className="acc-sec-t">Telefones fixos (opcional)</div>
      <div className="clt-note" style={{ marginBottom: 14 }}>
        <svg width="15" height="15">
          <use href="#i-info" />
        </svg>
        <div>
          A Porto não aceita celular nos telefones residencial e comercial. Se o segurado tem um
          telefone fixo, informe aqui; se não tem, deixe em branco que o sistema limpa esses campos
          no portal. O celular do segurado não muda.
        </div>
      </div>
      <div className="wizard-grid" data-testid="transmissao-porto-telefones-fixos">
        {(
          [
            ["Residencial", "dddTelefoneResidencial", "telefoneResidencial"],
            ["Comercial", "dddTelefoneComercial", "telefoneComercial"],
          ] as const
        ).map(([rotulo, chaveDdd, chaveNumero]) => (
          <div className="field-group" key={chaveNumero}>
            <label htmlFor={`transmissao-${chaveNumero}`}>
              Telefone fixo {rotulo.toLowerCase()}
            </label>
            <div className="row" style={{ gap: 8 }}>
              <input
                id={`transmissao-${chaveDdd}`}
                className="input"
                style={{ maxWidth: 64 }}
                inputMode="numeric"
                placeholder="DDD"
                aria-label={`DDD do telefone fixo ${rotulo.toLowerCase()}`}
                value={dados[chaveDdd] ?? ""}
                aria-invalid={Boolean(erros[chaveNumero])}
                aria-describedby={
                  erros[chaveNumero] ? `transmissao-${chaveNumero}-erro` : undefined
                }
                onChange={(e) => onChange(chaveDdd, mascararDdd(e.target.value) || undefined)}
              />
              <input
                id={`transmissao-${chaveNumero}`}
                className="input"
                style={{ flex: 1, minWidth: 0 }}
                inputMode="numeric"
                placeholder="0000-0000"
                value={dados[chaveNumero] ?? ""}
                aria-invalid={Boolean(erros[chaveNumero])}
                aria-describedby={
                  erros[chaveNumero] ? `transmissao-${chaveNumero}-erro` : undefined
                }
                onChange={(e) =>
                  onChange(chaveNumero, mascararTelefoneFixo(e.target.value) || undefined)
                }
              />
            </div>
            {erro(chaveNumero)}
          </div>
        ))}
      </div>
    </>
  );
}
