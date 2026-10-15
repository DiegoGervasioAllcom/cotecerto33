import { maskCpfCnpj } from "@/lib/masks";
import {
  ESTADOS_CIVIS_PAGADOR,
  SEXOS_PAGADOR,
  TIPOS_PESSOA_PAGADOR,
  mascararData,
  type ErrosPagador,
  type PagadorTransmissao,
} from "@/lib/transmissao-pagador";
import { CampoPagamento } from "./PagamentoCampo";

type Props = {
  valor: PagadorTransmissao;
  erros: ErrosPagador;
  onChange: <K extends keyof PagadorTransmissao>(chave: K, valor: PagadorTransmissao[K]) => void;
};

// Pagador do "Cartão Porto Bank (Terceiros)": o titular do cartão é outra
// pessoa e o portal cobra os dados dela. Dado pessoal: só em memória.
export function PagamentoPagadorCampos({ valor, erros, onChange }: Props) {
  const fisica = valor.tipoPessoa === "Física";
  const docRotulo = valor.tipoPessoa === "Jurídica" ? "CNPJ" : "CPF";
  const docMaxDigitos = valor.tipoPessoa === "Jurídica" ? 14 : 11;

  return (
    <>
      <div className="acc-sec-t">Pagador (titular do cartão)</div>
      <div className="wizard-grid cols-3" data-testid="pagamento-pagador">
        <CampoPagamento id="pagador-tipo" label="Tipo de pessoa" erro={erros.tipoPessoa}>
          <select
            id="pagador-tipo"
            className="input"
            autoComplete="off"
            value={valor.tipoPessoa}
            aria-invalid={Boolean(erros.tipoPessoa)}
            aria-describedby={erros.tipoPessoa ? "pagador-tipo-erro" : undefined}
            onChange={(e) => {
              onChange("tipoPessoa", e.target.value as PagadorTransmissao["tipoPessoa"]);
              onChange("documento", ""); // CPF e CNPJ têm tamanhos diferentes
            }}
          >
            <option value="">Selecione</option>
            {TIPOS_PESSOA_PAGADOR.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </CampoPagamento>
        <CampoPagamento
          id="pagador-nome"
          label="Nome do pagador"
          erro={erros.nome}
          style={{ gridColumn: "span 2" }}
        >
          <input
            id="pagador-nome"
            className="input"
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            maxLength={100}
            value={valor.nome}
            aria-invalid={Boolean(erros.nome)}
            aria-describedby={erros.nome ? "pagador-nome-erro" : undefined}
            onChange={(e) => onChange("nome", e.target.value)}
          />
        </CampoPagamento>
        <CampoPagamento id="pagador-documento" label={docRotulo} erro={erros.documento}>
          <input
            id="pagador-documento"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            value={maskCpfCnpj(valor.documento)}
            aria-invalid={Boolean(erros.documento)}
            aria-describedby={erros.documento ? "pagador-documento-erro" : undefined}
            onChange={(e) =>
              onChange("documento", e.target.value.replace(/\D/g, "").slice(0, docMaxDigitos))
            }
          />
        </CampoPagamento>
        <CampoPagamento
          id="pagador-email"
          label="E-mail"
          erro={erros.email}
          style={{ gridColumn: "span 2" }}
        >
          <input
            id="pagador-email"
            className="input"
            type="email"
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            maxLength={254}
            value={valor.email}
            aria-invalid={Boolean(erros.email)}
            aria-describedby={erros.email ? "pagador-email-erro" : undefined}
            onChange={(e) => onChange("email", e.target.value)}
          />
        </CampoPagamento>
        <CampoPagamento id="pagador-ddd" label="DDD" erro={erros.ddd}>
          <input
            id="pagador-ddd"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            maxLength={2}
            value={valor.ddd}
            aria-invalid={Boolean(erros.ddd)}
            aria-describedby={erros.ddd ? "pagador-ddd-erro" : undefined}
            onChange={(e) => onChange("ddd", e.target.value.replace(/\D/g, ""))}
          />
        </CampoPagamento>
        <CampoPagamento id="pagador-telefone" label="Celular" erro={erros.telefone}>
          <input
            id="pagador-telefone"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            maxLength={9}
            placeholder="Sem o DDD"
            value={valor.telefone}
            aria-invalid={Boolean(erros.telefone)}
            aria-describedby={erros.telefone ? "pagador-telefone-erro" : undefined}
            onChange={(e) => onChange("telefone", e.target.value.replace(/\D/g, ""))}
          />
        </CampoPagamento>
        {fisica && (
          <>
            <CampoPagamento id="pagador-sexo" label="Sexo" erro={erros.sexo}>
              <select
                id="pagador-sexo"
                className="input"
                autoComplete="off"
                value={valor.sexo}
                aria-invalid={Boolean(erros.sexo)}
                aria-describedby={erros.sexo ? "pagador-sexo-erro" : undefined}
                onChange={(e) => onChange("sexo", e.target.value as PagadorTransmissao["sexo"])}
              >
                <option value="">Selecione</option>
                {SEXOS_PAGADOR.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </CampoPagamento>
            <CampoPagamento id="pagador-estado-civil" label="Estado civil" erro={erros.estadoCivil}>
              <select
                id="pagador-estado-civil"
                className="input"
                autoComplete="off"
                value={valor.estadoCivil}
                aria-invalid={Boolean(erros.estadoCivil)}
                aria-describedby={erros.estadoCivil ? "pagador-estado-civil-erro" : undefined}
                onChange={(e) =>
                  onChange("estadoCivil", e.target.value as PagadorTransmissao["estadoCivil"])
                }
              >
                <option value="">Selecione</option>
                {ESTADOS_CIVIS_PAGADOR.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </CampoPagamento>
            <CampoPagamento
              id="pagador-nascimento"
              label="Data de nascimento"
              erro={erros.dataNascimento}
            >
              <input
                id="pagador-nascimento"
                className="input"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                autoCorrect="off"
                maxLength={10}
                placeholder="dd/mm/aaaa"
                value={valor.dataNascimento}
                aria-invalid={Boolean(erros.dataNascimento)}
                aria-describedby={erros.dataNascimento ? "pagador-nascimento-erro" : undefined}
                onChange={(e) => onChange("dataNascimento", mascararData(e.target.value))}
              />
            </CampoPagamento>
          </>
        )}
      </div>
    </>
  );
}
