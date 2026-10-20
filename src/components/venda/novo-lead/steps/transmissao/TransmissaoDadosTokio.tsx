import { PEP_PORTO, RENDAS_MENSAIS_TOKIO } from "@/components/venda/novo-lead/enumsPorto";
import { mascararDdd, mascararTelefoneFixo } from "@/lib/telefone-fixo";
import { mascararData } from "@/lib/transmissao-pagador";
import type { DadosComplementaresTransmissao } from "../TransmissaoDadosComplementares.schema";

export type CamposTokio = Pick<
  DadosComplementaresTransmissao,
  | "rendaMensal"
  | "pessoaPoliticamenteExposta"
  | "vencimentoPrimeiraParcela"
  | "dddTelefoneResidencial"
  | "telefoneResidencial"
>;
type ErrosTokio = Partial<Record<keyof CamposTokio, string>>;

type Props = {
  dados: CamposTokio;
  erros: ErrosTokio;
  onChange: <K extends keyof CamposTokio>(chave: K, valor: CamposTokio[K]) => void;
};

// Campos que só a Efetivação da Tokio exige (mapa de DOM validado ao vivo em 19/10/2026). Renda e PEP são
// declarações do cliente: sem valor padrão. O vencimento nasce com o padrão do portal (hoje + 7 dias).
export function TransmissaoDadosTokio({ dados, erros, onChange }: Props) {
  const erro = (chave: keyof CamposTokio) =>
    erros[chave] ? (
      <span id={`transmissao-${chave}-erro`} className="small" style={{ color: "var(--alert)" }}>
        {erros[chave]}
      </span>
    ) : null;

  return (
    <>
      <div className="acc-sec-t">Dados da proposta (Tokio)</div>
      <div className="wizard-grid cols-3" data-testid="transmissao-tokio-dados">
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
            {RENDAS_MENSAIS_TOKIO.map((renda) => (
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
          <label htmlFor="transmissao-vencimentoPrimeiraParcela">
            Vencimento da parcela<span className="req">*</span>
          </label>
          <input
            id="transmissao-vencimentoPrimeiraParcela"
            className="input"
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            maxLength={10}
            value={dados.vencimentoPrimeiraParcela ?? ""}
            aria-invalid={Boolean(erros.vencimentoPrimeiraParcela)}
            aria-describedby={
              erros.vencimentoPrimeiraParcela
                ? "transmissao-vencimentoPrimeiraParcela-erro"
                : undefined
            }
            onChange={(e) =>
              onChange("vencimentoPrimeiraParcela", mascararData(e.target.value) || undefined)
            }
          />
          {erro("vencimentoPrimeiraParcela")}
        </div>
      </div>
      <div className="clt-note" style={{ marginBottom: 14 }}>
        <svg width="15" height="15">
          <use href="#i-info" />
        </svg>
        <div>
          O vencimento já vem com a data que o portal da Tokio aceita (hoje + 7 dias). Só mude se o
          portal indicar outra data.
        </div>
      </div>

      <div className="acc-sec-t">Telefone residencial (opcional)</div>
      <div className="clt-note" style={{ marginBottom: 14 }}>
        <svg width="15" height="15">
          <use href="#i-info" />
        </svg>
        <div>
          A Tokio exige um telefone residencial. Se o segurado tem um telefone fixo, informe aqui;
          se não tem, deixe em branco e o sistema repete o celular do segurado, o que a Tokio pode
          recusar na transmissão.
        </div>
      </div>
      <div className="wizard-grid" data-testid="transmissao-tokio-telefone">
        <div className="field-group">
          <label htmlFor="transmissao-telefoneResidencial">Telefone fixo residencial</label>
          <div className="row" style={{ gap: 8 }}>
            <input
              id="transmissao-dddTelefoneResidencial"
              className="input"
              style={{ maxWidth: 64 }}
              inputMode="numeric"
              placeholder="DDD"
              aria-label="DDD do telefone fixo residencial"
              value={dados.dddTelefoneResidencial ?? ""}
              aria-invalid={Boolean(erros.telefoneResidencial)}
              aria-describedby={
                erros.telefoneResidencial ? "transmissao-telefoneResidencial-erro" : undefined
              }
              onChange={(e) =>
                onChange("dddTelefoneResidencial", mascararDdd(e.target.value) || undefined)
              }
            />
            <input
              id="transmissao-telefoneResidencial"
              className="input"
              style={{ flex: 1, minWidth: 0 }}
              inputMode="numeric"
              placeholder="0000-0000"
              value={dados.telefoneResidencial ?? ""}
              aria-invalid={Boolean(erros.telefoneResidencial)}
              aria-describedby={
                erros.telefoneResidencial ? "transmissao-telefoneResidencial-erro" : undefined
              }
              onChange={(e) =>
                onChange("telefoneResidencial", mascararTelefoneFixo(e.target.value) || undefined)
              }
            />
          </div>
          {erro("telefoneResidencial")}
        </div>
      </div>
    </>
  );
}
