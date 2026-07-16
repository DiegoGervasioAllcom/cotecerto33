import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

/**
 * RLS de `leads` (maior risco de vazamento de pipeline entre redes) + a mesma
 * policy replicada em `clientes`/`oportunidades` + o caso especial de `propostas`
 * (policy dupla: leitura mais aberta que escrita).
 *
 * Policies (20240101000001_init.sql, loop ~L279-322, aplicado a leads/clientes/
 * oportunidades/propostas):
 *  - "<t>_select": matriz OU empresa_id in empresas_visiveis(auth.uid()) OU
 *    (somente para leads) responsavel_id = auth.uid().
 *  - "<t>_insert"/"<t>_update"/"<t>_delete": matriz OU empresa_id in empresas_visiveis(auth.uid())
 *    — sem o atalho de responsavel_id (só select tem esse atalho para leads).
 *
 * `propostas` tem policy ADICIONAL (20240101000009_venda_real.sql, prop_select/prop_iud)
 * de SELECT/ALL. As policies legadas do loop ("propostas_select/insert/update/delete",
 * herdadas do init.sql) foram dropadas por 20260714190228_fix_propostas_rls_iud_only.sql
 * — hoje só `prop_select` (leitura por responsavel_id/empresa/matriz/master) e
 * `prop_iud` (escrita só pelo responsavel_id ou matriz) governam a tabela. Os testes
 * abaixo provam que a escrita ficou restrita ao responsável (ou matriz): colega de
 * empresa consegue LER mas não EDITAR proposta alheia; o próprio responsável edita
 * normalmente; usuário de outra empresa continua bloqueado.
 */
describe("RLS leads/clientes/oportunidades/propostas — visibilidade por rede", () => {
  let empresaFilhaA: string;
  let vendedorA: Db;
  let vendedorAId: string;
  let vendedorA2: Db; // colega de empresa (mesma filhaA)

  let masterA: Db;

  let empresaB: string;
  let vendedorB: Db; // outra empresa, sem relação com a rede A

  let leadEmpresaA: string;
  let leadResponsavelA: string; // lead sem empresa, só com responsavel_id=vendedorA
  let leadEmpresaB: string;

  let clienteA: string;
  let clienteB: string;

  let oportunidadeA: string;
  let oportunidadeB: string;

  let propostaA: string;

  beforeAll(async () => {
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-a" });
    masterA = master.client;
    const masterAId = master.userId;
    const empresaMasterA = master.empresaId;

    const filha = await criarEmpresa({ nome: "Filha Pipeline A", parent_id: empresaMasterA });
    empresaFilhaA = filha.id;

    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaFilhaA,
      emailPrefix: "vend-pipe-a",
      superiorId: masterAId,
    });
    vendedorA = v1.client;
    vendedorAId = v1.userId;

    const v2 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaFilhaA,
      emailPrefix: "vend-pipe-a2",
      superiorId: masterAId,
    });
    vendedorA2 = v2.client;

    const franqB = await criarPersonaComEmpresa("franqueado", { emailPrefix: "franq-pipe-b" });
    empresaB = franqB.empresaId;

    const vB = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaB,
      emailPrefix: "vend-pipe-b",
    });
    vendedorB = vB.client;

    // ---- leads ----
    const { data: leadA, error: eLA } = await admin
      .from("leads")
      .insert({ nome: uniq("Lead Empresa A"), origem: "teste", empresa_id: empresaFilhaA })
      .select("id")
      .single();
    if (eLA) throw eLA;
    leadEmpresaA = leadA.id;

    const { data: leadResp, error: eLR } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead Responsavel A"),
        origem: "teste",
        responsavel_id: vendedorAId,
      })
      .select("id")
      .single();
    if (eLR) throw eLR;
    leadResponsavelA = leadResp.id;

    const { data: leadB, error: eLB } = await admin
      .from("leads")
      .insert({ nome: uniq("Lead Empresa B"), origem: "teste", empresa_id: empresaB })
      .select("id")
      .single();
    if (eLB) throw eLB;
    leadEmpresaB = leadB.id;

    // ---- clientes ----
    const { data: cA, error: eCA } = await admin
      .from("clientes")
      .insert({ nome: uniq("Cliente A"), empresa_id: empresaFilhaA })
      .select("id")
      .single();
    if (eCA) throw eCA;
    clienteA = cA.id;

    const { data: cB, error: eCB } = await admin
      .from("clientes")
      .insert({ nome: uniq("Cliente B"), empresa_id: empresaB })
      .select("id")
      .single();
    if (eCB) throw eCB;
    clienteB = cB.id;

    // ---- oportunidades ----
    const { data: oA, error: eOA } = await admin
      .from("oportunidades")
      .insert({ empresa_id: empresaFilhaA })
      .select("id")
      .single();
    if (eOA) throw eOA;
    oportunidadeA = oA.id;

    const { data: oB, error: eOB } = await admin
      .from("oportunidades")
      .insert({ empresa_id: empresaB })
      .select("id")
      .single();
    if (eOB) throw eOB;
    oportunidadeB = oB.id;

    // ---- proposta (dono = vendedorA, empresa = filhaA) ----
    const { data: pA, error: ePA } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaFilhaA, responsavel_id: vendedorAId, status: "gerada" })
      .select("id")
      .single();
    if (ePA) throw ePA;
    propostaA = pA.id;
  });

  it("POSITIVO: vendedor vê lead da própria empresa e lead onde é responsavel_id", async () => {
    const { data, error } = await vendedorA
      .from("leads")
      .select("id")
      .in("id", [leadEmpresaA, leadResponsavelA]);
    expect(error).toBeNull();
    const ids = new Set((data ?? []).map((l) => l.id));
    expect(ids).toEqual(new Set([leadEmpresaA, leadResponsavelA]));
  });

  it("NEGATIVO: vendedor não vê lead da rede B", async () => {
    const { data, error } = await vendedorA.from("leads").select("id").eq("id", leadEmpresaB);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("POSITIVO: master vê a rede (lead da franquia filha)", async () => {
    const { data, error } = await masterA.from("leads").select("id").eq("id", leadEmpresaA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("NEGATIVO: master não vê lead de rede alheia", async () => {
    const { data, error } = await masterA.from("leads").select("id").eq("id", leadEmpresaB);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("NEGATIVO: insert de lead com empresa_id de outra rede é bloqueado", async () => {
    const { error } = await vendedorA
      .from("leads")
      .insert({ nome: uniq("Lead Invasor"), origem: "teste", empresa_id: empresaB });
    expect(error).not.toBeNull();
  });

  it("NEGATIVO: update de lead de rede alheia é bloqueado", async () => {
    const { data, error } = await vendedorA
      .from("leads")
      .update({ nome: "Nome Forjado" })
      .eq("id", leadEmpresaB)
      .select("nome");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: real } = await admin.from("leads").select("nome").eq("id", leadEmpresaB).single();
    expect(real?.nome).not.toBe("Nome Forjado");
  });

  it("POSITIVO: vendedor vê cliente da própria empresa", async () => {
    const { data, error } = await vendedorA.from("clientes").select("id").eq("id", clienteA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("NEGATIVO: vendedor não vê cliente da rede B", async () => {
    const { data, error } = await vendedorA.from("clientes").select("id").eq("id", clienteB);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("POSITIVO: vendedor vê oportunidade da própria empresa", async () => {
    const { data, error } = await vendedorA
      .from("oportunidades")
      .select("id")
      .eq("id", oportunidadeA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("NEGATIVO: vendedor não vê oportunidade da rede B", async () => {
    const { data, error } = await vendedorA
      .from("oportunidades")
      .select("id")
      .eq("id", oportunidadeB);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("POSITIVO: colega de empresa LÊ a proposta via prop_select (mesma empresa)", async () => {
    const { data, error } = await vendedorA2.from("propostas").select("id").eq("id", propostaA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("NEGATIVO: colega de empresa (não-responsável) NÃO edita a proposta alheia — só prop_iud vale (responsavel_id ou matriz)", async () => {
    const { data, error } = await vendedorA2
      .from("propostas")
      .update({ status: "transmitida" })
      .eq("id", propostaA)
      .select("status");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: real } = await admin
      .from("propostas")
      .select("status")
      .eq("id", propostaA)
      .single();
    expect(real?.status).toBe("gerada");
  });

  it("POSITIVO: o responsável edita a própria proposta", async () => {
    const { data, error } = await vendedorA
      .from("propostas")
      .update({ status: "transmitida" })
      .eq("id", propostaA)
      .select("status");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.status).toBe("transmitida");

    // restaura para não vazar estado para outros testes
    await admin.from("propostas").update({ status: "gerada" }).eq("id", propostaA);
  });

  it("NEGATIVO: vendedor de OUTRA empresa não edita a proposta (fora de empresas_visiveis e de prop_iud)", async () => {
    const { data, error } = await vendedorB
      .from("propostas")
      .update({ status: "transmitida" })
      .eq("id", propostaA)
      .select("status");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: real } = await admin
      .from("propostas")
      .select("status")
      .eq("id", propostaA)
      .single();
    expect(real?.status).toBe("gerada");
  });
});
