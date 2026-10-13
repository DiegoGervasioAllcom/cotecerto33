/** Normaliza para comparação: sem acento, sem caixa, sem espaços nas pontas. */
export function normalizaTexto(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Match exato normalizado contra a lista; devolve o texto oficial ou null. */
export function acharOpcao(valor: string, options: readonly string[]): string | null {
  if (options.includes(valor)) return valor;
  const n = normalizaTexto(valor);
  return options.find((o) => normalizaTexto(o) === n) ?? null;
}

export function filtraOpcoes(options: readonly string[], busca: string): string[] {
  const n = normalizaTexto(busca);
  return n ? options.filter((o) => normalizaTexto(o).includes(n)) : [...options];
}
