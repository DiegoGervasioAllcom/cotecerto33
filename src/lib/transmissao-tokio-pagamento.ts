// Módulo compartilhado (cliente + servidor): sem dependências de servidor.
// Pagamento da Efetivação da Tokio (mapa de DOM de 19/10/2026): débito (titular, banco, agência, conta, ciência)
// e cartão de crédito (a Tokio NÃO pede número/validade — só COMO pagar: via tela ou link ao segurado).
//
// DADOS SENSÍVEIS (conta bancária, CPF/CNPJ do titular, CPF do responsável pelo link): nunca persistidos, nunca
// logados, nunca em cache — vivem só no estado do passo "Pagamento" e no body do fetch ao robô. Mensagens de
// erro NUNCA repetem o valor.
import { cnpjValido, cpfValido } from "@/lib/documento";
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";

// Opções do select "Banco para débito" (Cobertura1411) da Tokio, lidas ao vivo em 19/10/2026. O robô casa pelo
// NOME exato (o texto da opção não traz código). Não editar à mão: regerar lendo o portal.
export const BANCOS_DEBITO_TOKIO = [
  "BANCO DO BRASIL",
  "BANCO DA AMAZONIA",
  "BANCO DO NORDESTE DO BRASIL",
  "BANCO SANTANDER",
  "BANCO BANRISUL",
  "BANCO DO ESTADO DE SERGIPE",
  "BRB - BANCO DE BRASILIA",
  "BANCO INTER",
  "BANCO COOPERATIVA AILOS",
  "CAIXA ECONOMICA FEDERAL",
  "CRESOL CONFEDERAÇÃO",
  "BANCO COOPERATIVA UNICRED",
  "BANCO BRADESCO",
  "NUBANK PAGAMENTOS",
  "BANCO PAGSEGURO",
  "MERCADO PAGO",
  "BANCO C6",
  "ITAÚ UNIBANCO",
  "BANCO PICPAY",
  "NEON PAGAMENTOS",
  "BANCO TRIANGULO",
  "BANCO COOPERATIVO SICREDI",
  "BANCO COOPERATIVO SICOOB",
] as const;

export const PARENTESCOS_TITULAR_TOKIO = [
  "O Próprio Segurado",
  "Esposo(a)",
  "Filho(a)",
  "Irmão(a)",
  "Pai",
  "Mãe",
  "Outros",
] as const;

export const RELACOES_CARTAO_TOKIO = [
  "Próprio Segurado",
  "Principal Condutor",
  "Esposo(a)",
  "Companheiro(a)",
  "Filho(a)",
  "Irmão(a)",
  "Pai",
  "Mãe",
] as const;

export type TipoPagamentoTokio = "debito" | "cartao";

export type DebitoTokio = {
  banco: string;
  /** Até 4 dígitos (máscara do portal `####`). */
  agencia: string;
  /** Dígito verificador da agência (até 2 dígitos), opcional. */
  agenciaDv: string;
  /** Até 11 caracteres: dígitos, hífen e dígito (X). */
  conta: string;
  titularNome: string;
  /** CPF ou CNPJ, só dígitos. */
  titularDocumento: string;
  parentesco: string;
  /** Dia de vencimento das demais parcelas (1 a 31). */
  diaVencimento: string;
  /** "Pagamento da 1ª parcela no débito?" — "" = deixa o portal decidir. */
  primeiraParcelaDebito: "" | "Sim" | "Não";
  /** Ciência de que o CPF/CNPJ pertence ao titular da conta. */
  ciente: boolean;
};

export type CartaoTokio = {
  envio: "tela" | "link";
  /** Opcional. */
  relacaoProprietario: string;
  /** Obrigatório só com `envio: "link"`. */
  cpfResponsavelLink: string;
  /** Dia de vencimento da fatura (1 a 31). */
  diaFatura: string;
};

export type PagamentoTokio = { debito?: DebitoTokio; cartao?: CartaoTokio };

export type ErrosDebitoTokio = Partial<Record<keyof DebitoTokio, string>>;
export type ErrosCartaoTokio = Partial<Record<keyof CartaoTokio, string>>;

export function normalizarFormaTokio(forma: string): string {
  return forma.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Débito ("Débito/PIX Aut", "Déb. Especial/PIX Aut") ou cartão de crédito da Tokio; Boleto = `null`. */
export function tipoPagamentoTokio(
  seguradora: string,
  formaPagamento: string,
): TipoPagamentoTokio | null {
  if (nomeCanonicoSeguradora(seguradora) !== "tokio") return null;
  const f = normalizarFormaTokio(formaPagamento);
  // Palavra inteira: "boleto ... débito futuro" não deve virar débito; "PIX Aut"/"Crédito" soltos caem em `null`.
  if (/\bdeb/.test(f)) return "debito";
  if (/\bcartao\b/.test(f)) return "cartao";
  return null;
}

const diaValido = (v: unknown) =>
  typeof v === "string" && /^(?:[1-9]|[12]\d|3[01])$/.test(v.trim());
const doc = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");
const documentoValido = (v: unknown) => {
  const d = doc(v);
  return d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false;
};

export function validarDebitoTokio(debito: Partial<DebitoTokio> | undefined): ErrosDebitoTokio {
  const e: ErrosDebitoTokio = {};
  const d = debito ?? {};
  if (
    typeof d.banco !== "string" ||
    !(BANCOS_DEBITO_TOKIO as readonly string[]).includes(d.banco)
  ) {
    e.banco = "Escolha o banco.";
  }
  if (typeof d.agencia !== "string" || !/^\d{1,4}$/.test(d.agencia.trim())) {
    e.agencia = "Informe a agência (até 4 dígitos, sem dígito verificador).";
  }
  if (d.agenciaDv && !/^\d{1,2}$/.test(String(d.agenciaDv).trim())) {
    e.agenciaDv = "Dígito da agência: 1 ou 2 números.";
  }
  if (typeof d.conta !== "string" || !/^[\dxX-]{1,11}$/.test(d.conta.trim())) {
    e.conta = "Informe a conta corrente (até 11 caracteres, com o dígito).";
  }
  if (
    typeof d.titularNome !== "string" ||
    !d.titularNome.trim() ||
    d.titularNome.trim().length > 100
  ) {
    e.titularNome = "Informe o nome do titular da conta.";
  }
  if (!documentoValido(d.titularDocumento)) e.titularDocumento = "Informe um CPF ou CNPJ válido.";
  if (
    typeof d.parentesco !== "string" ||
    !(PARENTESCOS_TITULAR_TOKIO as readonly string[]).includes(d.parentesco)
  ) {
    e.parentesco = "Informe o parentesco do titular com o segurado.";
  }
  if (!diaValido(d.diaVencimento)) e.diaVencimento = "Escolha o dia de vencimento.";
  if (
    d.primeiraParcelaDebito &&
    d.primeiraParcelaDebito !== "Sim" &&
    d.primeiraParcelaDebito !== "Não"
  ) {
    e.primeiraParcelaDebito = "Escolha Sim ou Não.";
  }
  if (d.ciente !== true)
    e.ciente = "Confirme a ciência: o CPF/CNPJ deve pertencer ao titular da conta.";
  return e;
}

export function validarCartaoTokio(cartao: Partial<CartaoTokio> | undefined): ErrosCartaoTokio {
  const e: ErrosCartaoTokio = {};
  const c = cartao ?? {};
  if (c.envio !== "tela" && c.envio !== "link") e.envio = "Escolha como o cartão será informado.";
  if (
    c.relacaoProprietario &&
    !(RELACOES_CARTAO_TOKIO as readonly string[]).includes(c.relacaoProprietario)
  ) {
    e.relacaoProprietario = "Relação inválida.";
  }
  if (!diaValido(c.diaFatura)) e.diaFatura = "Escolha o dia de vencimento da fatura.";
  if (c.envio === "link") {
    const d = doc(c.cpfResponsavelLink);
    if (d.length !== 11 || !cpfValido(d)) e.cpfResponsavelLink = "Informe um CPF válido.";
  }
  return e;
}

const primeiro = (e: Record<string, string | undefined>) =>
  Object.values(e).find((x): x is string => typeof x === "string" && x.length > 0);

/** Regra de bloqueio (servidor). Devolve a mensagem de erro (sem o valor recebido) ou `null`. */
export function erroPagamentoTokio(
  seguradora: string,
  formaPagamento: string,
  pagamento: PagamentoTokio | undefined,
): string | null {
  const tipo = tipoPagamentoTokio(seguradora, formaPagamento);
  if (!tipo) return null;
  if (tipo === "debito") {
    const m = primeiro(validarDebitoTokio(pagamento?.debito));
    return m ? `Débito em conta: ${m}` : null;
  }
  const m = primeiro(validarCartaoTokio(pagamento?.cartao));
  return m ? `Cartão: ${m}` : null;
}

export type CamposPagamentoTokioPayload = {
  contaDebito?: { banco: string; agencia: string; agenciaDv?: string; conta: string };
  titularConta?: { nome: string; documento: string; parentesco: string };
  cienteTitularConta?: boolean;
  debitoPrimeiraParcela?: "Sim" | "Não";
  cartaoTokio?: {
    envio: "tela" | "link";
    relacaoProprietario?: string;
    cpfResponsavelLink?: string;
  };
  diaVencimentoDemaisParcelas?: string;
};

/** Campos do payload do robô — só para débito/cartão da Tokio, normalizados. */
export function camposPagamentoTokioPayload(
  seguradora: string,
  formaPagamento: string,
  pagamento: PagamentoTokio | undefined,
): CamposPagamentoTokioPayload {
  const tipo = tipoPagamentoTokio(seguradora, formaPagamento);
  if (!tipo || !pagamento) return {};
  if (tipo === "debito" && pagamento.debito) {
    const d = pagamento.debito;
    return {
      contaDebito: {
        banco: d.banco,
        agencia: d.agencia.trim(),
        ...(d.agenciaDv?.trim() ? { agenciaDv: d.agenciaDv.trim() } : {}),
        conta: d.conta.trim(),
      },
      titularConta: {
        nome: d.titularNome.trim(),
        documento: doc(d.titularDocumento),
        parentesco: d.parentesco,
      },
      cienteTitularConta: d.ciente === true,
      ...(d.primeiraParcelaDebito ? { debitoPrimeiraParcela: d.primeiraParcelaDebito } : {}),
      diaVencimentoDemaisParcelas: d.diaVencimento.trim(),
    };
  }
  if (tipo === "cartao" && pagamento.cartao) {
    const c = pagamento.cartao;
    return {
      cartaoTokio: {
        envio: c.envio,
        ...(c.relacaoProprietario ? { relacaoProprietario: c.relacaoProprietario } : {}),
        ...(c.envio === "link" ? { cpfResponsavelLink: doc(c.cpfResponsavelLink) } : {}),
      },
      diaVencimentoDemaisParcelas: c.diaFatura.trim(),
    };
  }
  return {};
}
