/**
 * `cotacao_segurado`, `cotacao_veiculo` (e as demais "secções 1:1" do wizard
 * de cotação — ver `cotacao_id uuid primary key` em
 * `supabase/migrations/20240101000007_cotacoes.sql`) são 1:1 com `cotacoes`:
 * o PostgREST devolve o embed como OBJETO, nunca array — mesmo quando ele
 * está aninhado dentro de outro embed (ex.: `cotacao_transmissoes →
 * cotacoes → segurado`). Vários pontos do código tratavam esse embed como
 * array (`?.[0]`), o que sempre resultava em `undefined` (bug encontrado em
 * `em-finalizacao.tsx`, coluna Segurado/Veículo sempre "—").
 *
 * Esta função aceita as duas formas — objeto (formato real) ou,
 * defensivamente, array — para normalizar o acesso sem `any` e sem quebrar
 * se algum dia a FK deixar de ser 1:1.
 */
export function embed1a1<T>(valor: T | readonly T[] | null | undefined): T | null {
  if (valor == null) return null;
  return Array.isArray(valor) ? ((valor[0] ?? null) as T | null) : (valor as T);
}
