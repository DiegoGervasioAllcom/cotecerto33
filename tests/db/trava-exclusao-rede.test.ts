/**
 * V11 · C6 (Frente 3) — trava de exclusão na rede externa.
 *
 * `excluir_cadastro_rede` é a RPC dedicada que a aba Cadastros Rede (C5) usa em
 * vez de `admin_set_usuario_status` direto: barra excluir um Master com
 * franquia ativa vinculada, ou uma franquia com vendedor ativo na base —
 * "ativo" é sempre `desligado_em is null`, o mesmo sinal do chip Ativo/Desligado.
 */
import { describe, it, expect } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz } from "../helpers/supabase";

describe("V11 · C6 — excluir_cadastro_rede", () => {
  it("bloqueia excluir Master com franquia ativa vinculada", async () => {
    const master = await criarPersonaComEmpresa("master");
    await criarPersonaComEmpresa("franqueado", { parentId: master.empresaId });
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("excluir_cadastro_rede", {
      p_user_id: master.userId,
      p_motivo: "teste",
    });
    expect(error?.message).toContain("franquia(s) ativa(s)");

    const { data: perfil } = await admin
      .from("profiles")
      .select("desligado_em")
      .eq("id", master.userId)
      .single();
    expect(perfil?.desligado_em).toBeNull();
  });

  it("permite excluir Master sem franquia vinculada", async () => {
    const master = await criarPersonaComEmpresa("master");
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("excluir_cadastro_rede", {
      p_user_id: master.userId,
      p_motivo: "teste",
    });
    expect(error).toBeNull();

    const { data: perfil } = await admin
      .from("profiles")
      .select("desligado_em,status")
      .eq("id", master.userId)
      .single();
    expect(perfil?.desligado_em).not.toBeNull();
    expect(perfil?.status).toBe("suspensa");
  });

  it("permite excluir Master cuja única franquia já está desligada", async () => {
    const master = await criarPersonaComEmpresa("master");
    const franquia = await criarPersonaComEmpresa("franqueado", { parentId: master.empresaId });
    await admin
      .from("profiles")
      .update({
        desligado_em: new Date().toISOString(),
        desligado_motivo: "teste",
        status: "suspensa",
      })
      .eq("id", franquia.userId);
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("excluir_cadastro_rede", {
      p_user_id: master.userId,
      p_motivo: "teste",
    });
    expect(error).toBeNull();
  });

  it("bloqueia excluir franquia com vendedor ativo na base", async () => {
    const franquia = await criarPersonaComEmpresa("franqueado");
    await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("excluir_cadastro_rede", {
      p_user_id: franquia.userId,
      p_motivo: "teste",
    });
    expect(error?.message).toContain("vendedor(es) ativo(s)");
  });

  it("permite excluir franquia sem vendedor ativo na base", async () => {
    const franquia = await criarPersonaComEmpresa("franqueado");
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });
    await admin
      .from("profiles")
      .update({
        desligado_em: new Date().toISOString(),
        desligado_motivo: "teste",
        status: "suspensa",
      })
      .eq("id", vendedor.userId);
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("excluir_cadastro_rede", {
      p_user_id: franquia.userId,
      p_motivo: "teste",
    });
    expect(error).toBeNull();
  });

  it("permite excluir vendedor sem checagem de dependentes", async () => {
    const franquia = await criarPersonaComEmpresa("franqueado");
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("excluir_cadastro_rede", {
      p_user_id: vendedor.userId,
      p_motivo: "teste",
    });
    expect(error).toBeNull();
  });

  it("nega quem não é matriz", async () => {
    const franqueado = await criarPersonaComEmpresa("franqueado");
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      empresaId: franqueado.empresaId,
    });

    const { error } = await franqueado.client.rpc("excluir_cadastro_rede", {
      p_user_id: vendedor.userId,
      p_motivo: "teste",
    });
    expect(error?.message).toContain("permissao negada");
  });

  it("rejeita alvo fora do escopo (não é master/franqueado/vendedor)", async () => {
    const matriz = await loginMatriz();
    const outraMatriz = await criarPersonaComEmpresa("matriz");

    const { error } = await matriz.rpc("excluir_cadastro_rede", {
      p_user_id: outraMatriz.userId,
      p_motivo: "teste",
    });
    expect(error?.message).toContain("fora do escopo");
  });
});
