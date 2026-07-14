import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, loginMatriz, criarUsuario, uniq, uniqDoc, type Db } from "../helpers/supabase";

/**
 * Trigger trg_distribuir_lead_auto (BEFORE INSERT em leads).
 * Fixtures via admin (setup); asserts com client matriz.
 * Determinístico: usamos uma UF improvável (AC + sufixo em cidade) p/ ser a única elegível.
 */
const UF = "AC";
let cidadeUnica: string;
let cfgOriginal: Record<string, unknown> | null = null;

describe("distribuição automática de leads", () => {
  let matriz: Db;
  let empresaId: string;
  let vendedorId: string;

  beforeAll(async () => {
    matriz = await loginMatriz();
    cidadeUnica = uniq("cidade-teste").toLowerCase();

    // guarda config atual p/ restaurar (singleton global)
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

    // franquia aprovada na cidade única + vendedor aprovado nela
    const { data: emp, error: eEmp } = await admin
      .from("empresas")
      .insert({
        nome: uniq("Franquia Dist"),
        tipo: "pj",
        documento: uniqDoc(),
        status: "aprovada",
        uf: UF,
        cidade: cidadeUnica,
      })
      .select("id")
      .single();
    if (eEmp) throw eEmp;
    empresaId = emp.id;

    const { userId } = await criarUsuario(`${uniq("vend")}@teste.local`);
    vendedorId = userId;
    await admin
      .from("profiles")
      .update({ empresa_id: empresaId, status: "aprovada" })
      .eq("id", vendedorId);
    await admin.from("user_roles").insert({ user_id: vendedorId, role: "vendedor" });
  });

  afterAll(async () => {
    if (cfgOriginal) await admin.from("distribuicao_config").upsert(cfgOriginal as never);
  });

  it("lead com cidade casada é distribuído: empresa, responsável e timestamp", async () => {
    const { data: lead, error } = await matriz
      .from("leads")
      .insert({
        nome: uniq("Lead SP"),
        origem: "teste",
        dados: { cidade: cidadeUnica },
      })
      .select("empresa_id,responsavel_id,distribuido_em")
      .single();
    expect(error).toBeNull();
    expect(lead?.empresa_id).toBe(empresaId);
    expect(lead?.responsavel_id).toBe(vendedorId);
    expect(lead?.distribuido_em).toBeTruthy();
  });

  it("NEGATIVO: automático desligado → lead fica sem destino", async () => {
    await admin.from("distribuicao_config").update({ automatico_on: false }).eq("id", "default");
    const { data: lead } = await matriz
      .from("leads")
      .insert({
        nome: uniq("Lead sem dist"),
        origem: "teste",
        dados: { cidade: cidadeUnica },
      })
      .select("empresa_id,responsavel_id")
      .single();
    expect(lead?.empresa_id).toBeNull();
    expect(lead?.responsavel_id).toBeNull();
    await admin.from("distribuicao_config").update({ automatico_on: true }).eq("id", "default");
  });

  it("NEGATIVO: em avaliação da matriz → trigger não age", async () => {
    const { data: lead } = await matriz
      .from("leads")
      .insert({
        nome: uniq("Lead avaliacao"),
        origem: "teste",
        dados: { cidade: cidadeUnica },
        em_avaliacao_matriz: true,
      })
      .select("empresa_id,responsavel_id")
      .single();
    expect(lead?.empresa_id).toBeNull();
    expect(lead?.responsavel_id).toBeNull();
  });
});
