// Módulo compartilhado (cliente + servidor): sem dependências de servidor.
// Cartão de crédito da Efetivação da Porto (`cartao` do POST /transmissao).
//
// DADO FINANCEIRO SENSÍVEL (PCI): nunca persistido, nunca logado, nunca em
// cache; as mensagens de erro NUNCA repetem o valor. Vive só no estado do passo
// "Pagamento" e no body do fetch ao robô. Não há CVV: o portal não pede.
import { ehSeguradoraComPagamentoPorto } from "@/lib/transmissao-porto";
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";

export const BANDEIRAS_CARTAO = ["Visa", "Mastercard", "Diners", "Elo"] as const;
/** Select de bandeira da Bradesco (texto exato do portal). */
export const BANDEIRAS_BRADESCO = [
  "Visa",
  "AMEX",
  "ELO",
  "Mastercard",
  "Diners",
  "Aura",
  "JCB",
] as const;
export type BandeiraCartao =
  | (typeof BANDEIRAS_CARTAO)[number]
  | (typeof BANDEIRAS_BRADESCO)[number];

/** Bandeiras aceitas pelo portal por seguradora: a Allianz não tem Diners. */
export function bandeirasDaSeguradora(seguradora: string): readonly BandeiraCartao[] {
  const s = nomeCanonicoSeguradora(seguradora);
  if (s === "bradesco") return BANDEIRAS_BRADESCO;
  return s === "allianz" ? BANDEIRAS_CARTAO.filter((b) => b !== "Diners") : BANDEIRAS_CARTAO;
}

/** O portal recusa titular com mais de 20 caracteres (a tela deixa digitar 50). */
export const LIMITE_TITULAR_CARTAO = 20;

export type CartaoTransmissao = {
  nomeTitular: string;
  bandeira: BandeiraCartao | "";
  /** Só dígitos (13 a 16). */
  numero: string;
  /** MM/AAAA. */
  validade: string;
};

export type ErrosCartao = Partial<Record<keyof CartaoTransmissao, string>>;

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Formas de cartão da Porto no portal: "Cartão de Crédito (Demais Bandeiras)" e
 * "Cartão Porto Bank (Terceiros)". Reconhecimento EXPLÍCITO (não "contém cart"):
 * uma forma futura (ex.: "Cartão de débito") não cai por engano na tela de crédito.
 */
export function ehCartaoPorto(seguradora: string, formaPagamento: string): boolean {
  const forma = normalizar(formaPagamento);
  return (
    ehSeguradoraComPagamentoPorto(seguradora) &&
    (forma.startsWith("cartao de credito") || forma.startsWith("cartao porto bank"))
  );
}

/** "Cartão Porto Bank (Terceiros)": o titular é OUTRA pessoa — o portal cobra os dados do pagador. */
export function ehCartaoTerceirosPorto(seguradora: string, formaPagamento: string): boolean {
  return (
    ehCartaoPorto(seguradora, formaPagamento) && normalizar(formaPagamento).includes("terceiros")
  );
}

/** "1234567890123456" -> "1234 5678 9012 3456" (só para exibição; o estado guarda só dígitos). */
export function formatarNumeroCartao(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 16);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** "122030" -> "12/2030". */
export function mascararValidade(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 6);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Algoritmo de Luhn — pega erro de digitação antes de ir ao portal. */
export function luhnValido(numero: string): boolean {
  const d = numero.replace(/\D/g, "");
  if (d.length === 0) return false;
  let soma = 0;
  let dobrar = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (dobrar) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    soma += n;
    dobrar = !dobrar;
  }
  return soma % 10 === 0;
}

/** Valida o cartão; devolve erros por campo ({} se estiver tudo certo). Nunca repete o valor. */
export function validarCartao(
  cartao: Partial<CartaoTransmissao> | undefined,
  agora: Date = new Date(),
  bandeiras: readonly BandeiraCartao[] = BANDEIRAS_CARTAO,
): ErrosCartao {
  const erros: ErrosCartao = {};
  const c = cartao ?? {};

  if (typeof c.nomeTitular !== "string" || c.nomeTitular.trim() === "") {
    erros.nomeTitular = "Informe o nome do titular.";
  }
  if (!bandeiras.some((b) => b === c.bandeira)) {
    erros.bandeira = "Escolha a bandeira.";
  }
  const digitos = typeof c.numero === "string" ? c.numero.replace(/\D/g, "") : "";
  if (!/^\d{13,16}$/.test(digitos)) {
    erros.numero = "O número do cartão deve ter de 13 a 16 dígitos.";
  } else if (!luhnValido(digitos)) {
    erros.numero = "Número de cartão inválido. Confira os dígitos.";
  }
  const m =
    typeof c.validade === "string" ? c.validade.trim().match(/^(0[1-9]|1[0-2])\/(\d{4})$/) : null;
  if (!m) {
    erros.validade = "Use o formato MM/AAAA.";
  } else {
    const mes = Number(m[1]);
    const ano = Number(m[2]);
    if (ano < agora.getFullYear() || (ano === agora.getFullYear() && mes < agora.getMonth() + 1)) {
      erros.validade = "Cartão vencido.";
    }
  }
  return erros;
}
