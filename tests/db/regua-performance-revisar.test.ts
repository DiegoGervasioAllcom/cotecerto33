/**
 * V11 · D6 (Frente 4) — fn_revisar_reativar_performance.
 *
 * "Supervisor/Matriz" do plano = matriz OU qualquer ancestral via
 * profiles.superior_id (mesmo padrão de fn_pode_ver_solicitacao_desconto,
 * G3.2) — não o role literal `supervisor`.
 */
import { describe, it, expect } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz, uniq } from "../helpers/supabase";

async function marcarTravado(profileId: string) {
  await admin
    .from("profiles")
    .update({ performance_status: "travado", performance_calculado_em: new Date().toISOString() })
    .eq("id", profileId);
}

describe("V11 · D6 — fn_revisar_reativar_performance", () => {
  it("matriz reativa quem está travado -> vira atenção, grava revisado_em/por/motivo", async () => {
    const vendedor = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("d6-matriz") });
    await marcarTravado(vendedor.userId);
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("fn_revisar_reativar_performance", {
      p_profile_id: vendedor.userId,
      p_motivo: "Conversou com o vendedor, vai melhorar",
    });
    expect(error).toBeNull();

    const { data } = await admin
      .from("profiles")
      .select(
        "performance_status,performance_revisado_em,performance_revisado_por,performance_revisao_motivo",
      )
      .eq("id", vendedor.userId)
      .single();
    expect(data?.performance_status).toBe("atencao");
    expect(data?.performance_revisado_em).not.toBeNull();
    expect(data?.performance_revisao_motivo).toBe("Conversou com o vendedor, vai melhorar");
  });

  it("motivo é opcional", async () => {
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: uniq("d6-sem-motivo"),
    });
    await marcarTravado(vendedor.userId);
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("fn_revisar_reativar_performance", {
      p_profile_id: vendedor.userId,
    });
    expect(error).toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("performance_status,performance_revisao_motivo")
      .eq("id", vendedor.userId)
      .single();
    expect(data?.performance_status).toBe("atencao");
    expect(data?.performance_revisao_motivo).toBeNull();
  });

  it("ancestral via superior_id (ex.: master do vendedor) também consegue reativar", async () => {
    const master = await criarPersonaComEmpresa("master", { emailPrefix: uniq("d6-master") });
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: uniq("d6-time"),
      superiorId: master.userId,
    });
    await marcarTravado(vendedor.userId);

    const { error } = await master.client.rpc("fn_revisar_reativar_performance", {
      p_profile_id: vendedor.userId,
    });
    expect(error).toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("performance_status")
      .eq("id", vendedor.userId)
      .single();
    expect(data?.performance_status).toBe("atencao");
  });

  it("quem não é ancestral nem matriz não consegue reativar", async () => {
    const vendedor = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("d6-alvo") });
    await marcarTravado(vendedor.userId);
    const estranho = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("d6-estranho") });

    const { error } = await estranho.client.rpc("fn_revisar_reativar_performance", {
      p_profile_id: vendedor.userId,
    });
    expect(error?.message).toContain("Sem permissão");
  });

  it("não é possível revisar quem não está travado", async () => {
    const vendedor = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("d6-ativo") });
    await admin
      .from("profiles")
      .update({ performance_status: "ativo", performance_calculado_em: new Date().toISOString() })
      .eq("id", vendedor.userId);
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("fn_revisar_reativar_performance", {
      p_profile_id: vendedor.userId,
    });
    expect(error?.message).toContain("Só é possível revisar quem está travado");
  });

  it("não é possível revisar quem nunca teve sinal calculado", async () => {
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: uniq("d6-sem-sinal"),
    });
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("fn_revisar_reativar_performance", {
      p_profile_id: vendedor.userId,
    });
    expect(error?.message).toContain("sem sinal de performance calculado");
  });

  it("cliente autenticado não escreve performance_revisao_motivo direto (trigger)", async () => {
    const vendedor = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("d6-trigger") });
    const { error } = await vendedor.client
      .from("profiles")
      .update({ performance_revisao_motivo: "tentando passar direto" })
      .eq("id", vendedor.userId);
    expect(error).not.toBeNull();
  });
});
