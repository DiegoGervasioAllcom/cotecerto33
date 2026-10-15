// Módulo compartilhado (cliente + servidor): sem dependências de servidor.
// Pagamento da Efetivação da Porto: UMA regra para as formas que pedem dado
// financeiro — Débito em Conta (banco/agência/conta) e os dois cartões
// (Cartão de Crédito e Cartão Porto Bank; no "Terceiros" também o pagador).
//
// DADOS SENSÍVEIS: nunca persistidos, nunca logados, nunca em cache; mensagens
// de erro NUNCA repetem o valor. Vivem só no estado do passo "Pagamento" e no
// body do fetch ao robô.
import {
  ehCartaoPorto,
  ehCartaoTerceirosPorto,
  validarCartao,
  LIMITE_TITULAR_CARTAO,
  type CartaoTransmissao,
} from "@/lib/transmissao-cartao";
import {
  camposDebitoPayload,
  ehDebitoEmContaPorto,
  erroContaDebito,
  type ContaDebito,
} from "@/lib/transmissao-debito";
import { validarPagador, type PagadorTransmissao } from "@/lib/transmissao-pagador";

/** Dados de pagamento que seguem junto da transmissão (só na Porto). */
export type PagamentoTransmissao = {
  contaDebito?: ContaDebito;
  cartao?: CartaoTransmissao;
  /** Só no "Cartão Porto Bank (Terceiros)". */
  pagador?: PagadorTransmissao;
};

export type TipoPagamentoPorto = "debito" | "cartao" | "cartao_terceiros";

/** Qual conjunto de campos a Porto pede para esta forma de pagamento (ou `null`: nenhum). */
export function tipoPagamentoPorto(
  seguradora: string,
  formaPagamento: string,
): TipoPagamentoPorto | null {
  if (ehDebitoEmContaPorto(seguradora, formaPagamento)) return "debito";
  if (ehCartaoTerceirosPorto(seguradora, formaPagamento)) return "cartao_terceiros";
  if (ehCartaoPorto(seguradora, formaPagamento)) return "cartao";
  return null;
}

function primeiroErro(erros: Record<string, string | undefined>): string | undefined {
  return Object.values(erros).find((e): e is string => typeof e === "string" && e.length > 0);
}

/**
 * Regra de bloqueio (servidor): na Porto, a forma de pagamento exige os dados
 * do passo "Pagamento" válidos. Devolve a mensagem de erro, ou `null` (também
 * para qualquer outra forma/seguradora). A mensagem NUNCA inclui o valor.
 */
export function erroPagamentoPorto(
  seguradora: string,
  formaPagamento: string,
  pagamento: PagamentoTransmissao | undefined,
): string | null {
  const tipo = tipoPagamentoPorto(seguradora, formaPagamento);
  if (!tipo) return null;
  const p = pagamento ?? {};

  if (tipo === "debito") return erroContaDebito(seguradora, formaPagamento, p.contaDebito);

  const erroCartao = primeiroErro(validarCartao(p.cartao));
  if (erroCartao) return `Cartão: ${erroCartao}`;

  if (tipo === "cartao_terceiros") {
    const erroPagador = primeiroErro(validarPagador(p.pagador));
    if (erroPagador) return `Pagador: ${erroPagador}`;
  }
  return null;
}

/**
 * Campos de pagamento do payload — só para a forma certa da Porto, já
 * normalizados (apenas dígitos onde couber). Nada que não pertença à forma
 * escolhida sai daqui.
 */
export function camposPagamentoPayload(
  seguradora: string,
  formaPagamento: string,
  pagamento: PagamentoTransmissao | undefined,
): {
  contaDebito?: ContaDebito;
  cartao?: {
    nomeTitular: string;
    bandeira: string;
    numero: string;
    validade: string;
  };
  pagador?: Record<string, string>;
} {
  const tipo = tipoPagamentoPorto(seguradora, formaPagamento);
  if (!tipo || !pagamento) return {};

  if (tipo === "debito")
    return camposDebitoPayload(seguradora, formaPagamento, pagamento.contaDebito);

  const campos: ReturnType<typeof camposPagamentoPayload> = {};
  const c = pagamento.cartao;
  if (c) {
    campos.cartao = {
      // O portal recusa titular com mais de 20 caracteres.
      nomeTitular: c.nomeTitular.trim().slice(0, LIMITE_TITULAR_CARTAO).trim(),
      bandeira: c.bandeira,
      numero: c.numero.replace(/\D/g, ""),
      validade: c.validade.trim(),
    };
  }
  const p = pagamento.pagador;
  if (tipo === "cartao_terceiros" && p) {
    campos.pagador = {
      tipoPessoa: p.tipoPessoa,
      nome: p.nome.trim(),
      documento: p.documento.replace(/\D/g, ""),
      email: p.email.trim(),
      ddd: p.ddd.trim(),
      telefone: p.telefone.replace(/\D/g, ""),
      ...(p.tipoPessoa === "Física"
        ? { sexo: p.sexo, estadoCivil: p.estadoCivil, dataNascimento: p.dataNascimento.trim() }
        : {}),
    };
  }
  return campos;
}

/**
 * Defesa em profundidade: antes de MOSTRAR ao vendedor uma mensagem vinda do
 * robô/portal, esconde qualquer sequência de 8 ou mais dígitos (cartão, CPF/CNPJ,
 * conta, telefone), com ou sem espaços e hífens. O robô não repete valores
 * enviados, mas a mensagem final não depende dessa promessa.
 */
export function ocultarNumerosLongos(texto: string): string {
  return texto.replace(/\d(?:[ .\-/]?\d){7,}/g, "••••");
}
