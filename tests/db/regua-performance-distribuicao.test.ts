/**
 * V11 · D5 (Frente 4) — travado com pausa ativa não recebe lead, nem na
 * distribuição automática (trigger) nem na fila manual.
 *
 * Mesmo padrão determinístico de tests/db/distribuicao-lead.test.ts: UF fixa
 * (AC) + cidade única por teste, pra ser a única empresa elegível pelo
 * critério "região".
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, loginMatriz, criarUsuario, uniq, uniqDoc, type Db } from "../helpers/supabase";

const UF = "AC";
let cfgOriginal: Record<string, unknown> | null = null;

async function criarEmpresaComModelo(
  tipo: "clt" | "franqueada",
  modalidade: "individual" | "full" | undefined,
  cidade: string,
) {
  const { data: modelo, error: eModelo } = await admin
    .from("modelos_franquia")
    .insert({ nome: uniq(`modelo-d5-${tipo}`), tipo, modalidade })
    .select("id")
    .single();
  if (eModelo) throw eModelo;

  const { data: emp, error: eEmp } = await admin
    .from("empresas")
    .insert({
      nome: uniq("Franquia D5"),
      tipo: "pj",
      documento: uniqDoc(),
      status: "aprovada",
      uf: UF,
      cidade,
      modelo_id: modelo.id,
    })
    .select("id")
    .single();
  if (eEmp) throw eEmp;
  return emp.id as string;
}

async function criarVendedor(empresaId: string, status?: "ativo" | "atencao" | "travado") {
  const { userId } = await criarUsuario(`${uniq("vend-d5")}@teste.local`);
  await admin
    .from("profiles")
    .update({ empresa_id: empresaId, status: "aprovada", performance_status: status ?? null })
    .eq("id", userId);
  await admin.from("user_roles").insert({ user_id: userId, role: "vendedor" });
  return userId;
}

describe("V11 · D5 — travado não recebe lead", () => {
  let matriz: Db;

  beforeAll(async () => {
    matriz = await loginMatriz();
    const { data: cfg } = await admin
      .from("distribuicao_config")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    cfgOriginal = cfg;
    await admin.from("distribuicao_config").upsert({
      id: "default",
      automatico_on: true,
      modo: "regiao",
      criterios: { regiao: true },
    });
  });

  afterAll(async () => {
    if (cfgOriginal) await admin.from("distribuicao_config").upsert(cfgOriginal as never);
  });

  it("único vendedor da empresa travado (pausa ativa) -> lead fica sem responsável", async () => {
    const cidade = uniq("d5-so-travado").toLowerCase();
    const empresaId = await criarEmpresaComModelo("clt", undefined, cidade);
    await criarVendedor(empresaId, "travado");

    const { data: lead, error } = await matriz
      .from("leads")
      .insert({ nome: uniq("Lead D5"), origem: "teste", dados: { cidade } })
      .select("empresa_id,responsavel_id")
      .single();
    expect(error).toBeNull();
    expect(lead?.empresa_id).toBe(empresaId); // empresa é escolhida antes da trava de pessoa
    expect(lead?.responsavel_id).toBeNull();
  });

  it("dois vendedores, um travado -> lead vai pro que não está travado", async () => {
    const cidade = uniq("d5-um-travado").toLowerCase();
    const empresaId = await criarEmpresaComModelo("clt", undefined, cidade);
    await criarVendedor(empresaId, "travado");
    const disponivel = await criarVendedor(empresaId, "ativo");

    const { data: lead, error } = await matriz
      .from("leads")
      .insert({ nome: uniq("Lead D5"), origem: "teste", dados: { cidade } })
      .select("responsavel_id")
      .single();
    expect(error).toBeNull();
    expect(lead?.responsavel_id).toBe(disponivel);
  });

  it("bloco com pausa_leads_ativa=false -> travado continua recebendo lead", async () => {
    const cidade = uniq("d5-sem-pausa").toLowerCase();
    const empresaId = await criarEmpresaComModelo("franqueada", "individual", cidade);
    const travado = await criarVendedor(empresaId, "travado");

    const { data: reguaAntes } = await admin
      .from("regua_performance_config")
      .select("pausa_leads_ativa")
      .eq("bloco", "rede")
      .single();
    await admin
      .from("regua_performance_config")
      .update({ pausa_leads_ativa: false })
      .eq("bloco", "rede");

    try {
      const { data: lead, error } = await matriz
        .from("leads")
        .insert({ nome: uniq("Lead D5"), origem: "teste", dados: { cidade } })
        .select("responsavel_id")
        .single();
      expect(error).toBeNull();
      expect(lead?.responsavel_id).toBe(travado);
    } finally {
      await admin
        .from("regua_performance_config")
        .update({ pausa_leads_ativa: reguaAntes?.pausa_leads_ativa ?? true })
        .eq("bloco", "rede");
    }
  });

  it("fila manual (distribuir_fila_pendente) também não escala pro travado", async () => {
    const cidade = uniq("d5-fila").toLowerCase();
    const empresaId = await criarEmpresaComModelo("clt", undefined, cidade);
    await criarVendedor(empresaId, "travado");
    const disponivel = await criarVendedor(empresaId, "ativo");

    // insere direto via admin, sem passar pelo trigger (empresa/responsavel null)
    const { data: lead, error: eLead } = await admin
      .from("leads")
      .insert({ nome: uniq("Lead D5 fila"), origem: "teste", dados: { cidade } })
      .select("id")
      .single();
    if (eLead) throw eLead;

    const { error } = await matriz.rpc("distribuir_fila_pendente");
    expect(error).toBeNull();

    const { data: depois } = await admin
      .from("leads")
      .select("empresa_id,responsavel_id")
      .eq("id", lead!.id)
      .single();
    expect(depois?.empresa_id).toBe(empresaId);
    expect(depois?.responsavel_id).toBe(disponivel);
  });
});

describe("V11 · fn_bloco_performance", () => {
  it("deriva interno/rede/full pelo modelo da empresa — sem modelo também é interno", async () => {
    const clt = await criarEmpresaComModelo("clt", undefined, uniq("bloco-clt").toLowerCase());
    const rede = await criarEmpresaComModelo(
      "franqueada",
      "individual",
      uniq("bloco-rede").toLowerCase(),
    );
    const full = await criarEmpresaComModelo(
      "franqueada",
      "full",
      uniq("bloco-full").toLowerCase(),
    );
    const { data: semModelo } = await admin
      .from("empresas")
      .insert({
        nome: uniq("Empresa sem modelo"),
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
      })
      .select("id")
      .single();

    const { data: rClt } = await admin.rpc("fn_bloco_performance", { p_empresa_id: clt });
    const { data: rRede } = await admin.rpc("fn_bloco_performance", { p_empresa_id: rede });
    const { data: rFull } = await admin.rpc("fn_bloco_performance", { p_empresa_id: full });
    const { data: rSemModelo } = await admin.rpc("fn_bloco_performance", {
      p_empresa_id: semModelo!.id,
    });

    expect(rClt).toBe("interno");
    expect(rRede).toBe("rede");
    expect(rFull).toBe("full");
    expect(rSemModelo).toBe("interno");
  });
});
