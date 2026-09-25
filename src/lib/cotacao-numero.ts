/**
 * Formatação do número real da cotação (`cotacoes.numero`), único ponto de
 * verdade usado por todas as telas que mostram `COT-AAAA-NNNNN`: barra de
 * contexto do Cálculo, comparativo lado a lado, listas de
 * cotação/negociação/finalização, aprovações e agenda. O ano é sempre o de
 * criação da cotação (`criado_em`), nunca o ano corrente — uma cotação criada
 * em 2025 continua `COT-2025-...` mesmo se olhada em 2026.
 */
const pad = (numero: number) => String(numero).padStart(5, "0");

/** `null` quando a cotação ainda não tem número real (rascunho não salvo ou
 * ainda carregando) — o chamador decide o texto de fallback ("—"). */
export function formatarNumeroCotacao(
  numero: number | null | undefined,
  criadoEm: string | null | undefined,
): string | null {
  if (numero == null || !criadoEm) return null;
  return `COT-${new Date(criadoEm).getFullYear()}-${pad(numero)}`;
}
