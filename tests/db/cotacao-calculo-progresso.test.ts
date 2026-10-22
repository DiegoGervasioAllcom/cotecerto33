import { describe, it, expect, beforeAll } from "vitest";
import {
  admin,
  anonClient,
  criarPersonaComEmpresa,
  loginMatriz,
  type Db,
} from "../helpers/supabase";

describe("cotacao_calculo_progresso — RPC + RLS", () => {
  let vendA: Db;
  let vendB: Db;
  let cotA: string;
  let cotB: string;

  const reg = (id: string, etapa: string, seq: number, erro?: string) =>
    admin.rpc("registrar_calculo_etapa", {
      p_cotacao_id: id,
      p_etapa: etapa,
      p_seq: seq,
      ...(erro ? { p_erro: erro } : {}),
    });
  const ler = async (id: string) =>
    (
      await admin
        .from("cotacao_calculo_progresso")
        .select("etapa,seq")
        .eq("cotacao_id", id)
        .single()
    ).data;

  beforeAll(async () => {
    const a = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-prog-a" });
    const b = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-prog-b" });
    vendA = a.client;
    vendB = b.client;
    const ca = await admin
      .from("cotacoes")
      .insert({ empresa_id: a.empresaId, responsavel_id: a.userId })
      .select("id")
      .single();
    const cb = await admin
      .from("cotacoes")
      .insert({ empresa_id: b.empresaId, responsavel_id: b.userId })
      .select("id")
      .single();
    if (ca.error || cb.error) throw ca.error ?? cb.error;
    cotA = ca.data.id;
    cotB = cb.data.id;
  });

  it("aplica avanço e ignora seq antiga", async () => {
    expect((await reg(cotA, "login", 1)).data).toBe(true);
    expect((await reg(cotA, "calculando", 5)).data).toBe(true);
    expect((await reg(cotA, "veiculo", 2)).data).toBe(false);
    expect(await ler(cotA)).toEqual({ etapa: "calculando", seq: 5 });
  });

  it("concluido não é sobrescrito, mas seq 0 na_fila reinicia o ciclo", async () => {
    expect((await reg(cotA, "concluido", 9)).data).toBe(true);
    expect((await reg(cotA, "erro", 9, "x")).data).toBe(false);
    expect((await reg(cotA, "login", 1)).data).toBe(false);
    expect((await reg(cotA, "na_fila", 0)).data).toBe(true);
    expect(await ler(cotA)).toEqual({ etapa: "na_fila", seq: 0 });
    expect((await reg(cotA, "login", 1)).data).toBe(true);
  });

  it("rejeita etapa inválida e erro > 500 chars", async () => {
    expect((await reg(cotB, "xyz", 1)).error?.code).toBe("23514");
    expect((await reg(cotB, "erro", 9, "a".repeat(501))).error?.code).toBe("23514");
  });

  it("NEGATIVO: authenticated não executa a RPC", async () => {
    const { error } = await vendA.rpc("registrar_calculo_etapa", {
      p_cotacao_id: cotA,
      p_etapa: "login",
      p_seq: 1,
    });
    expect(error).not.toBeNull();
  });

  it("vendedor vê só o progresso das próprias cotações; não escreve", async () => {
    await reg(cotB, "login", 1);
    const a = await vendA.from("cotacao_calculo_progresso").select("cotacao_id");
    expect(a.data?.map((r) => r.cotacao_id)).toEqual([cotA]);
    const b = await vendB.from("cotacao_calculo_progresso").select("cotacao_id");
    expect(b.data?.map((r) => r.cotacao_id)).toEqual([cotB]);
    const ins = await vendA
      .from("cotacao_calculo_progresso")
      .update({ etapa: "erro" })
      .eq("cotacao_id", cotA)
      .select();
    expect(ins.data ?? []).toHaveLength(0);
  });

  it("NEGATIVO: anon não lê, não escreve e não executa a RPC", async () => {
    await reg(cotA, "login", 1);
    const anon = anonClient();
    const sel = await anon.from("cotacao_calculo_progresso").select("cotacao_id");
    // grant select é só de authenticated: anon recebe erro de permissão (42501)
    expect(sel.data ?? []).toHaveLength(0);
    expect(sel.error?.code).toBe("42501");
    const ins = await anon
      .from("cotacao_calculo_progresso")
      .insert({ cotacao_id: cotB, etapa: "login", seq: 1 });
    expect(ins.error).not.toBeNull();
    const upd = await anon
      .from("cotacao_calculo_progresso")
      .update({ etapa: "erro" })
      .eq("cotacao_id", cotA)
      .select();
    expect(upd.data ?? []).toHaveLength(0);
    const del = await anon
      .from("cotacao_calculo_progresso")
      .delete()
      .eq("cotacao_id", cotA)
      .select();
    expect(del.data ?? []).toHaveLength(0);
    // a linha segue intacta depois do update/delete anônimos
    expect((await ler(cotA))?.etapa).toBe("login");
    const rpc = await anon.rpc("registrar_calculo_etapa", {
      p_cotacao_id: cotA,
      p_etapa: "veiculo",
      p_seq: 99,
    });
    expect(rpc.error).not.toBeNull();
    expect((await ler(cotA))?.seq).not.toBe(99);
  });

  it("perfil sem visibilidade da cotação não vê o progresso; dono e matriz veem", async () => {
    await reg(cotA, "login", 1);
    const consulta = (c: Db) =>
      c.from("cotacao_calculo_progresso").select("cotacao_id").eq("cotacao_id", cotA);
    // vendB é de outra empresa/rede, sem relação com o dono de cotA
    expect((await consulta(vendB)).data ?? []).toHaveLength(0);
    expect((await consulta(vendA)).data).toEqual([{ cotacao_id: cotA }]);
    const matriz = await loginMatriz();
    expect((await consulta(matriz)).data).toEqual([{ cotacao_id: cotA }]);
  });
});
