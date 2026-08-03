/**
 * V11 · C10 (Frente 3) — motivo obrigatório em todo desligamento.
 *
 * `profiles_desligamento_motivo_obrigatorio` fecha a porta no banco: qualquer
 * caminho que tente `status='suspensa'` sem `desligado_motivo` falha — não só
 * os dois que a Matriz usa (`admin_set_usuario_status`, `excluir_cadastro_rede`).
 * A RPC legada `desligar_usuario` (V10, sem trava/escopo/motivo) foi removida.
 */
import { describe, it, expect } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz } from "../helpers/supabase";

describe("V11 · C10 — profiles_desligamento_motivo_obrigatorio", () => {
  it("bloqueia UPDATE direto que desliga sem motivo", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");

    const { error } = await admin
      .from("profiles")
      .update({ desligado_em: new Date().toISOString(), status: "suspensa" })
      .eq("id", pessoa.userId);
    expect(error?.message).toContain("profiles_desligamento_motivo_obrigatorio");
  });

  it("permite UPDATE direto que desliga com motivo", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");

    const { error } = await admin
      .from("profiles")
      .update({
        desligado_em: new Date().toISOString(),
        desligado_motivo: "teste",
        status: "suspensa",
      })
      .eq("id", pessoa.userId);
    expect(error).toBeNull();
  });

  it("reativação continua liberada sem motivo (zera desligado_motivo)", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");
    await admin
      .from("profiles")
      .update({
        desligado_em: new Date().toISOString(),
        desligado_motivo: "teste",
        status: "suspensa",
      })
      .eq("id", pessoa.userId);

    const { error } = await admin
      .from("profiles")
      .update({ desligado_em: null, desligado_motivo: null, status: "aprovada" })
      .eq("id", pessoa.userId);
    expect(error).toBeNull();
  });
});

describe("V11 · C10 — admin_set_usuario_status com motivo obrigatório", () => {
  it("rejeita desativar sem motivo, com mensagem amigável", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("admin_set_usuario_status", {
      p_user_id: pessoa.userId,
      p_ativo: false,
    });
    expect(error?.message).toBe("Motivo é obrigatório.");
  });

  it("rejeita desativar com motivo só de espaços", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("admin_set_usuario_status", {
      p_user_id: pessoa.userId,
      p_ativo: false,
      p_motivo: "   ",
    });
    expect(error?.message).toBe("Motivo é obrigatório.");
  });

  it("aceita desativar com motivo preenchido", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("admin_set_usuario_status", {
      p_user_id: pessoa.userId,
      p_ativo: false,
      p_motivo: "baixa performance",
    });
    expect(error).toBeNull();

    const { data: perfil } = await admin
      .from("profiles")
      .select("desligado_motivo,status")
      .eq("id", pessoa.userId)
      .single();
    expect(perfil?.desligado_motivo).toBe("baixa performance");
    expect(perfil?.status).toBe("suspensa");
  });

  it("reativar continua sem exigir motivo", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor");
    const matriz = await loginMatriz();
    await matriz.rpc("admin_set_usuario_status", {
      p_user_id: pessoa.userId,
      p_ativo: false,
      p_motivo: "teste",
    });

    const { error } = await matriz.rpc("admin_set_usuario_status", {
      p_user_id: pessoa.userId,
      p_ativo: true,
    });
    expect(error).toBeNull();

    const { data: perfil } = await admin
      .from("profiles")
      .select("desligado_motivo,desligado_em,status")
      .eq("id", pessoa.userId)
      .single();
    expect(perfil?.desligado_motivo).toBeNull();
    expect(perfil?.desligado_em).toBeNull();
    expect(perfil?.status).toBe("aprovada");
  });
});

describe("V11 · C10 — desligar_usuario removida", () => {
  it("a RPC legada não existe mais", async () => {
    const matriz = await loginMatriz();
    const { error } = await matriz.rpc(
      "desligar_usuario" as never,
      {
        user_id: "00000000-0000-0000-0000-000000000000",
      } as never,
    );
    expect(error?.message).toContain("Could not find the function");
  });
});
