/**
 * V11 · D1 (Frente 4) — schema da régua de performance.
 *
 * As 3 réguas (interno/rede/full) existem como linhas fixas, legíveis por
 * qualquer autenticado; escrita só via RPC (D2/D6) ou job (D4) — nunca direto
 * pelo cliente. Mesma lógica para as colunas de sinal em `profiles`.
 */
import { describe, it, expect } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz } from "../helpers/supabase";

describe("V11 · D1 — regua_performance_config", () => {
  it("as 3 réguas existem, seedadas com os defaults do protótipo", async () => {
    const { data, error } = await admin
      .from("regua_performance_config")
      .select(
        "bloco,janela_dias,conv_atencao_pct,conv_travado_pct,dias_atencao,dias_travado,cancelamentos_limite,pausa_leads_ativa",
      )
      .order("bloco");
    expect(error).toBeNull();
    expect(data?.map((r) => r.bloco)).toEqual(["full", "interno", "rede"]);
    const interno = data?.find((r) => r.bloco === "interno");
    expect(interno?.janela_dias).toBe(30);
    expect(interno?.conv_atencao_pct).toBe(25);
    expect(interno?.conv_travado_pct).toBe(15);
    expect(interno?.pausa_leads_ativa).toBe(true);
  });

  it("qualquer autenticado consegue ler as réguas", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");
    const { data, error } = await pessoa.client.from("regua_performance_config").select("bloco");
    expect(error).toBeNull();
    expect(data?.length).toBe(3);
  });

  it("matriz não consegue escrever direto na tabela (sem policy de insert/update)", async () => {
    const matriz = await loginMatriz();
    const { error } = await matriz
      .from("regua_performance_config")
      .update({ conv_atencao_pct: 99 })
      .eq("bloco", "interno");
    expect(error).not.toBeNull();
  });

  it("bloqueia travado com conversão pior que atenção (check constraint)", async () => {
    const { error } = await admin
      .from("regua_performance_config")
      .update({ conv_atencao_pct: 10, conv_travado_pct: 20 })
      .eq("bloco", "interno");
    expect(error?.message).toContain("regua_travado_pior_que_atencao");
  });

  it("bloqueia dias_travado menor que dias_atencao (check constraint)", async () => {
    const { error } = await admin
      .from("regua_performance_config")
      .update({ dias_atencao: 20, dias_travado: 10 })
      .eq("bloco", "interno");
    expect(error?.message).toContain("regua_dias_travado_maior");
  });

  it("bloco fora da lista é rejeitado", async () => {
    const { error } = await admin.from("regua_performance_config").insert({ bloco: "xxx" });
    expect(error).not.toBeNull();
  });
});

describe("V11 · D1 — colunas de sinal em profiles", () => {
  it("cliente autenticado não escreve performance_status direto", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");
    const { error } = await pessoa.client
      .from("profiles")
      .update({ performance_status: "travado" })
      .eq("id", pessoa.userId);
    expect(error).not.toBeNull();
  });

  it("matriz também não escreve performance_status direto (revoke vale pra qualquer authenticated)", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");
    const matriz = await loginMatriz();
    const { error } = await matriz
      .from("profiles")
      .update({ performance_status: "travado" })
      .eq("id", pessoa.userId);
    expect(error).not.toBeNull();
  });

  it("service_role (job) escreve normalmente", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");
    const { error } = await admin
      .from("profiles")
      .update({ performance_status: "atencao", performance_calculado_em: new Date().toISOString() })
      .eq("id", pessoa.userId);
    expect(error).toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("performance_status")
      .eq("id", pessoa.userId)
      .single();
    expect(data?.performance_status).toBe("atencao");
  });

  it("rejeita status fora da lista (check constraint)", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");
    const { error } = await admin
      .from("profiles")
      .update({ performance_status: "xxx" })
      .eq("id", pessoa.userId);
    expect(error).not.toBeNull();
  });
});
