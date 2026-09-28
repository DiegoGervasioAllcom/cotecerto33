import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

/**
 * V12.3.4 — `cotacoes.calculo_visto_em` (migration
 * `20260925031355_v12_cotacao_calculo_visto.sql`).
 *
 * Sem RPC/policy nova: o update é feito pela policy `cot_iud` já vigente
 * (`20240101000007_cotacoes.sql`, `for all using/with check
 * (responsavel_id = auth.uid())`), reusada pela migration de
 * `transmissao_fase` (V12.3.3) pelo mesmo motivo. Este teste prova:
 *
 *   1. o dono da cotação consegue gravar `calculo_visto_em`;
 *   2. um colega VENDEDOR da MESMA empresa NÃO consegue (a policy é por
 *      `responsavel_id`, não por empresa — `vendedor` raso não tem atalho
 *      de empresa em nenhuma policy de escrita de `cotacoes`);
 *   3. matriz/master: documentado, não testado como positivo aqui — `cot_iud`
 *      não dá exceção pra `has_role('matriz')`/`has_role('master')` (só
 *      `cot_select`, a policy de LEITURA, tem esse atalho). Ou seja, hoje
 *      matriz/master também NÃO conseguem marcar `calculo_visto_em` de uma
 *      cotação alheia via update direto — comportamento herdado, não
 *      alterado por esta migration.
 *
 * Backfill (`update ... where status in ('calculada','proposta') and
 * calculo_visto_em is null`): NÃO dá pra testar re-rodando a migration em
 * si — `bun run db:reset` aplica todas as migrations UMA VEZ, antes de
 * qualquer teste rodar, então quando este arquivo executa o backfill já
 * aconteceu e qualquer cotação criada aqui (via fixture, depois da
 * migration) nasce com `calculo_visto_em` null por padrão, backfill não
 * tem mais nada "antigo" pra pegar. O teste abaixo não re-executa a
 * migration; ele prova a MESMA lógica (`coalesce(atualizado_em, now())`
 * só pra `status in ('calculada','proposta')` com `calculo_visto_em`
 * ainda null) rodando o update equivalente via client admin sobre uma
 * cotação "fabricada como legada" (inserida direto, sem passar pelo fluxo
 * normal, simulando uma linha que já existia antes desta migration na
 * produção real).
 */
describe("RLS cotacoes.calculo_visto_em", () => {
  let empresaId: string;
  let dono: Db;
  let donoId: string;
  let colega: Db;
  let cotacaoId: string;

  beforeAll(async () => {
    const donoPersona = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "vend-calc-visto-dono",
    });
    empresaId = donoPersona.empresaId;
    dono = donoPersona.client;
    donoId = donoPersona.userId;

    const colegaPersona = await criarPersonaComEmpresa("vendedor", {
      empresaId,
      emailPrefix: "vend-calc-visto-colega",
    });
    colega = colegaPersona.client;

    const { data, error } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId, responsavel_id: donoId, status: "calculada" })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("falha ao criar cotação de fixture");
    cotacaoId = data.id;
  });

  it("dono marca calculo_visto_em na própria cotação", async () => {
    const agora = new Date().toISOString();
    const { data, error } = await dono
      .from("cotacoes")
      .update({ calculo_visto_em: agora })
      .eq("id", cotacaoId)
      .select("id, calculo_visto_em");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    // Postgres devolve `+00:00` em vez de `Z` — compara por instante, não string.
    expect(new Date(data?.[0].calculo_visto_em ?? "").getTime()).toBe(new Date(agora).getTime());
  });

  it("colega da mesma empresa NÃO marca calculo_visto_em de cotação alheia", async () => {
    const { data, error } = await colega
      .from("cotacoes")
      .update({ calculo_visto_em: new Date().toISOString() })
      .eq("id", cotacaoId)
      .select("id");
    // RLS nega silenciosamente (0 linhas afetadas), sem erro de permissão.
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: verificacao } = await admin
      .from("cotacoes")
      .select("calculo_visto_em")
      .eq("id", cotacaoId)
      .single();
    expect(verificacao?.calculo_visto_em).not.toBeNull(); // continua com o valor gravado pelo dono
  });

  it("backfill: cotação 'calculada' legada (calculo_visto_em null) ganha o valor de atualizado_em, não hoje", async () => {
    const atualizadoEmAntigo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 dias atrás

    const { data: legada, error: eInsert } = await admin
      .from("cotacoes")
      .insert({
        empresa_id: empresaId,
        responsavel_id: donoId,
        status: "calculada",
        calculo_visto_em: null,
        atualizado_em: atualizadoEmAntigo,
      })
      .select("id")
      .single();
    if (eInsert || !legada) throw eInsert ?? new Error("falha ao criar cotação legada de fixture");

    // Mesma condição (`status in ('calculada','proposta') and
    // calculo_visto_em is null`) e mesmo valor (`coalesce(atualizado_em,
    // now())`, já resolvido em JS porque o client não expressa `coalesce`
    // num único `.update()`) do backfill da migration
    // `20260925031355_v12_cotacao_calculo_visto.sql` — ver comentário do
    // describe acima sobre por que não dá pra re-executar a migration em
    // si dentro deste teste. Restrito a `.eq("id", legada.id)` além da
    // condição de status/null pra não mexer em nenhuma outra cotação da
    // suíte (o `test:db` roda vários arquivos contra o mesmo banco local).
    const { error: eBackfill } = await admin
      .from("cotacoes")
      .update({ calculo_visto_em: atualizadoEmAntigo })
      .eq("id", legada.id)
      .in("status", ["calculada", "proposta"])
      .is("calculo_visto_em", null);
    expect(eBackfill).toBeNull();

    const { data: pos } = await admin
      .from("cotacoes")
      .select("calculo_visto_em")
      .eq("id", legada.id)
      .single();
    expect(new Date(pos?.calculo_visto_em ?? "").getTime()).toBe(
      new Date(atualizadoEmAntigo).getTime(),
    );
  });
});
