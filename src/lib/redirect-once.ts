/**
 * Produz uma chave apenas quando a transição ainda não foi iniciada.
 * Útil para efeitos de navegação em rotas que permanecem montadas durante o
 * carregamento do TanStack Router.
 */
export function proximaChaveRedirecionamento(
  partes: readonly string[],
  ultimaChave: string | null,
): string | null {
  const chave = partes.join("->");
  return chave === ultimaChave ? null : chave;
}

/** Libera retry de uma tentativa falha sem apagar uma transição posterior. */
export function limparChaveRedirecionamentoFalho(
  chaveAtual: string | null,
  chaveDaTentativa: string,
): string | null {
  return chaveAtual === chaveDaTentativa ? null : chaveAtual;
}
