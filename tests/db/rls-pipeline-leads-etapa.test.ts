import { describe, it, expect, beforeAll } from "vitest";
import { admin, anonClient, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

/**
 * RLS das views V12 `pipeline_leads_etapa`/`pipeline_resumo_etapas`
 * (migration `20260924162114_v12_pipeline_kanban_paginado.sql`), ambas
 * `security_invoker = true` sobre `public.leads` (+ `cotacoes`/
 * `cotacao_transmissoes`/`propostas`). Como as views não têm policy própria,
 * a visibilidade linha-a-linha é 100% herdada de `leads_select`
 * (`20260820000000_fix_leads_select_vazamento_vendedor_full.sql`):
 *
 *   responsavel_id = auth.uid()
 *   or has_role(auth.uid(), 'matriz')
 *   or (not has_role(auth.uid(), 'vendedor')
 *       and empresa_id in empresas_visiveis(auth.uid()))
 *   or (has_role(auth.uid(), 'interno') and empresa_id in fn_empresa_matriz())
 *
 * `vendedor` raso só enxerga via `responsavel_id = auth.uid()` (sem atalho de
 * empresa); `franqueado` (dono da empresa, papel de gestão, "not vendedor")
 * enxerga toda a empresa via `empresas_visiveis()`. Este arquivo prova que a
 * view não amplia nem restringe esse contrato — nem para leitura linha a
 * linha, nem para o agregado de `pipeline_resumo_etapas`.
 *
 * `anon`: sem grant nenhum, nem em `pipeline_leads_etapa`/`pipeline_resumo_etapas`
 * (a migration só concede `select` pra `authenticated`/`service_role`) nem em
 * `leads`/`cotacoes` por trás delas — confirmado via `psql` direto (`SET ROLE
 * anon`) que `anon` recebe `permission denied` (42501) tanto nas views quanto
 * em `leads`/`cotacoes`. É um erro de GRANT, não de RLS: `anon` nunca chega a
 * ter linha nenhuma avaliada pela policy. (Uma versão anterior deste comentário
 * dizia o contrário — lista vazia sem erro —, baseada num `\dp` rodado contra
 * um Supabase CLI local desatualizado, que dá defaults de privilégio mais
 * permissivos que o CLI real usado em CI/produção; corrigido depois de
 * reproduzir o bug real no CI. Ver comentário no teste de grants abaixo.)
 */
describe("RLS pipeline_leads_etapa / pipeline_resumo_etapas", () => {
  let empresaGestorA: string;
  let franqueadoGestorA: Db;
  let vendedorA: Db;
  let vendedorAId: string;
  let leadAId: string;

  let vendedorB: Db; // outra empresa, sem nenhuma relação com a rede A

  beforeAll(async () => {
    const franqueado = await criarPersonaComEmpresa("franqueado", {
      emailPrefix: "franq-pipeline-rls",
    });
    empresaGestorA = franqueado.empresaId;
    franqueadoGestorA = franqueado.client;

    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaGestorA,
      emailPrefix: "vend-pipeline-rls-a",
    });
    vendedorA = v1.client;
    vendedorAId = v1.userId;

    const vB = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-pipeline-rls-b" });
    vendedorB = vB.client;

    const { data: lead, error: eLead } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead Pipeline RLS A"),
        empresa_id: empresaGestorA,
        responsavel_id: vendedorAId,
        status_pipeline: "novo",
      })
      .select("id")
      .single();
    if (eLead || !lead) throw new Error(`criar lead: ${eLead?.message}`);
    leadAId = lead.id;

    const { error: eCot } = await admin.from("cotacoes").insert({
      empresa_id: empresaGestorA,
      responsavel_id: vendedorAId,
      lead_id: leadAId,
      status: "calculada", // EM_NEGOCIACAO_STATUSES -> etapa esperada 'negociacao'
    });
    if (eCot) throw new Error(`criar cotação: ${eCot.message}`);
  });

  it("POSITIVO: vendedor dono do lead lê a linha em pipeline_leads_etapa com a etapa certa", async () => {
    const { data, error } = await vendedorA
      .from("pipeline_leads_etapa")
      .select("lead_id,etapa")
      .eq("lead_id", leadAId)
      .single();
    expect(error).toBeNull();
    expect(data?.lead_id).toBe(leadAId);
    expect(data?.etapa).toBe("negociacao");
  });

  it("NEGATIVO: vendedor de outra empresa, sem relação de gestão, não vê a linha (retorna vazio, não erro)", async () => {
    const { data, error } = await vendedorB
      .from("pipeline_leads_etapa")
      .select("lead_id")
      .eq("lead_id", leadAId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("POSITIVO: franqueado (gestão da empresa, não responsável pelo lead) também lê a linha via empresas_visiveis()", async () => {
    const { data, error } = await franqueadoGestorA
      .from("pipeline_leads_etapa")
      .select("lead_id,etapa")
      .eq("lead_id", leadAId)
      .single();
    expect(error).toBeNull();
    expect(data?.lead_id).toBe(leadAId);
    expect(data?.etapa).toBe("negociacao");
  });

  describe("pipeline_resumo_etapas — agregado respeita a mesma RLS", () => {
    let vendedorC: Db;
    let vendedorD: Db; // empresa diferente de C, sem relação nenhuma

    beforeAll(async () => {
      const vC = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-resumo-rls-c" });
      vendedorC = vC.client;

      const vD = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-resumo-rls-d" });
      vendedorD = vD.client;

      // vendedor C: 2 leads sem cotação (etapa 'novo'), valor 1000 + 2000.
      const { error: eC1 } = await admin.from("leads").insert({
        nome: uniq("Lead Resumo C1"),
        responsavel_id: vC.userId,
        status_pipeline: "novo",
        valor: 1000,
      });
      if (eC1) throw new Error(`criar lead C1: ${eC1.message}`);
      const { error: eC2 } = await admin.from("leads").insert({
        nome: uniq("Lead Resumo C2"),
        responsavel_id: vC.userId,
        status_pipeline: "novo",
        valor: 2000,
      });
      if (eC2) throw new Error(`criar lead C2: ${eC2.message}`);

      // vendedor D: 1 lead perdido, valor 500 — empresa/rede totalmente diferente de C.
      const { error: eD1 } = await admin.from("leads").insert({
        nome: uniq("Lead Resumo D1"),
        responsavel_id: vD.userId,
        status_pipeline: "perdido",
        valor: 500,
      });
      if (eD1) throw new Error(`criar lead D1: ${eD1.message}`);
    });

    it("vendedor C só vê o próprio resumo: etapa 'novo' com total=2 e valor_total=3000, sem linha 'perdido' do vendedor D", async () => {
      const { data, error } = await vendedorC
        .from("pipeline_resumo_etapas")
        .select("etapa,total,valor_total");
      expect(error).toBeNull();
      const porEtapa = new Map((data ?? []).map((r) => [r.etapa, r]));

      const novo = porEtapa.get("novo");
      expect(novo?.total).toBe(2);
      expect(Number(novo?.valor_total)).toBe(3000);

      expect(porEtapa.has("perdido")).toBe(false);
    });

    it("vendedor D só vê o próprio resumo: etapa 'perdido' com total=1 e valor_total=500, sem contar os leads do vendedor C", async () => {
      const { data, error } = await vendedorD
        .from("pipeline_resumo_etapas")
        .select("etapa,total,valor_total");
      expect(error).toBeNull();
      const porEtapa = new Map((data ?? []).map((r) => [r.etapa, r]));

      const perdido = porEtapa.get("perdido");
      expect(perdido?.total).toBe(1);
      expect(Number(perdido?.valor_total)).toBe(500);

      expect(porEtapa.has("novo")).toBe(false);
    });
  });

  it("NEGATIVO: anon não consegue nem ler pipeline_leads_etapa nem pipeline_resumo_etapas (permission denied)", async () => {
    // CORREÇÃO (achado em CI, não no ambiente local): a versão anterior deste teste
    // assumia que `anon` recebia lista vazia com `error: null` (RLS filtrando em
    // silêncio), baseada num `\dp` rodado contra um Supabase CLI local desatualizado
    // (2.117.0, que dá defaults de privilégio mais permissivos que o CLI real usado
    // em CI/produção, pinado em 2.109.1 — ver .github/workflows/ci.yml). Com o CLI
    // correto, `anon` NÃO tem grant nenhum nem em `leads`/`cotacoes` (confirmado:
    // `anon.from("leads").select("id")` retorna 42501, não lista vazia) nem nas views
    // novas — que só têm `grant select` explícito pra `authenticated`/`service_role`
    // (migration desta frente). O resultado correto é "permission denied" (42501),
    // um erro de GRANT, não de RLS — porque `anon` nunca chega a ter linha nenhuma
    // avaliada pela policy, a permissão é negada antes disso.
    // Regra prática: nunca valide grant/RLS de objeto novo só com `test:db` local
    // sem antes confirmar que o Supabase CLI local bate com a versão pinada em CI.
    const anon = anonClient();

    const { error: e1 } = await anon.from("pipeline_leads_etapa").select("lead_id");
    expect(e1?.code).toBe("42501");

    const { error: e2 } = await anon.from("pipeline_resumo_etapas").select("etapa");
    expect(e2?.code).toBe("42501");
  });
});
