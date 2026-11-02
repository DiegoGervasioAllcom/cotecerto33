// Módulo compartilhado (cliente + servidor): campos da transmissão que só a Yelum exige. Espelha o contrato do robô em
// `POST /transmissao` (`ramoAtividade`, `rendaMensal`, `tipoLogradouro`, `cpfVendedor`, `veiculoAlienado`, `kitApolicePorEmail`,
// `contaDebito` + `cienteTitularConta`). Ramo, renda e tipo do logradouro são declarações do vendedor: SEM valor padrão.
// O `cpfVendedor` vem pré-preenchido com o CPF do perfil do vendedor logado (ele pode corrigir). Sem documento, órgão nem renavam.
//
// DADOS PESSOAIS/FINANCEIROS (CPF do vendedor, conta de débito): nunca persistidos, nunca logados, nunca em URL/erro; as mensagens
// de erro NUNCA repetem o valor recebido. O titular da conta do débito é sempre o próprio segurado (o robô lê da tela).
import { RAMOS_ATIVIDADE_YELUM } from "@/components/venda/novo-lead/enumsRamoAtividadeYelum";
import { cpfValido } from "@/lib/documento";
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";
import { bancosDaSeguradora, validarContaDebito, type ContaDebito } from "@/lib/transmissao-debito";
import { ehSeguradoraHdi } from "@/lib/transmissao-hdi";
import { tipoLogradouroDoEndereco } from "@/lib/transmissao-tokio";

export const RENDAS_MENSAIS_YELUM = [
  "ATE 1 SALARIO",
  "ATE 2 SALARIOS",
  "ATE 3 SALARIOS",
  "ATE 5 SALARIOS",
  "ATE 10 SALARIOS",
  "ATE 20 SALARIOS",
  "ACIMA DE 20 SALARIOS",
  "SEM RENDA",
] as const;

/** Tipos de logradouro do select da Yelum (texto exato do portal; o robô casa por igualdade normalizada). */
export const TIPOS_LOGRADOURO_YELUM = [
  "ACESSO",
  "ALAMEDA",
  "ALTO",
  "AVENIDA",
  "ESTRADA",
  "LADEIRA",
  "LARGO",
  "PARQUE",
  "PRACA",
  "QUADRA",
  "RUA",
  "VALE",
  "VIA",
  "VIADUTO",
  "VIELA",
  "VILA",
] as const;

export const AVISO_CARTAO_YELUM =
  "A seguradora não pede os dados do cartão na transmissão. A cobrança no cartão é combinada diretamente com o segurado pela seguradora.";
export const AVISO_CONTA_DO_SEGURADO = "A conta deve ser do próprio segurado.";
export const ERRO_CONTA_SEM_DIGITO = "Informe a conta com o dígito, ex.: 12345-6";

export type DadosYelum = {
  ramoAtividade?: string;
  rendaMensal?: string;
  tipoLogradouro?: string;
  cpfVendedor?: string;
  veiculoAlienado?: "Sim" | "Não";
  kitApolicePorEmail?: "Sim" | "Não";
};

export function ehSeguradoraYelum(seguradora: string): boolean {
  return nomeCanonicoSeguradora(seguradora) === "yelum";
}

/** Família da Efetivação compartilhada: Yelum e Aliro (mesmos campos e listas; a Aliro não tem CPF do vendedor). */
export function ehFamiliaYelum(seguradora: string): boolean {
  const s = nomeCanonicoSeguradora(seguradora);
  return s === "yelum" || s === "aliro";
}

/** Pagamento compartilhado (débito com dígito + aceite, cartão sem dados): Yelum, Aliro e HDI. */
export function ehPagamentoFamiliaYelum(seguradora: string): boolean {
  return ehFamiliaYelum(seguradora) || ehSeguradoraHdi(seguradora);
}

/** Nome para mensagens ao usuário. */
export function nomeFamiliaYelum(seguradora: string): string {
  return nomeCanonicoSeguradora(seguradora) === "aliro" ? "Aliro" : "Yelum";
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Formas que contêm "Débito" (Débito em Conta, Boleto + Débito em Conta, PIX + Débito em conta). */
export function ehDebitoYelum(seguradora: string, formaPagamento: string): boolean {
  return ehPagamentoFamiliaYelum(seguradora) && normalizar(formaPagamento).includes("debito");
}

/** Formas que contêm "Cartão" (Cartão de Crédito, Boleto + Cartão de Crédito): o portal não pede dados de cartão. */
export function ehCartaoYelum(seguradora: string, formaPagamento: string): boolean {
  return ehPagamentoFamiliaYelum(seguradora) && normalizar(formaPagamento).includes("cartao");
}

/** Pré-seleção do tipo de logradouro: só devolve o valor se casar (sem acento/caixa) com uma das 16 opções da Yelum. */
export function tipoLogradouroYelumDoEndereco(logradouro: string | undefined): string | undefined {
  const t = tipoLogradouroDoEndereco(logradouro);
  if (!t) return undefined;
  const alvo = normalizar(t);
  return TIPOS_LOGRADOURO_YELUM.find((o) => normalizar(o) === alvo);
}

/** Só dígitos do CPF (11) ou string vazia. */
export function cpfVendedorDigitos(valor: string | undefined | null): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** Erro por campo dos 4 obrigatórios da Yelum ({} se tudo certo). Usado pelo schema e pelo servidor. */
export function errosDadosYelum(
  dados: DadosYelum | undefined,
  exigeCpfVendedor = true,
): Partial<Record<"ramoAtividade" | "rendaMensal" | "tipoLogradouro" | "cpfVendedor", string>> {
  const d = dados ?? {};
  const erros: ReturnType<typeof errosDadosYelum> = {};
  if (!d.ramoAtividade || !RAMOS_ATIVIDADE_YELUM.includes(d.ramoAtividade)) {
    erros.ramoAtividade = "Escolha o ramo de atividade na lista.";
  }
  if (!d.rendaMensal || !(RENDAS_MENSAIS_YELUM as readonly string[]).includes(d.rendaMensal)) {
    erros.rendaMensal = "Informe a faixa de renda.";
  }
  if (
    !d.tipoLogradouro ||
    !(TIPOS_LOGRADOURO_YELUM as readonly string[]).includes(d.tipoLogradouro)
  ) {
    erros.tipoLogradouro = "Escolha o tipo de logradouro.";
  }
  if (exigeCpfVendedor && (typeof d.cpfVendedor !== "string" || !cpfValido(d.cpfVendedor))) {
    erros.cpfVendedor = "Informe um CPF válido do vendedor.";
  }
  return erros;
}

/** Regra de bloqueio (servidor). Devolve a mensagem, ou `null` (também para outras seguradoras). */
export function erroDadosYelum(seguradora: string, dados: DadosYelum | undefined): string | null {
  if (!ehFamiliaYelum(seguradora)) return null;
  const primeiro = Object.values(errosDadosYelum(dados, ehSeguradoraYelum(seguradora)))[0];
  if (primeiro) return `${primeiro} (exigido pela ${nomeFamiliaYelum(seguradora)})`;
  const k = dados?.kitApolicePorEmail;
  if (k !== undefined && k !== "Sim" && k !== "Não")
    return "Informe se o kit da apólice vai por e-mail.";
  const v = dados?.veiculoAlienado;
  if (v !== undefined && v !== "Sim" && v !== "Não") return "Informe se o veículo é alienado.";
  return null;
}

/** Campos extras do payload — só Yelum. `cpfVendedor` só com dígitos; opcionais em branco ficam ausentes. */
export function camposYelumPayload(
  seguradora: string,
  dados: DadosYelum | undefined,
  alienadoCadastro?: boolean | null,
): DadosYelum {
  if (!ehFamiliaYelum(seguradora) || !dados) return {};
  const c: DadosYelum = {};
  if (dados.ramoAtividade) c.ramoAtividade = dados.ramoAtividade;
  if (dados.rendaMensal) c.rendaMensal = dados.rendaMensal;
  if (dados.tipoLogradouro) c.tipoLogradouro = dados.tipoLogradouro;
  const cpf = ehSeguradoraYelum(seguradora) ? cpfVendedorDigitos(dados.cpfVendedor) : "";
  if (cpf) c.cpfVendedor = cpf;
  c.veiculoAlienado = dados.veiculoAlienado ?? (alienadoCadastro ? "Sim" : "Não");
  if (dados.kitApolicePorEmail) c.kitApolicePorEmail = dados.kitApolicePorEmail;
  return c;
}

/** Conta do débito da Yelum: banco, agência (1–6 dígitos) e conta COM o dígito ("NNNNN-D"). Sem dígito da agência. */
export type ContaYelum = ContaDebito;
export type ErrosContaYelum = Partial<Record<keyof ContaYelum, string>>;

/** Pagamento da Yelum: só o débito tem dados (conta + aceite). Cartão não envia nada. DADO SENSÍVEL: nunca persistir/logar. */
export type PagamentoYelum = { contaDebito?: ContaYelum; cienteTitularConta?: boolean };

const REGEX_CONTA_YELUM = /^\d{1,9}-[\dxX]$/; // o campo do portal aceita 11 caracteres

export function validarContaYelum(
  conta: Partial<ContaYelum> | undefined,
  seguradora = "yelum",
): ErrosContaYelum {
  const erros: ErrosContaYelum = validarContaDebito(conta, bancosDaSeguradora(seguradora));
  delete erros.conta; // a regra da conta da Yelum é própria (dígito obrigatório)
  if (typeof conta?.conta !== "string" || !REGEX_CONTA_YELUM.test(conta.conta.trim())) {
    erros.conta = ERRO_CONTA_SEM_DIGITO;
  }
  return erros;
}

export function erroPagamentoYelum(
  seguradora: string,
  formaPagamento: string,
  pagamento: PagamentoYelum | undefined,
): string | null {
  if (!ehDebitoYelum(seguradora, formaPagamento)) return null;
  const erros = validarContaYelum(pagamento?.contaDebito, seguradora);
  const primeiro = erros.banco ?? erros.agencia ?? erros.conta;
  if (primeiro) return `Débito em conta: ${primeiro}`;
  if (pagamento?.cienteTitularConta !== true) {
    return "Débito em conta: confirme que o CPF/CNPJ pertence ao titular da conta.";
  }
  return null;
}

/** Só o débito leva conta + aceite; nunca `cartao` nem `agenciaDv`. */
export function camposPagamentoYelumPayload(
  seguradora: string,
  formaPagamento: string,
  pagamento: PagamentoYelum | undefined,
): { contaDebito?: ContaYelum; cienteTitularConta?: true } {
  const c = pagamento?.contaDebito;
  if (!c || !ehDebitoYelum(seguradora, formaPagamento)) return {};
  return {
    contaDebito: { banco: c.banco, agencia: c.agencia.trim(), conta: c.conta.trim() },
    cienteTitularConta: true,
  };
}
