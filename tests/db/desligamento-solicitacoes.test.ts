/**
 * V11 · C7 (Frente 3) — solicitação de desligamento pelo grupo.
 *
 * Master/Franqueado Full pedem desligamento (vendedor ou franquia) da própria
 * rede; a Matriz resolve. Aprovar EXECUTA o desligamento na mesma transação
 * (via `excluir_cadastro_rede`, C6) — se a trava de dependentes disparar, o
 * pedido continua 'pendente' (a transação inteira desfaz).
 */
import { describe, it, expect } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz } from "../helpers/supabase";

describe("V11 · C7 — solicitar_desligamento", () => {
  it("master solicita desligamento de vendedor da própria rede", async () => {
    const master = await criarPersonaComEmpresa("master");
    const franquia = await criarPersonaComEmpresa("franqueado", {
      superiorId: master.userId,
    });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });

    const { data, error } = await master.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: vendedor.userId,
      p_motivo: "baixa performance",
    });
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    const { data: pedido } = await admin
      .from("desligamento_solicitacoes")
      .select("status,solicitante_id,alvo_profile_id,motivo")
      .eq("id", data as string)
      .single();
    expect(pedido?.status).toBe("pendente");
    expect(pedido?.solicitante_id).toBe(master.userId);
    expect(pedido?.alvo_profile_id).toBe(vendedor.userId);
  });

  it("franqueado full solicita desligamento do próprio vendedor", async () => {
    const franquia = await criarPersonaComEmpresa("franqueado");
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });

    const { error } = await franquia.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: vendedor.userId,
      p_motivo: "pedido de demissão",
    });
    expect(error).toBeNull();
  });

  it("master solicita desligamento da própria franquia", async () => {
    const master = await criarPersonaComEmpresa("master");
    const franquia = await criarPersonaComEmpresa("franqueado", {
      superiorId: master.userId,
    });

    const { error } = await master.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: franquia.userId,
      p_motivo: "franquia inadimplente",
    });
    expect(error).toBeNull();
  });

  it("rejeita motivo vazio", async () => {
    const master = await criarPersonaComEmpresa("master");
    const franquia = await criarPersonaComEmpresa("franqueado", {
      superiorId: master.userId,
    });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });

    const { error } = await master.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: vendedor.userId,
      p_motivo: "   ",
    });
    expect(error?.message).toContain("Motivo é obrigatório");
  });

  it("rejeita quem não é master/franqueado", async () => {
    const franquia = await criarPersonaComEmpresa("franqueado");
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });

    const { error } = await vendedor.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: vendedor.userId,
      p_motivo: "teste",
    });
    expect(error?.message).toContain("não permite solicitar desligamento");
  });

  it("rejeita alvo fora da rede de quem solicita", async () => {
    const masterA = await criarPersonaComEmpresa("master");
    const franquiaB = await criarPersonaComEmpresa("franqueado");
    const vendedorB = await criarPersonaComEmpresa("vendedor", { empresaId: franquiaB.empresaId });

    const { error } = await masterA.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: vendedorB.userId,
      p_motivo: "teste",
    });
    expect(error?.message).toContain("não está na sua rede");
  });

  it("rejeita alvo que não é vendedor/franquia (ex.: outro master)", async () => {
    const masterA = await criarPersonaComEmpresa("master");
    const masterB = await criarPersonaComEmpresa("master");

    const { error } = await masterA.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: masterB.userId,
      p_motivo: "teste",
    });
    expect(error?.message).toContain("vendedor ou franquia");
  });

  it("rejeita alvo já desligado", async () => {
    const master = await criarPersonaComEmpresa("master");
    const franquia = await criarPersonaComEmpresa("franqueado", {
      superiorId: master.userId,
    });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });
    await admin
      .from("profiles")
      .update({
        desligado_em: new Date().toISOString(),
        desligado_motivo: "teste",
        status: "suspensa",
      })
      .eq("id", vendedor.userId);

    const { error } = await master.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: vendedor.userId,
      p_motivo: "teste",
    });
    expect(error?.message).toContain("já está desligado");
  });
});

describe("V11 · C7 — resolver_desligamento", () => {
  it("matriz aprova: executa o desligamento e marca o pedido como aprovada", async () => {
    const franquia = await criarPersonaComEmpresa("franqueado");
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });
    const { data: pedidoId } = await franquia.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: vendedor.userId,
      p_motivo: "baixa performance",
    });
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("resolver_desligamento", {
      p_id: pedidoId as string,
      p_aprovar: true,
    });
    expect(error).toBeNull();

    const { data: pedido } = await admin
      .from("desligamento_solicitacoes")
      .select("status,resolved_by")
      .eq("id", pedidoId as string)
      .single();
    expect(pedido?.status).toBe("aprovada");
    expect(pedido?.resolved_by).toBeTruthy();

    const { data: perfil } = await admin
      .from("profiles")
      .select("desligado_em,desligado_motivo")
      .eq("id", vendedor.userId)
      .single();
    expect(perfil?.desligado_em).not.toBeNull();
    expect(perfil?.desligado_motivo).toBe("baixa performance");
  });

  it("matriz recusa: só atualiza o status, não desliga ninguém", async () => {
    const franquia = await criarPersonaComEmpresa("franqueado");
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });
    const { data: pedidoId } = await franquia.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: vendedor.userId,
      p_motivo: "teste",
    });
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("resolver_desligamento", {
      p_id: pedidoId as string,
      p_aprovar: false,
      p_observacao: "vamos manter por ora",
    });
    expect(error).toBeNull();

    const { data: pedido } = await admin
      .from("desligamento_solicitacoes")
      .select("status,observacao")
      .eq("id", pedidoId as string)
      .single();
    expect(pedido?.status).toBe("recusada");
    expect(pedido?.observacao).toBe("vamos manter por ora");

    const { data: perfil } = await admin
      .from("profiles")
      .select("desligado_em")
      .eq("id", vendedor.userId)
      .single();
    expect(perfil?.desligado_em).toBeNull();
  });

  it("aprovar franquia com vendedor ativo dispara a trava da C6 e o pedido continua pendente", async () => {
    const master = await criarPersonaComEmpresa("master");
    const franquia = await criarPersonaComEmpresa("franqueado", {
      superiorId: master.userId,
    });
    await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });
    const { data: pedidoId } = await master.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: franquia.userId,
      p_motivo: "franquia inadimplente",
    });
    const matriz = await loginMatriz();

    const { error } = await matriz.rpc("resolver_desligamento", {
      p_id: pedidoId as string,
      p_aprovar: true,
    });
    expect(error?.message).toContain("vendedor(es) ativo(s)");

    const { data: pedido } = await admin
      .from("desligamento_solicitacoes")
      .select("status")
      .eq("id", pedidoId as string)
      .single();
    expect(pedido?.status).toBe("pendente");

    const { data: perfil } = await admin
      .from("profiles")
      .select("desligado_em")
      .eq("id", franquia.userId)
      .single();
    expect(perfil?.desligado_em).toBeNull();
  });

  it("rejeita quem não é matriz", async () => {
    const franquia = await criarPersonaComEmpresa("franqueado");
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });
    const { data: pedidoId } = await franquia.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: vendedor.userId,
      p_motivo: "teste",
    });

    const { error } = await franquia.client.rpc("resolver_desligamento", {
      p_id: pedidoId as string,
      p_aprovar: true,
    });
    expect(error?.message).toContain("apenas a Matriz");
  });

  it("rejeita pedido já resolvido", async () => {
    const franquia = await criarPersonaComEmpresa("franqueado");
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: franquia.empresaId });
    const { data: pedidoId } = await franquia.client.rpc("solicitar_desligamento", {
      p_alvo_profile_id: vendedor.userId,
      p_motivo: "teste",
    });
    const matriz = await loginMatriz();
    await matriz.rpc("resolver_desligamento", { p_id: pedidoId as string, p_aprovar: false });

    const { error } = await matriz.rpc("resolver_desligamento", {
      p_id: pedidoId as string,
      p_aprovar: true,
    });
    expect(error?.message).toContain("já resolvida");
  });
});
