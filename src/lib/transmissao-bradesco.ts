// Módulo compartilhado (cliente + servidor): campos da transmissão que só a Bradesco exige. Espelha o contrato do robô em
// `POST /transmissao` (`ramoAtividade`, `rendaMensal`, `tipoLogradouro`, `creditoEmConta`, `contaDebito` + `cienteTitularConta`,
// `cartao`). Ramo, renda e tipo do logradouro são declarações do vendedor: SEM valor padrão. Documento e órgão emissor vêm do
// cadastro do cliente no portal (não são pedidos); sem renavam.
//
// DADO FINANCEIRO (conta de débito, crédito em conta, cartão): nunca persistido, nunca logado, nunca em URL/erro; as mensagens
// de erro NUNCA repetem o valor recebido.
import { RAMOS_ATIVIDADE_BRADESCO } from "@/components/venda/novo-lead/enumsRamoAtividadeBradesco";
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";
import {
  BANDEIRAS_BRADESCO,
  LIMITE_TITULAR_CARTAO,
  validarCartao,
  type CartaoTransmissao,
} from "@/lib/transmissao-cartao";
import { bancosDaSeguradora, validarContaDebito, type ContaDebito } from "@/lib/transmissao-debito";

export const RENDAS_MENSAIS_BRADESCO = [
  "NÃO DESEJA INFORMAR",
  "DE R$ 1,00 A R$ 1.000,00",
  "DE R$ 1.001,00 A R$ 3.000,00",
  "DE R$ 3.001,00 A R$ 6.000,00",
  "ACIMA DE R$ 10.000,00",
] as const;

/** Tipos de logradouro aceitos pelo portal (mesma lista da Tokio/Porto). */
export const TIPOS_LOGRADOURO_BRADESCO = [
  "Rua",
  "Avenida",
  "Travessa",
  "Alameda",
  "Estrada",
  "Rodovia",
  "Praça",
  "Largo",
  "Viela",
  "Beco",
] as const;

/** Opções da pergunta "Autorizo crédito em minha conta para eventuais devoluções de valores". */
export const OPCOES_CREDITO_EM_CONTA = [
  "Não",
  "Sim, conta corrente",
  "Sim, conta poupança",
] as const;
export type OpcaoCreditoEmConta = (typeof OPCOES_CREDITO_EM_CONTA)[number];

export const AVISO_FORMA_NAO_SUPORTADA_BRADESCO =
  "Esta forma de pagamento ainda não está disponível para transmissão. Escolha Boleto, Débito em Conta ou Cartão de Crédito.";

export type DadosBradesco = {
  ramoAtividade?: string;
  rendaMensal?: string;
  tipoLogradouro?: string;
};

export function ehSeguradoraBradesco(seguradora: string): boolean {
  return nomeCanonicoSeguradora(seguradora) === "bradesco";
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function ehDebitoBradesco(seguradora: string, formaPagamento: string): boolean {
  return ehSeguradoraBradesco(seguradora) && normalizar(formaPagamento).startsWith("debito");
}

/** Só "Cartão de Crédito": o "Cartão Bradesco Seguros" não foi mapeado (ver `ehFormaNaoSuportadaBradesco`). */
export function ehCartaoBradesco(seguradora: string, formaPagamento: string): boolean {
  return (
    ehSeguradoraBradesco(seguradora) && normalizar(formaPagamento).startsWith("cartao de credito")
  );
}

/** "Cartão Bradesco Seguros" (e qualquer outro cartão que não seja o de crédito): sem transmissão por enquanto. */
export function ehFormaNaoSuportadaBradesco(seguradora: string, formaPagamento: string): boolean {
  if (!ehSeguradoraBradesco(seguradora)) return false;
  const f = normalizar(formaPagamento);
  return f.includes("cartao") && !f.startsWith("cartao de credito");
}

/** Erro por campo dos 3 obrigatórios da Bradesco ({} se tudo certo). Usado pelo schema e pelo servidor. */
export function errosDadosBradesco(
  dados: DadosBradesco | undefined,
): Partial<Record<"ramoAtividade" | "rendaMensal" | "tipoLogradouro", string>> {
  const d = dados ?? {};
  const erros: ReturnType<typeof errosDadosBradesco> = {};
  if (!d.ramoAtividade || !RAMOS_ATIVIDADE_BRADESCO.includes(d.ramoAtividade)) {
    erros.ramoAtividade = "Escolha o ramo de atividade na lista.";
  }
  if (!d.rendaMensal || !(RENDAS_MENSAIS_BRADESCO as readonly string[]).includes(d.rendaMensal)) {
    erros.rendaMensal = "Informe a faixa de renda.";
  }
  if (
    !d.tipoLogradouro ||
    !(TIPOS_LOGRADOURO_BRADESCO as readonly string[]).includes(d.tipoLogradouro)
  ) {
    erros.tipoLogradouro = "Escolha o tipo de logradouro.";
  }
  return erros;
}

/** Regra de bloqueio (servidor). Devolve a mensagem, ou `null` (também para outras seguradoras). */
export function erroDadosBradesco(
  seguradora: string,
  formaPagamento: string,
  dados: DadosBradesco | undefined,
): string | null {
  if (!ehSeguradoraBradesco(seguradora)) return null;
  if (ehFormaNaoSuportadaBradesco(seguradora, formaPagamento)) {
    return AVISO_FORMA_NAO_SUPORTADA_BRADESCO;
  }
  const primeiro = Object.values(errosDadosBradesco(dados))[0];
  return primeiro ? `${primeiro} (exigido pela Bradesco)` : null;
}

/** Campos extras do payload — só Bradesco. */
export function camposBradescoPayload(
  seguradora: string,
  dados: DadosBradesco | undefined,
): DadosBradesco {
  if (!ehSeguradoraBradesco(seguradora) || !dados) return {};
  const c: DadosBradesco = {};
  if (dados.ramoAtividade) c.ramoAtividade = dados.ramoAtividade;
  if (dados.rendaMensal) c.rendaMensal = dados.rendaMensal;
  if (dados.tipoLogradouro) c.tipoLogradouro = dados.tipoLogradouro;
  return c;
}

/** Conta bancária da Bradesco: como a do débito, com o dígito da agência opcional (1–2 dígitos). */
export type ContaBradesco = ContaDebito & { agenciaDv?: string };
export type ErrosContaBradesco = Partial<Record<keyof ContaBradesco, string>>;

/** Crédito em conta para devoluções: `opcao` é a resposta do vendedor; só "Sim…" envia `conta`. */
export type CreditoEmContaBradesco = { opcao: OpcaoCreditoEmConta; conta: ContaBradesco };

/** Pagamento da Bradesco. DADO SENSÍVEL: nunca persistir/logar. */
export type PagamentoBradesco = {
  contaDebito?: ContaBradesco;
  cienteTitularConta?: boolean;
  creditoEmConta?: CreditoEmContaBradesco;
  cartao?: CartaoTransmissao;
};

export const CONTA_BRADESCO_VAZIA: ContaBradesco = {
  banco: "",
  agencia: "",
  agenciaDv: "",
  conta: "",
};

export function validarContaBradesco(
  conta: Partial<ContaBradesco> | undefined,
): ErrosContaBradesco {
  const erros: ErrosContaBradesco = validarContaDebito(conta, bancosDaSeguradora("bradesco"));
  const dv = conta?.agenciaDv;
  if (typeof dv === "string" && dv.trim() !== "" && !/^\d{1,2}$/.test(dv.trim())) {
    erros.agenciaDv = "O dígito da agência tem 1 ou 2 dígitos.";
  }
  return erros;
}

export function creditoEmContaAtivo(c: CreditoEmContaBradesco | undefined): boolean {
  return c !== undefined && c.opcao !== "Não";
}

export function erroPagamentoBradesco(
  seguradora: string,
  formaPagamento: string,
  pagamento: PagamentoBradesco | undefined,
): string | null {
  if (!ehSeguradoraBradesco(seguradora)) return null;
  const p = pagamento ?? {};
  if (ehDebitoBradesco(seguradora, formaPagamento)) {
    const erros = validarContaBradesco(p.contaDebito);
    const primeiro = erros.banco ?? erros.agencia ?? erros.agenciaDv ?? erros.conta;
    if (primeiro) return `Débito em conta: ${primeiro}`;
    if (p.cienteTitularConta !== true) {
      return "Débito em conta: confirme que o CPF/CNPJ pertence ao titular da conta.";
    }
  }
  if (ehCartaoBradesco(seguradora, formaPagamento)) {
    const erros = validarCartao(p.cartao, undefined, BANDEIRAS_BRADESCO);
    const primeiro = Object.values(erros).find((e) => Boolean(e));
    if (primeiro) return `Cartão: ${primeiro}`;
  }
  if (creditoEmContaAtivo(p.creditoEmConta)) {
    const erros = validarContaBradesco(p.creditoEmConta?.conta);
    const primeiro = erros.banco ?? erros.agencia ?? erros.agenciaDv ?? erros.conta;
    if (primeiro) return `Crédito em conta: ${primeiro}`;
  }
  return null;
}

function contaPayload(c: ContaBradesco): ContaBradesco {
  const dv = c.agenciaDv?.trim();
  return {
    banco: c.banco,
    agencia: c.agencia.trim(),
    ...(dv ? { agenciaDv: dv } : {}),
    conta: c.conta.trim(),
  };
}

export type CamposPagamentoBradescoPayload = {
  contaDebito?: ContaBradesco;
  cienteTitularConta?: true;
  cartao?: { nomeTitular: string; bandeira: string; numero: string; validade: string };
  creditoEmConta?: ContaBradesco & { tipo: "corrente" | "poupanca" };
};

/** Só o que pertence à forma escolhida; `creditoEmConta` só com "Sim…" (com "Não" a chave fica ausente). */
export function camposPagamentoBradescoPayload(
  seguradora: string,
  formaPagamento: string,
  pagamento: PagamentoBradesco | undefined,
): CamposPagamentoBradescoPayload {
  if (!ehSeguradoraBradesco(seguradora) || !pagamento) return {};
  const campos: CamposPagamentoBradescoPayload = {};
  if (ehDebitoBradesco(seguradora, formaPagamento) && pagamento.contaDebito) {
    campos.contaDebito = contaPayload(pagamento.contaDebito);
    campos.cienteTitularConta = true;
  }
  const c = pagamento.cartao;
  if (ehCartaoBradesco(seguradora, formaPagamento) && c) {
    campos.cartao = {
      nomeTitular: c.nomeTitular.trim().slice(0, LIMITE_TITULAR_CARTAO).trim(),
      bandeira: c.bandeira,
      numero: c.numero.replace(/\D/g, ""),
      validade: c.validade.trim(),
    };
  }
  const cc = pagamento.creditoEmConta;
  if (cc && creditoEmContaAtivo(cc)) {
    campos.creditoEmConta = {
      tipo: cc.opcao === "Sim, conta poupança" ? "poupanca" : "corrente",
      ...contaPayload(cc.conta),
    };
  }
  return campos;
}
