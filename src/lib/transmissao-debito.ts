// Módulo compartilhado (cliente + servidor): sem dependências de servidor.
// Débito em conta da Porto: banco, agência e conta corrente que o robô digita
// na Efetivação (`contaDebito` do POST /transmissao).
//
// DADO FINANCEIRO SENSÍVEL — mesma regra do cartão: nunca persistido, nunca
// logado, nunca em cache. Vive só no estado do passo "Pagamento" e segue direto
// no body do fetch ao robô.
import {
  BANCOS_DEBITO_ALLIANZ,
  BANCOS_DEBITO_PORTO,
} from "@/components/venda/novo-lead/enumsBancosDebito";
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";
import { ehSeguradoraComPagamentoPorto } from "@/lib/transmissao-porto";

type BancoDebito = { readonly codigo: string; readonly nome: string };

/** Bancos do débito por seguradora (os selects do portal diferem entre a Porto e a Allianz). */
export function bancosDaSeguradora(seguradora: string): readonly BancoDebito[] {
  return nomeCanonicoSeguradora(seguradora) === "allianz"
    ? BANCOS_DEBITO_ALLIANZ
    : BANCOS_DEBITO_PORTO;
}

export type ContaDebito = {
  /** Código do banco (value do select do portal, ex.: "104"). */
  banco: string;
  /** 1 a 6 dígitos, sem dígito verificador. */
  agencia: string;
  /** Até 11 caracteres: dígitos, hífen e dígito verificador (X). */
  conta: string;
};

const REGEX_AGENCIA = /^\d{1,6}$/;
const REGEX_CONTA = /^[\dxX-]{1,11}$/;

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * A forma "Débito em Conta" da Porto é a única que pede conta bancária na
 * Efetivação. Outras seguradoras têm formas "Débito…" com telas diferentes
 * (ex.: Mapfre "Débito c/ 1ª em Boleto") — não entram aqui.
 */
export function ehDebitoEmContaPorto(seguradora: string, formaPagamento: string): boolean {
  return (
    ehSeguradoraComPagamentoPorto(seguradora) && normalizar(formaPagamento) === "debito em conta"
  );
}

export type ErrosContaDebito = Partial<Record<keyof ContaDebito, string>>;

/** Valida a conta; devolve os erros por campo ({} se estiver tudo certo). */
export function validarContaDebito(
  conta: Partial<ContaDebito> | undefined,
  bancos: readonly BancoDebito[] = BANCOS_DEBITO_PORTO,
): ErrosContaDebito {
  const erros: ErrosContaDebito = {};
  const c = conta ?? {};
  // No servidor o valor chega de JSON arbitrário: confere o tipo antes de
  // chamar `.trim()` (erro controlado em vez de TypeError).
  if (typeof c.banco !== "string" || !bancos.some((b) => b.codigo === c.banco)) {
    erros.banco = "Escolha o banco.";
  }
  if (typeof c.agencia !== "string" || !REGEX_AGENCIA.test(c.agencia.trim())) {
    erros.agencia = "Informe a agência (1 a 6 dígitos, sem dígito verificador).";
  }
  if (typeof c.conta !== "string" || !REGEX_CONTA.test(c.conta.trim())) {
    erros.conta = "Informe a conta corrente (até 11 caracteres, com o dígito).";
  }
  return erros;
}

/**
 * Regra de bloqueio (servidor): no débito em conta da Porto a conta é
 * obrigatória e válida. Devolve a mensagem de erro, ou `null` (também para
 * qualquer outra forma/seguradora). NUNCA inclui o valor recebido na mensagem.
 */
export function erroContaDebito(
  seguradora: string,
  formaPagamento: string,
  conta: Partial<ContaDebito> | undefined,
): string | null {
  if (!ehDebitoEmContaPorto(seguradora, formaPagamento)) return null;
  const erros = validarContaDebito(conta, bancosDaSeguradora(seguradora));
  const primeiro = erros.banco ?? erros.agencia ?? erros.conta;
  return primeiro ? `Débito em conta: ${primeiro}` : null;
}

/** Campo `contaDebito` do payload — só no débito em conta da Porto. */
export function camposDebitoPayload(
  seguradora: string,
  formaPagamento: string,
  conta: ContaDebito | undefined,
): { contaDebito?: ContaDebito } {
  if (!conta || !ehDebitoEmContaPorto(seguradora, formaPagamento)) return {};
  return {
    contaDebito: {
      banco: conta.banco,
      agencia: conta.agencia.trim(),
      conta: conta.conta.trim(),
    },
  };
}
