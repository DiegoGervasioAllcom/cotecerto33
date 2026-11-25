import { describe, it, expect, beforeAll } from "vitest";
import { admin, anonClient, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

describe("cotacao_transmissao_progresso — RPC + RLS", () => {
  let vendA: Db;
  let vendB: Db;
  let cotA: string;
  let tentA: string;
  let tentB: string;

  const reg = (id: string, etapa: string, seq?: number, erro?: string) =>
    admin.rpc("registrar_transmissao_etapa", {
      p_tentativa_id: id,
      p_etapa: etapa,
      ...(seq !== undefined ? { p_seq: seq } : {}),
      ...(erro ? { p_erro: erro } : {}),
    });
  const ler = async (id: string) =>
    (
      await admin
        .from("cotacao_transmissao_progresso")
        .select("etapa,seq,erro")
        .eq("tentativa_id", id)
        .single()
    ).data;
  const novaTentativa = async (cot: string) => {
    const r = await admin
      .from("cotacao_transmissoes")
      .insert({ cotacao_id: cot })
      .select("id")
      .single();
    if (r.error) throw r.error;
    return r.data.id as string;
  };

  beforeAll(async () => {
    const a = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-tp-a" });
    const b = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-tp-b" });
    vendA = a.client;
    vendB = b.client;
    const ca = await admin
      .from("cotacoes")
      .insert({ empresa_id: a.empresaId, responsavel_id: a.userId })
      .select("id")
      .single();
    if (ca.error) throw ca.error;
    cotA = ca.data.id;
    tentA = await novaTentativa(cotA);
    tentB = await novaTentativa(cotA);
  });

  it("seq monotônico: retardatário e duplicado são ignorados", async () => {
    expect((await reg(tentA, "na_fila", 0)).data).toBe(true);
    expect((await reg(tentA, "abrindo_painel", 2)).data).toBe(true);
    expect((await reg(tentA, "entrando_portal", 1)).data).toBe(false);
    expect((await reg(tentA, "abrindo_painel", 2)).data).toBe(false);
    expect(await ler(tentA)).toMatchObject({ etapa: "abrindo_painel", seq: 2 });
  });

  it("seq que não bate com a etapa e tentativa inexistente falham", async () => {
    expect((await reg(tentA, "confirmando", 3)).error).not.toBeNull();
    const r = await reg("00000000-0000-0000-0000-000000000000", "na_fila", 0);
    expect(r.error?.message).toMatch(/inexistente/);
  });

  it("concluido é terminal e usa seq+1", async () => {
    expect((await reg(tentA, "concluido")).data).toBe(true);
    expect(await ler(tentA)).toMatchObject({ etapa: "concluido", seq: 3 });
    expect((await reg(tentA, "erro", undefined, "x")).data).toBe(false);
    expect((await reg(tentA, "confirmando", 6)).data).toBe(false);
    expect((await ler(tentA))?.etapa).toBe("concluido");
  });

  it("erro é terminal, trunca em 500 e só guarda erro nessa etapa", async () => {
    expect((await reg(tentB, "entrando_portal", 1)).data).toBe(true);
    expect((await reg(tentB, "erro", undefined, "a".repeat(800))).data).toBe(true);
    const l = await ler(tentB);
    expect(l?.etapa).toBe("erro");
    expect(l?.erro).toHaveLength(500);
    expect((await reg(tentB, "concluido")).data).toBe(false);
  });

  it("checks: etapa inválida, seq fora da faixa, erro fora da etapa erro", async () => {
    const t = await novaTentativa(cotA);
    expect((await reg(t, "xyz", 1)).error?.code).toBe("23514");
    const base = { tentativa_id: t, cotacao_id: cotA };
    expect(
      (await admin.from("cotacao_transmissao_progresso").insert({ ...base, etapa: "xyz", seq: 1 }))
        .error?.code,
    ).toBe("23514");
    expect(
      (
        await admin
          .from("cotacao_transmissao_progresso")
          .insert({ ...base, etapa: "na_fila", seq: 21 })
      ).error?.code,
    ).toBe("23514");
    expect(
      (
        await admin
          .from("cotacao_transmissao_progresso")
          .insert({ ...base, etapa: "erro", seq: 1, erro: "a".repeat(501) })
      ).error?.code,
    ).toBe("23514");
    expect(
      (
        await admin
          .from("cotacao_transmissao_progresso")
          .insert({ ...base, etapa: "na_fila", seq: 0, erro: "x" })
      ).error?.code,
    ).toBe("23514");
  });

  it("dono vê; outra empresa não vê", async () => {
    const q = (c: Db) =>
      c.from("cotacao_transmissao_progresso").select("tentativa_id").eq("tentativa_id", tentA);
    expect((await q(vendA)).data).toEqual([{ tentativa_id: tentA }]);
    const b = await q(vendB);
    expect(b.error).toBeNull();
    expect(b.data).toEqual([]);
  });

  it("NEGATIVO: authenticated não escreve nem executa a RPC", async () => {
    const ins = await vendA
      .from("cotacao_transmissao_progresso")
      .insert({ tentativa_id: tentA, cotacao_id: cotA, etapa: "na_fila", seq: 0 });
    expect(ins.error).not.toBeNull();
    const upd = await vendA
      .from("cotacao_transmissao_progresso")
      .update({ etapa: "erro" })
      .eq("tentativa_id", tentA)
      .select();
    expect(upd.data ?? []).toHaveLength(0);
    const del = await vendA
      .from("cotacao_transmissao_progresso")
      .delete()
      .eq("tentativa_id", tentA)
      .select();
    expect(del.data ?? []).toHaveLength(0);
    expect((await ler(tentA))?.etapa).toBe("concluido");
    const rpc = await vendA.rpc("registrar_transmissao_etapa", {
      p_tentativa_id: tentA,
      p_etapa: "na_fila",
      p_seq: 0,
    });
    expect(rpc.error).not.toBeNull();
  });

  it("NEGATIVO: anon não lê nem executa a RPC", async () => {
    const anon = anonClient();
    const sel = await anon.from("cotacao_transmissao_progresso").select("tentativa_id");
    expect(sel.error?.code).toBe("42501");
    const rpc = await anon.rpc("registrar_transmissao_etapa", {
      p_tentativa_id: tentA,
      p_etapa: "na_fila",
      p_seq: 0,
    });
    expect(rpc.error).not.toBeNull();
  });
});
