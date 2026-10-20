// Módulo compartilhado (cliente + servidor): campos da transmissão que só a Tokio exige. Espelha o
// contrato do robô em `POST /transmissao` (`vencimentoPrimeiraParcela`, `telefoneResidencial`, `produto`)
// e o mapa de DOM da Efetivação da Tokio (validada ao vivo em 19/10/2026 até a tela de Confirmação).
import { PEP_PORTO, RENDAS_MENSAIS_TOKIO } from "@/components/venda/novo-lead/enumsPorto";
import { nomeCanonicoSeguradora } from "@/lib/seguradora-canonica";
import { erroTelefoneFixo, telefoneFixoPayload, type TelefoneFixo } from "@/lib/telefone-fixo";

export type DadosTokio = {
  rendaMensal?: string;
  pessoaPoliticamenteExposta?: string;
  /** DD/MM/AAAA. */
  vencimentoPrimeiraParcela?: string;
  // Telefone residencial FIXO (opcional): vazio = o robô repete o celular do segurado (o portal exige o campo).
  dddTelefoneResidencial?: string;
  telefoneResidencial?: string;
};

export type CamposTokioPayload = {
  rendaMensal?: string;
  pessoaPoliticamenteExposta?: string;
  vencimentoPrimeiraParcela?: string;
  telefoneResidencial?: TelefoneFixo;
};

/** O portal aceita só a data da regra dele ("deve estar entre X e Y"); observado: hoje + 7 dias. */
export const DIAS_VENCIMENTO_TOKIO = 7;

export function ehSeguradoraTokio(seguradora: string): boolean {
  return nomeCanonicoSeguradora(seguradora) === "tokio";
}

/** `AAAAMMDD` (número) de uma data no fuso de São Paulo — o do portal. */
function ymdSp(data: Date): number {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(data);
  return Number(p.replace(/-/g, ""));
}

/** `dd/mm/aaaa` de hoje + `dias`, no fuso de São Paulo. */
export function dataEmDiasSp(dias: number, agora: Date = new Date()): string {
  const d = new Date(agora.getTime() + dias * 86_400_000);
  const p = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("day")}/${g("month")}/${g("year")}`;
}

export function vencimentoPadraoTokio(agora: Date = new Date()): string {
  return dataEmDiasSp(DIAS_VENCIMENTO_TOKIO, agora);
}

/** Obrigatório; `DD/MM/AAAA` real e não passado (hoje em São Paulo). A mensagem nunca repete o valor. */
export function erroVencimentoTokio(
  valor: string | undefined,
  agora: Date = new Date(),
): string | null {
  const v = (valor ?? "").trim();
  if (!v) return "Informe o vencimento da parcela (exigido pela Tokio).";
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  const d = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
  const real = !!m && !!d && d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1;
  if (!real) return "Use o vencimento no formato dd/mm/aaaa, com uma data real.";
  if (Number(`${m![3]}${m![2]}${m![1]}`) < ymdSp(agora))
    return "O vencimento não pode ser uma data passada.";
  return null;
}

/**
 * Regra de bloqueio (servidor) da Tokio: renda e PEP (opções do portal), vencimento e telefone fixo
 * (opcional). O `produto` ("Auto" / "Auto Clássico") é obrigatório: o robô o confere na Confirmação por
 * igualdade exata. Devolve a mensagem de erro, ou `null` (também para outras seguradoras).
 */
export function erroDadosTokio(
  seguradora: string,
  produto: string | undefined,
  dados: DadosTokio | undefined,
  agora: Date = new Date(),
): string | null {
  if (!ehSeguradoraTokio(seguradora)) return null;
  if (!produto?.trim())
    return "Produto da Tokio não identificado (Auto ou Auto Clássico) — refaça o cálculo.";
  const d = dados ?? {};
  if (!d.rendaMensal || !(RENDAS_MENSAIS_TOKIO as readonly string[]).includes(d.rendaMensal)) {
    return "Informe a renda mensal do segurado (exigida pela Tokio).";
  }
  if (
    !d.pessoaPoliticamenteExposta ||
    !(PEP_PORTO as readonly string[]).includes(d.pessoaPoliticamenteExposta)
  ) {
    return "Informe se o segurado é pessoa politicamente exposta (exigido pela Tokio).";
  }
  return (
    erroVencimentoTokio(d.vencimentoPrimeiraParcela, agora) ??
    erroTelefoneFixo(d.dddTelefoneResidencial, d.telefoneResidencial, "residencial")
  );
}

/** Campos extras do payload — só para a Tokio. Vazio/inválido não vai (o robô aplica seus padrões). */
export function camposTokioPayload(
  seguradora: string,
  dados: DadosTokio | undefined,
): CamposTokioPayload {
  if (!ehSeguradoraTokio(seguradora) || !dados) return {};
  const campos: CamposTokioPayload = {};
  if (dados.rendaMensal) campos.rendaMensal = dados.rendaMensal;
  if (dados.pessoaPoliticamenteExposta)
    campos.pessoaPoliticamenteExposta = dados.pessoaPoliticamenteExposta;
  if (dados.vencimentoPrimeiraParcela?.trim()) {
    campos.vencimentoPrimeiraParcela = dados.vencimentoPrimeiraParcela.trim();
  }
  const residencial = telefoneFixoPayload(dados.dddTelefoneResidencial, dados.telefoneResidencial);
  if (residencial) campos.telefoneResidencial = residencial;
  return campos;
}
