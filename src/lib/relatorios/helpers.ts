export const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
    : "—";

export const fmtDateTime = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function mapById<T extends { id: string }>(rows: T[] | null | undefined): Record<string, T> {
  const map: Record<string, T> = {};
  for (const r of rows ?? []) map[r.id] = r;
  return map;
}

/** Teto de linhas por consulta — evita puxar volumes enormes de uma vez. */
export const LIMITE = 5000;

/** Se a consulta bateu no teto, devolve um aviso de truncamento para o resumo;
 * caso contrário `null`. Use com `.filter(Boolean)` ao montar o resumo. */
export const avisoTrunc = (n: number | null | undefined): string | null =>
  (n ?? 0) >= LIMITE
    ? `⚠ Resultado limitado a ${LIMITE} linhas — refine o período para ver tudo.`
    : null;
