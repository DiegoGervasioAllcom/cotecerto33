import type { PostgrestError } from "@supabase/supabase-js";

/**
 * `.in()` do PostgREST manda a lista inteira na query string do GET — sem
 * paginar, uma base com muitos usuários (centenas de profiles/roles) gera uma
 * URL longa demais e o navegador recusa a requisição (`net::ERR_FAILED`),
 * silenciosamente: a query "funciona" mas devolve `data: null`, e quem chama
 * geralmente só olha `data`, não `error` — o resultado parece "zero
 * registros" em vez de "a busca falhou".
 *
 * `selectInBatches` corta a lista em lotes pequenos, dispara todos em
 * paralelo e junta o resultado. Se qualquer lote falhar, devolve o primeiro
 * erro — quem chama decide se mostra um banner ou ignora.
 */
const TAMANHO_LOTE = 100;

export async function selectInBatches<Linha>(
  valores: string[],
  consultarLote: (
    lote: string[],
  ) => PromiseLike<{ data: Linha[] | null; error: PostgrestError | null }>,
): Promise<{ data: Linha[]; error: PostgrestError | null }> {
  if (valores.length === 0) return { data: [], error: null };

  const lotes: string[][] = [];
  for (let i = 0; i < valores.length; i += TAMANHO_LOTE) {
    lotes.push(valores.slice(i, i + TAMANHO_LOTE));
  }

  const resultados = await Promise.all(lotes.map(consultarLote));
  const erro = resultados.find((r) => r.error)?.error ?? null;
  const linhas = resultados.flatMap((r) => r.data ?? []);
  return { data: linhas, error: erro };
}
