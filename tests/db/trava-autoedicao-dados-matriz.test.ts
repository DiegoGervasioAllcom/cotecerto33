/**
 * V11 · C4 (Frente 3) — trava de autoedição dos campos da aba Cadastros Matriz.
 *
 * Achado da revisão: cpf/janela de acesso/etc nasceram (20260802003342) escreveis
 * pela própria pessoa via a policy pré-existente "profiles update self"/
 * "profiles_update_self". Essas colunas só devem mudar pelo "Configurar" da
 * Matriz/Coordenação — nunca por autoatendimento, mesmo via API direta.
 */
import { describe, it, expect } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz } from "../helpers/supabase";

describe("V11 · C4 — trg_bloquear_autoedicao_dados_matriz", () => {
  it("a própria pessoa não pode alterar cpf/janela de acesso no seu profile", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");

    const { error } = await pessoa.client
      .from("profiles")
      .update({ cpf: "11122233344" })
      .eq("id", pessoa.userId);
    expect(error?.message).toContain("Só a Matriz ou a Coordenação");

    const { error: erroJanela } = await pessoa.client
      .from("profiles")
      .update({ hora_inicio: "07:00" })
      .eq("id", pessoa.userId);
    expect(erroJanela?.message).toContain("Só a Matriz ou a Coordenação");
  });

  it("a própria pessoa continua podendo alterar campos fora da trava (nome)", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");

    const { error } = await pessoa.client
      .from("profiles")
      .update({ nome: "Nome Atualizado" })
      .eq("id", pessoa.userId);
    expect(error).toBeNull();
  });

  it("matriz pode alterar esses campos de qualquer pessoa", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");
    const matriz = await loginMatriz();

    const { error } = await matriz
      .from("profiles")
      .update({ cpf: "55566677788", hora_inicio: "07:00" })
      .eq("id", pessoa.userId);
    expect(error).toBeNull();

    const { data } = await admin
      .from("profiles")
      .select("cpf,hora_inicio")
      .eq("id", pessoa.userId)
      .single();
    expect(data?.cpf).toBe("55566677788");
  });

  it("service_role (server functions) não é bloqueado pela trava", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");

    const { error } = await admin
      .from("profiles")
      .update({ cpf: "99988877766" })
      .eq("id", pessoa.userId);
    expect(error).toBeNull();
  });
});
