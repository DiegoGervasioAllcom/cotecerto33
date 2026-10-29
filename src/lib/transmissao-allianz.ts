// Módulo compartilhado (cliente + servidor): campos da transmissão que só a Allianz exige. Espelha o contrato do robô em
// `POST /transmissao` (`rendaMensal`, `ramoAtividade`, `veiculoAlienado`, `diaVencimentoDemaisParcelas`) e o mapa de DOM da
// Efetivação da Allianz (ao vivo em 29/10/2026, só leitura: sem RG, renavam, cor, PEP nem tipo de logradouro).
import { RENDAS_MENSAIS_ALLIANZ } from "@/components/venda/novo-lead/enumsPorto";
import { RAMOS_ATIVIDADE_ALLIANZ } from "@/components/venda/novo-lead/enumsRamoAtividadeAllianz";
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";

export type DadosAllianz = {
  rendaMensal?: string;
  ramoAtividade?: string;
  /** "Veículo Alienado": do cadastro do veículo; o vendedor pode corrigir. */
  veiculoAlienado?: "Sim" | "Não";
  diaVencimentoDemaisParcelas?: string;
};

export type CamposAllianzPayload = {
  rendaMensal?: string;
  ramoAtividade?: string;
  veiculoAlienado?: "Sim" | "Não";
  diaVencimentoDemaisParcelas?: string;
};

export function ehSeguradoraAllianz(seguradora: string): boolean {
  return nomeCanonicoSeguradora(seguradora) === "allianz";
}

/** `À vista` não gera o dia de vencimento; qualquer parcelamento (2x…) sim. */
export function ehParcelado(parcelas: string | undefined): boolean {
  const p = (parcelas ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return p.trim() !== "" && !p.includes("vista") && /\d+\s*x/.test(p);
}

/**
 * Produto que o robô confere na tela de Confirmação. Na Allianz o cabeçalho é "Confirmação <PLANO>" ("Básico" /
 * "Incêndio, Roubo e Furto") = `nome` do card; o campo `produto` do card vem errado ("Ampliado") nas Compreensivas.
 * Nas demais seguradoras mantém `produto ?? nome`.
 */
export function produtoDaOferta(
  seguradora: string,
  produto: string | null | undefined,
  nome: string | null | undefined,
): string | undefined {
  const escolhido = ehSeguradoraAllianz(seguradora) ? nome || produto : produto || nome;
  return escolhido?.trim() || undefined;
}

/**
 * Regra de bloqueio (servidor) da Allianz: renda (faixas da Allianz), ramo (lista fechada), veículo alienado e, no
 * parcelado, o dia de vencimento das demais parcelas. Devolve a mensagem de erro, ou `null` (também para outras seguradoras).
 */
export function erroDadosAllianz(
  seguradora: string,
  dados: DadosAllianz | undefined,
  parcelas: string | undefined,
): string | null {
  if (!ehSeguradoraAllianz(seguradora)) return null;
  const d = dados ?? {};
  if (!d.rendaMensal || !(RENDAS_MENSAIS_ALLIANZ as readonly string[]).includes(d.rendaMensal)) {
    return "Informe a faixa de renda do segurado (exigida pela Allianz).";
  }
  if (!d.ramoAtividade || !RAMOS_ATIVIDADE_ALLIANZ.includes(d.ramoAtividade)) {
    return "Escolha o ramo de atividade na lista (exigido pela Allianz).";
  }
  if (
    d.veiculoAlienado !== undefined &&
    d.veiculoAlienado !== "Sim" &&
    d.veiculoAlienado !== "Não"
  ) {
    return "Informe se o veículo é alienado (Sim ou Não).";
  }
  if (
    ehParcelado(parcelas) &&
    !/^(?:[1-9]|[12]\d|3[01])$/.test((d.diaVencimentoDemaisParcelas ?? "").trim())
  ) {
    return "Informe o dia de vencimento das demais parcelas (exigido pela Allianz no parcelado).";
  }
  return null;
}

/** Campos extras do payload — só para a Allianz. O robô aplica seus padrões ao que faltar (alienado "Não"). */
export function camposAllianzPayload(
  seguradora: string,
  dados: DadosAllianz | undefined,
  alienadoCadastro?: boolean | null,
): CamposAllianzPayload {
  if (!ehSeguradoraAllianz(seguradora)) return {};
  const campos: CamposAllianzPayload = {};
  if (dados?.rendaMensal) campos.rendaMensal = dados.rendaMensal;
  if (dados?.ramoAtividade) campos.ramoAtividade = dados.ramoAtividade;
  campos.veiculoAlienado = dados?.veiculoAlienado ?? (alienadoCadastro ? "Sim" : "Não");
  return campos;
}
