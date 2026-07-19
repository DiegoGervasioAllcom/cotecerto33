import { describe, it, expect, beforeAll } from "vitest";
import { admin, loginMatriz, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

/**
 * G5.1 — Premiações (lançamento manual da Matriz, separado das campanhas
 * Elite do G4). Cobre: escrita só-Matriz, visibilidade em rede (Matriz vê
 * tudo; vendedor vê o seu; grupo vê os da própria rede sem vazar entre
 * redes) e checks básicos (valor, status, tamanho de nome).
 */
describe("RLS — premiacao_campanhas / premiacao_lancamentos", () => {
  let matriz: Db;
  let campanhaId: string;

  let masterRedeA: Db;
  let empresaMasterA: string;
  let vendedorRedeA: Db;
  let vendedorRedeAId: string;
  let empresaVendedorA: string;

  let vendedorRedeB: Db;
  let vendedorRedeBId: string;
  let empresaVendedorB: string;

  beforeAll(async () => {
    matriz = await loginMatriz();

    const ins = await matriz
      .from("premiacao_campanhas")
      .insert({ nome: uniq("Campanha G5.1") })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    campanhaId = ins.data!.id;

    // Rede A: master -> vendedor (empresa filha)
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "g51-master-a" });
    masterRedeA = master.client;
    empresaMasterA = master.empresaId;

    const vendedorA = await criarPersonaComEmpresa("vendedor", {
      parentId: empresaMasterA,
      superiorId: master.userId,
      emailPrefix: "g51-vend-a",
    });
    vendedorRedeA = vendedorA.client;
    vendedorRedeAId = vendedorA.userId;
    empresaVendedorA = vendedorA.empresaId;

    // Rede B: vendedor isolado, sem relação com a rede A
    const vendedorB = await criarPersonaComEmpresa("vendedor", { emailPrefix: "g51-vend-b" });
    vendedorRedeB = vendedorB.client;
    vendedorRedeBId = vendedorB.userId;
    empresaVendedorB = vendedorB.empresaId;
  });

  it("NEGATIVO: vendedor não cria campanha", async () => {
    const { error } = await vendedorRedeA
      .from("premiacao_campanhas")
      .insert({ nome: uniq("Campanha vendedor") });
    expect(error).not.toBeNull();
  });

  it("POSITIVO: matriz cria campanha e lançamento", async () => {
    const camp = await matriz
      .from("premiacao_campanhas")
      .insert({ nome: uniq("Campanha Matriz") })
      .select("id")
      .single();
    expect(camp.error).toBeNull();

    const lanc = await matriz
      .from("premiacao_lancamentos")
      .insert({
        campanha_id: camp.data!.id,
        vendedor_id: vendedorRedeAId,
        empresa_id: empresaVendedorA,
        valor: 500,
      })
      .select("id")
      .single();
    expect(lanc.error).toBeNull();
    expect(lanc.data?.id).toBeTruthy();
  });

  it("NEGATIVO: vendedor não cria lançamento (nem para si mesmo)", async () => {
    const { error } = await vendedorRedeA.from("premiacao_lancamentos").insert({
      campanha_id: campanhaId,
      vendedor_id: vendedorRedeAId,
      empresa_id: empresaVendedorA,
      valor: 100,
    });
    expect(error).not.toBeNull();
  });

  it("checks: valor negativo é rejeitado", async () => {
    const { error } = await matriz.from("premiacao_lancamentos").insert({
      campanha_id: campanhaId,
      vendedor_id: vendedorRedeAId,
      empresa_id: empresaVendedorA,
      valor: -10,
    });
    expect(error).not.toBeNull();
  });

  it("checks: status inválido é rejeitado", async () => {
    const { error } = await matriz.from("premiacao_lancamentos").insert({
      campanha_id: campanhaId,
      vendedor_id: vendedorRedeAId,
      empresa_id: empresaVendedorA,
      valor: 100,
      status: "cancelado",
    });
    expect(error).not.toBeNull();
  });

  it("checks: nome de campanha vazio é rejeitado", async () => {
    const { error } = await matriz.from("premiacao_campanhas").insert({ nome: "" });
    expect(error).not.toBeNull();
  });

  it("checks: nome de campanha acima de 150 caracteres é rejeitado", async () => {
    const { error } = await matriz.from("premiacao_campanhas").insert({ nome: "a".repeat(151) });
    expect(error).not.toBeNull();
  });

  describe("visibilidade de premiacao_lancamentos por rede", () => {
    let lancamentoRedeAId: string;

    beforeAll(async () => {
      const { data, error } = await admin
        .from("premiacao_lancamentos")
        .insert({
          campanha_id: campanhaId,
          vendedor_id: vendedorRedeAId,
          empresa_id: empresaVendedorA,
          valor: 250,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      lancamentoRedeAId = data!.id;
    });

    it("POSITIVO: matriz vê o lançamento", async () => {
      const { data, error } = await matriz
        .from("premiacao_lancamentos")
        .select("id")
        .eq("id", lancamentoRedeAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("POSITIVO: o vendedor beneficiário vê o seu próprio lançamento", async () => {
      const { data, error } = await vendedorRedeA
        .from("premiacao_lancamentos")
        .select("id")
        .eq("id", lancamentoRedeAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("POSITIVO: o master da mesma rede (empresa visível) vê o lançamento", async () => {
      const { data, error } = await masterRedeA
        .from("premiacao_lancamentos")
        .select("id")
        .eq("id", lancamentoRedeAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("NEGATIVO: vendedor de outra rede não vê o lançamento", async () => {
      const { data, error } = await vendedorRedeB
        .from("premiacao_lancamentos")
        .select("id")
        .eq("id", lancamentoRedeAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });
});
