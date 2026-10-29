// Módulo compartilhado (cliente + servidor): campos da transmissão que só a Mapfre exige. Espelha o contrato do robô em
// `POST /transmissao` (`tipoDocumento`, `dataEmissaoRg`, `orgaoEmissorRg`, `ramoAtividade`, `rendaMensal`, `kitApolicePorEmail`,
// `certificadoEmNomeDe`, `contaDebito` + `cienteTitularConta`). Tipo de documento, data de emissão, órgão, ramo e renda são
// declarações do vendedor: SEM valor padrão. País de nascimento é fixo no robô. Sem RG (número), renavam nem cartão.
import { RAMOS_ATIVIDADE_MAPFRE } from "@/components/venda/novo-lead/enumsRamoAtividadeMapfre";
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";
import { validarContaDebito, bancosDaSeguradora, type ContaDebito } from "@/lib/transmissao-debito";

export const TIPOS_DOCUMENTO_MAPFRE = [
  "RG - REGISTRO GERAL",
  "RNE - REGISTRO NACIONAL DE ESTRANG.",
  "CPM - CARTEIRA DA POLICIA MILITAR",
  "IC - IDENTIDADE DE CLASSE",
  "CNH - CARTEIRA NACIONAL HABILITACAO",
  "IM - IDENTIDADE MILITAR",
  "CIE - IDENTIDADE DE ESTRANGEIRO",
  "PSP - PASSAPORTE",
] as const;

const UFS_SSP_MAPFRE = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "FN", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const; // prettier-ignore

export const ORGAOS_EMISSORES_MAPFRE: readonly string[] = [
  "MAE - MIN. DA AERONAUTICA",
  "MEX - MIN. DO EXERCITO",
  "MMA - MIN. DA MARINHA",
  "PF - POLICIA FEDERAL",
  ...UFS_SSP_MAPFRE.map((uf) => `SSP - ${uf}`),
];

export const RENDAS_MENSAIS_MAPFRE = [
  "Não Informado",
  "Até R$ 1.400,00",
  "Até R$ 3.500,00",
  "Até R$ 7.000,00",
  "Até R$ 10.000,00",
  "Até R$ 15.000,00",
  "Mais de R$ 15.000,00",
] as const;

export const AVISO_CARTAO_MAPFRE =
  "A Mapfre envia ao segurado um link por e-mail e WhatsApp para informar os dados do cartão após a efetivação. Confirme se o e-mail e o celular do segurado estão atualizados.";

export type DadosMapfre = {
  tipoDocumento?: string;
  dataEmissaoRg?: string;
  orgaoEmissorRg?: string;
  ramoAtividade?: string;
  rendaMensal?: string;
  kitApolicePorEmail?: "Sim" | "Não";
  certificadoEmNomeDe?: string;
};

export function ehSeguradoraMapfre(seguradora: string): boolean {
  return nomeCanonicoSeguradora(seguradora) === "mapfre";
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** "Débito em Conta" e "Débito c/ 1ª em Boleto": ambas pedem conta + aceite do titular. */
export function ehDebitoMapfre(seguradora: string, formaPagamento: string): boolean {
  return ehSeguradoraMapfre(seguradora) && normalizar(formaPagamento).startsWith("debito");
}

/** Cartão da Mapfre: sem campos no portal (o segurado recebe um link). */
export function ehCartaoMapfre(seguradora: string, formaPagamento: string): boolean {
  return ehSeguradoraMapfre(seguradora) && normalizar(formaPagamento).startsWith("cartao");
}

/** dd/mm/aaaa que existe no calendário e não é futura (`agora` injetável para teste). */
export function dataEmissaoValida(valor: string | undefined, agora: Date = new Date()): boolean {
  const m = (valor ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const data = new Date(a, mes - 1, d);
  if (data.getFullYear() !== a || data.getMonth() !== mes - 1 || data.getDate() !== d) return false;
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  return a >= 1900 && data <= hoje;
}

/** Erro por campo dos 5 obrigatórios da Mapfre ({} se tudo certo). Usado pelo schema e pelo servidor. */
export function errosDadosMapfre(
  dados: DadosMapfre | undefined,
  agora?: Date,
): Partial<
  Record<
    "tipoDocumento" | "dataEmissaoRg" | "orgaoEmissorRg" | "ramoAtividade" | "rendaMensal",
    string
  >
> {
  const d = dados ?? {};
  const erros: ReturnType<typeof errosDadosMapfre> = {};
  if (
    !d.tipoDocumento ||
    !(TIPOS_DOCUMENTO_MAPFRE as readonly string[]).includes(d.tipoDocumento)
  ) {
    erros.tipoDocumento = "Escolha o tipo de documento.";
  }
  if (!dataEmissaoValida(d.dataEmissaoRg, agora)) {
    erros.dataEmissaoRg = "Informe uma data de emissão válida (dd/mm/aaaa), não futura.";
  }
  if (!d.orgaoEmissorRg || !ORGAOS_EMISSORES_MAPFRE.includes(d.orgaoEmissorRg)) {
    erros.orgaoEmissorRg = "Escolha o órgão emissor.";
  }
  if (!d.ramoAtividade || !RAMOS_ATIVIDADE_MAPFRE.includes(d.ramoAtividade)) {
    erros.ramoAtividade = "Escolha o ramo de atividade na lista.";
  }
  if (!d.rendaMensal || !(RENDAS_MENSAIS_MAPFRE as readonly string[]).includes(d.rendaMensal)) {
    erros.rendaMensal = "Informe a faixa de renda.";
  }
  return erros;
}

/** Regra de bloqueio (servidor). Devolve a mensagem, ou `null` (também para outras seguradoras). */
export function erroDadosMapfre(seguradora: string, dados: DadosMapfre | undefined): string | null {
  if (!ehSeguradoraMapfre(seguradora)) return null;
  const primeiro = Object.values(errosDadosMapfre(dados))[0];
  if (primeiro) return `${primeiro} (exigido pela Mapfre)`;
  const k = dados?.kitApolicePorEmail;
  if (k !== undefined && k !== "Sim" && k !== "Não")
    return "Informe se o kit da apólice vai por e-mail.";
  return null;
}

export type CamposMapfrePayload = DadosMapfre;

/** Campos extras do payload — só Mapfre. Opcionais em branco ficam ausentes (o robô aplica o padrão dele). */
export function camposMapfrePayload(
  seguradora: string,
  dados: DadosMapfre | undefined,
): CamposMapfrePayload {
  if (!ehSeguradoraMapfre(seguradora) || !dados) return {};
  const c: CamposMapfrePayload = {};
  if (dados.tipoDocumento) c.tipoDocumento = dados.tipoDocumento;
  if (dados.dataEmissaoRg) c.dataEmissaoRg = dados.dataEmissaoRg;
  if (dados.orgaoEmissorRg) c.orgaoEmissorRg = dados.orgaoEmissorRg;
  if (dados.ramoAtividade) c.ramoAtividade = dados.ramoAtividade;
  if (dados.rendaMensal) c.rendaMensal = dados.rendaMensal;
  if (dados.kitApolicePorEmail) c.kitApolicePorEmail = dados.kitApolicePorEmail;
  const cert = dados.certificadoEmNomeDe?.trim();
  if (cert) c.certificadoEmNomeDe = cert;
  return c;
}

/** Pagamento da Mapfre: só o débito tem dados (conta + aceite). Cartão não envia nada. DADO SENSÍVEL: nunca persistir/logar. */
export type PagamentoMapfre = { contaDebito?: ContaDebito; cienteTitularConta?: boolean };

export function erroPagamentoMapfre(
  seguradora: string,
  formaPagamento: string,
  pagamento: PagamentoMapfre | undefined,
): string | null {
  if (!ehDebitoMapfre(seguradora, formaPagamento)) return null;
  const erros = validarContaDebito(pagamento?.contaDebito, bancosDaSeguradora(seguradora));
  const primeiro = erros.banco ?? erros.agencia ?? erros.conta;
  if (primeiro) return `Débito em conta: ${primeiro}`;
  if (pagamento?.cienteTitularConta !== true) {
    return "Débito em conta: confirme que o CPF/CNPJ pertence ao titular da conta.";
  }
  return null;
}

export function camposPagamentoMapfrePayload(
  seguradora: string,
  formaPagamento: string,
  pagamento: PagamentoMapfre | undefined,
): { contaDebito?: ContaDebito; cienteTitularConta?: true } {
  const c = pagamento?.contaDebito;
  if (!c || !ehDebitoMapfre(seguradora, formaPagamento)) return {};
  return {
    contaDebito: { banco: c.banco, agencia: c.agencia.trim(), conta: c.conta.trim() },
    cienteTitularConta: true,
  };
}
