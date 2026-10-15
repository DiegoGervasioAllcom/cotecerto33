import type { DadosComplementaresTransmissao } from "@/components/venda/novo-lead/steps/TransmissaoDadosComplementares.schema";
import type { Form } from "@/components/venda/novo-lead/types";

/**
 * Campos da Etapa 7 que nascem de etapas anteriores (`Form`). Ao guardar um
 * rascunho em memória, guardamos junto o valor que o `Form` tinha: se o
 * vendedor voltar e corrigir um desses campos antes, o valor corrigido vale
 * mais que o digitado antes na Etapa 7.
 */
export type BaseDoForm = Pick<
  DadosComplementaresTransmissao,
  "cepResidencial" | "numeroEndereco" | "complementoEndereco" | "email" | "renavam" | "corVeiculo"
>;

export type RascunhoDadosTransmissao = {
  dados: DadosComplementaresTransmissao;
  base: BaseDoForm;
};

/** Valores iniciais da Etapa 7 vindos do `Form` (única fonte, para não divergir). */
export function baseDoForm(
  f: Pick<Form, "cep" | "numero" | "complemento" | "email" | "renavam" | "cor">,
): BaseDoForm {
  return {
    cepResidencial: f.cep,
    numeroEndereco: f.numero,
    complementoEndereco: f.complemento,
    email: f.email,
    renavam: f.renavam.replace(/\D/g, ""),
    corVeiculo: f.cor,
  };
}

// `satisfies` + o tipo abaixo fazem o tsc reclamar se um campo for adicionado
// a `BaseDoForm` e esquecido nesta lista (ou o contrário).
const MAPA_BASE = {
  cepResidencial: true,
  numeroEndereco: true,
  complementoEndereco: true,
  email: true,
  renavam: true,
  corVeiculo: true,
} satisfies Record<keyof BaseDoForm, true>;
const CHAVES_BASE = Object.keys(MAPA_BASE) as (keyof BaseDoForm)[];

/**
 * Reaplica um rascunho: tudo que o vendedor digitou na Etapa 7 é mantido,
 * exceto os campos cujo valor no `Form` mudou desde que o rascunho foi
 * guardado — nesses, vale o `Form` atual.
 */
export function aplicarRascunho(
  rascunho: RascunhoDadosTransmissao,
  baseAtual: BaseDoForm,
): DadosComplementaresTransmissao {
  const resultado = { ...rascunho.dados };
  for (const chave of CHAVES_BASE) {
    if (rascunho.base[chave] !== baseAtual[chave]) {
      (resultado as Record<string, unknown>)[chave] = baseAtual[chave];
    }
  }
  return resultado;
}
