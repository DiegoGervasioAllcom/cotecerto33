import { ocultarNumerosLongos } from "@/lib/transmissao-pagamento";

/** Motivo gravado em `cotacao_transmissoes` quando o robô só simulou (nada foi enviado ao portal). */
export const MOTIVO_SIMULACAO = "SIMULACAO";

/**
 * Chave de simulação do ambiente (`SELF_QUIVER_TRANSMISSAO_SIMULACAO`): só o
 * valor exato "1" liga. Devolve o campo a espalhar no payload de
 * `POST /transmissao`. A chave só pode IMPEDIR a transmissão — qualquer outro
 * valor (vazio, "true", "0") deixa o payload exatamente como era.
 */
export function campoSimulacao(valor: string | undefined): { simulacao?: true } {
  return valor?.trim() === "1" ? { simulacao: true } : {};
}

const ROTULOS: [string, string][] = [
  ["seguradora", "Seguradora"],
  ["produto", "Produto"],
  ["produtoId", "Código do produto"],
  ["formaPagamento", "Forma de pagamento"],
  ["franquia", "Franquia"],
  ["parcelas", "Parcelas"],
];

const MAX_CAMPO = 120;
const MAX_NOMES = 30;

/**
 * Texto do resultado de uma simulação: mensagem do robô + o relatório do que
 * foi pedido (só campos conhecidos, truncados) e os NOMES dos campos
 * informados — nunca valores. O robô já não manda dado pessoal no relatório;
 * aqui é uma segunda barreira (lista fechada, tamanho e sequências longas de
 * dígitos ocultas). Devolve `null` se o payload não for de simulação.
 */
export function montarMensagemSimulacao(payload: Record<string, unknown>): string | null {
  if (payload.motivo !== MOTIVO_SIMULACAO) return null;
  const base =
    typeof payload.mensagem === "string" && payload.mensagem.trim()
      ? payload.mensagem.trim().slice(0, 300)
      : "Simulação: nada foi enviado nem transmitido.";
  const rel = payload.relatorio;
  if (!rel || typeof rel !== "object") return ocultarNumerosLongos(base);

  const r = rel as Record<string, unknown>;
  const partes: string[] = [];
  for (const [chave, rotulo] of ROTULOS) {
    const v = r[chave];
    if (typeof v === "string" && v.trim())
      partes.push(`${rotulo}: ${v.trim().slice(0, MAX_CAMPO)}`);
  }
  if (Array.isArray(r.camposInformados)) {
    const nomes = r.camposInformados
      .filter((n): n is string => typeof n === "string" && /^[A-Za-z]{1,40}$/.test(n))
      .slice(0, MAX_NOMES);
    if (nomes.length) partes.push(`Campos preenchidos: ${nomes.join(", ")}`);
  }
  const dados: string[] = [];
  if (r.comCartao === true) dados.push("cartão");
  if (r.comContaDebito === true) dados.push("conta de débito");
  if (r.comPagador === true) dados.push("pagador");
  if (dados.length) partes.push(`Dados sensíveis enviados ao formulário: ${dados.join(", ")}`);

  return ocultarNumerosLongos(partes.length ? `${base} ${partes.join(" · ")}.` : base);
}

/** Recurso que o `/health` do robô anuncia quando aceita `simulacao: true`. */
export const RECURSO_SIMULACAO = "transmissao-simulacao";

/**
 * Um robô SEM o modo simulação ignora `simulacao: true` e transmite de
 * verdade. Por isso, antes de pedir simulação, o `/health` do robô precisa
 * anunciar o recurso. Qualquer resposta que não o confirme (campo ausente,
 * formato inesperado, erro) conta como NÃO suportado.
 */
export function roboSuportaSimulacao(corpoHealth: unknown): boolean {
  if (!corpoHealth || typeof corpoHealth !== "object") return false;
  const recursos = (corpoHealth as { recursos?: unknown }).recursos;
  return Array.isArray(recursos) && recursos.includes(RECURSO_SIMULACAO);
}
