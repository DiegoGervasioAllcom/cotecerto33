import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz, uniq, type Db } from "../helpers/supabase";

/**
 * G1.6c — Solicitação de cadastro de vendedor pelo grupo (modelo "pedido →
 * Matriz aprova"). `vendedor_solicitacoes` não tem RLS de insert/update: tudo
 * passa por `solicitar_vendedor` / `resolver_solicitacao_vendedor` (security
 * definer).
 */
describe("G1.6c — solicitar_vendedor / resolver_solicitacao_vendedor", () => {
  let masterA: Db;
  let masterAId: string;
  let empresaA: string;
  let supervisorA: Db;
  let vendedorA: Db;
  let outraRedeMaster: Db;
  let matriz: Db;

  beforeAll(async () => {
    const m = await criarPersonaComEmpresa("master", { emailPrefix: "master-solic" });
    masterA = m.client;
    masterAId = m.userId;
    empresaA = m.empresaId;

    const s = await criarPersonaComEmpresa("supervisor", {
      empresaId: empresaA,
      emailPrefix: "sup-solic",
      superiorId: masterAId,
    });
    supervisorA = s.client;

    const v = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaA,
      emailPrefix: "vend-solic",
      superiorId: masterAId,
    });
    vendedorA = v.client;

    const outra = await criarPersonaComEmpresa("master", { emailPrefix: "master-outra-solic" });
    outraRedeMaster = outra.client;

    matriz = await loginMatriz();
  });

  it("POSITIVO: master consegue solicitar vendedor e a linha nasce pendente com solicitante correto", async () => {
    const nome = uniq("Vendedor Solicitado");
    const { data: id, error } = await masterA.rpc("solicitar_vendedor", {
      p_nome: nome,
      p_cpf: "123.456.789-00",
      p_celular: "11999999999",
      p_email: "vendedor@teste.local",
    });
    expect(error).toBeNull();
    expect(id).toBeTruthy();

    const { data: row, error: e2 } = await admin
      .from("vendedor_solicitacoes")
      .select("nome,cpf,status,solicitante_id,empresa_id")
      .eq("id", id as string)
      .single();
    expect(e2).toBeNull();
    expect(row?.nome).toBe(nome);
    expect(row?.cpf).toBe("12345678900");
    expect(row?.status).toBe("pendente");
    expect(row?.solicitante_id).toBe(masterAId);
    expect(row?.empresa_id).toBe(empresaA);
  });

  it("POSITIVO: supervisor também consegue solicitar", async () => {
    const { data: id, error } = await supervisorA.rpc("solicitar_vendedor", {
      p_nome: uniq("Vendedor Sup"),
    });
    expect(error).toBeNull();
    expect(id).toBeTruthy();
  });

  it("NEGATIVO: vendedor comum recebe exception ao solicitar", async () => {
    const { error } = await vendedorA.rpc("solicitar_vendedor", {
      p_nome: uniq("Vendedor Indevido"),
    });
    expect(error).not.toBeNull();
    expect(error!.message.toLowerCase()).toContain("apenas usuários de grupo");
  });

  it("visibilidade: Matriz vê todas; solicitante vê a sua; outra rede não vê", async () => {
    const nome = uniq("Vendedor Visibilidade");
    const { data: id } = await masterA.rpc("solicitar_vendedor", { p_nome: nome });

    const { data: viaMatriz } = await matriz
      .from("vendedor_solicitacoes")
      .select("id")
      .eq("id", id as string);
    expect(viaMatriz?.length).toBe(1);

    const { data: viaSolicitante } = await masterA
      .from("vendedor_solicitacoes")
      .select("id")
      .eq("id", id as string);
    expect(viaSolicitante?.length).toBe(1);

    const { data: viaOutraRede } = await outraRedeMaster
      .from("vendedor_solicitacoes")
      .select("id")
      .eq("id", id as string);
    expect(viaOutraRede?.length ?? 0).toBe(0);
  });

  it("resolver_solicitacao_vendedor: só Matriz consegue resolver", async () => {
    const { data: id } = await masterA.rpc("solicitar_vendedor", {
      p_nome: uniq("Vendedor Resolver"),
    });

    const { error: eMaster } = await masterA.rpc("resolver_solicitacao_vendedor", {
      p_id: id as string,
      p_aprovar: true,
    });
    expect(eMaster).not.toBeNull();
    expect(eMaster!.message.toLowerCase()).toContain("forbidden");

    const { error: eMatriz } = await matriz.rpc("resolver_solicitacao_vendedor", {
      p_id: id as string,
      p_aprovar: true,
      p_observacao: "ok, aprovado",
    });
    expect(eMatriz).toBeNull();

    const { data: row } = await admin
      .from("vendedor_solicitacoes")
      .select("status,resolved_at,observacao")
      .eq("id", id as string)
      .single();
    expect(row?.status).toBe("aprovada");
    expect(row?.resolved_at).not.toBeNull();
    expect(row?.observacao).toBe("ok, aprovado");
  });
});
