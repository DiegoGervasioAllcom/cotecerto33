import { describe, it, expect, beforeAll } from "vitest";
import { admin, anonClient, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/** V12.3.7 — migration v12_seguradora_ajustes (tabela + 3 RPCs). */
describe("cotacao_seguradora_ajustes", () => {
  let empresa: string;
  let dono: Db;
  let donoId: string;
  let colega: Db; // mesma empresa, sem escopo
  let outra: Db; // outra empresa
  let cot: string;
  let cotSemResp: string;

  const novaCot = async (resp: string | null) => {
    const r = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresa, responsavel_id: resp })
      .select("id")
      .single();
    if (r.error) throw r.error;
    return r.data.id;
  };
  const salvar = (c: Db, cotId: string, seg = "Porto", extra: Record<string, unknown> = {}) =>
    c.rpc("salvar_ajuste_seguradora", {
      p_cotacao_id: cotId,
      p_seguradora: seg,
      p_franquia_1: "Reduzida 25%",
      p_franquia_2: null,
      p_vidros: null,
      p_carro_reserva: null,
      ...extra,
    } as never);
  const linha = async (cotId: string, seg = "Porto") =>
    (
      await admin
        .from("cotacao_seguradora_ajustes")
        .select("*")
        .eq("cotacao_id", cotId)
        .eq("seguradora", seg)
        .single()
    ).data;

  beforeAll(async () => {
    const d = await criarPersonaComEmpresa("vendedor", { emailPrefix: "ajs-dono" });
    empresa = d.empresaId;
    dono = d.client;
    donoId = d.userId;
    colega = (
      await criarPersonaComEmpresa("vendedor", { empresaId: empresa, emailPrefix: "ajs-col" })
    ).client;
    outra = (await criarPersonaComEmpresa("vendedor", { emailPrefix: "ajs-out" })).client;
    cot = await novaCot(donoId);
    cotSemResp = await novaCot(null);
  });

  describe("RPC salvar_ajuste_seguradora", () => {
    it("dono grava; upsert atualiza e zera aplicado_em", async () => {
      const a = await salvar(dono, cot);
      expect(a.error).toBeNull();
      expect((await linha(cot))?.empresa_id).toBe(empresa);
      const m = await dono.rpc("marcar_ajuste_aplicado", {
        p_cotacao_id: cot,
        p_seguradora: "Porto",
      });
      expect(m.error).toBeNull();
      expect((await linha(cot))?.aplicado_em).not.toBeNull();
      const b = await salvar(dono, cot, "Porto", { p_vidros: "Superior" });
      expect(b.error).toBeNull();
      expect(b.data).toBe(a.data);
      const l = await linha(cot);
      expect(l?.vidros).toBe("Superior");
      expect(l?.aplicado_em).toBeNull();
    });
    it("NEGATIVO: outro usuário, cotação inexistente e resp NULL -> 42501", async () => {
      expect((await salvar(outra, cot)).error?.code).toBe("42501");
      expect((await salvar(dono, "00000000-0000-0000-0000-000000000000")).error?.code).toBe(
        "42501",
      );
      expect((await salvar(outra, cotSemResp)).error?.code).toBe("42501");
    });
    it("NEGATIVO: anon negado", async () => {
      expect((await salvar(anonClient(), cot)).error).not.toBeNull();
    });
    it("NEGATIVO: recusa após virar proposta", async () => {
      const c = await novaCot(donoId);
      const p = await admin
        .from("propostas")
        .insert({ empresa_id: empresa, cotacao_id: c } as never);
      expect(p.error).toBeNull();
      expect((await salvar(dono, c)).error?.code).toBe("22023");
      const c2 = await novaCot(donoId);
      await admin.from("cotacoes").update({ status: "proposta" }).eq("id", c2);
      expect((await salvar(dono, c2)).error?.code).toBe("22023");
    });
    it("CHECKs: enum inválido, todos nulos, tamanho", async () => {
      expect((await salvar(dono, cot, "Azul", { p_franquia_1: "Não" })).error?.code).toBe("23514");
      expect((await salvar(dono, cot, "Azul", { p_franquia_1: "xx" })).error?.code).toBe("23514");
      expect((await salvar(dono, cot, "Azul", { p_vidros: "Premium" })).error?.code).toBe("23514");
      expect((await salvar(dono, cot, "Azul", { p_franquia_1: null })).error?.code).toBe("23514");
      expect((await salvar(dono, cot, "")).error?.code).toBe("23514");
      expect((await salvar(dono, cot, "x".repeat(61))).error?.code).toBe("23514");
      expect((await salvar(dono, cot, "x".repeat(60))).error).toBeNull();
      // 2ª opção aceita "Não"
      expect(
        (await salvar(dono, cot, "Tokio", { p_franquia_1: null, p_franquia_2: "Não" })).error,
      ).toBeNull();
    });
    it("unique (cotacao_id, seguradora)", async () => {
      const r = await admin
        .from("cotacao_seguradora_ajustes")
        .insert({ cotacao_id: cot, empresa_id: empresa, seguradora: "Porto", vidros: "Básico" });
      expect(r.error?.code).toBe("23505");
    });
  });

  describe("RLS", () => {
    it("dono lê; colega da mesma empresa lê (empresas_visiveis inclui a própria); outra empresa não", async () => {
      const q = (c: Db) => c.from("cotacao_seguradora_ajustes").select("id").eq("cotacao_id", cot);
      expect((await q(dono)).data?.length).toBeGreaterThan(0);
      expect((await q(colega)).data?.length).toBeGreaterThan(0);
      expect((await q(outra)).data).toEqual([]);
    });
    it("escrita direta negada", async () => {
      const ins = await dono
        .from("cotacao_seguradora_ajustes")
        .insert({ cotacao_id: cot, empresa_id: empresa, seguradora: "Itaú", vidros: "Básico" });
      expect(ins.error).not.toBeNull();
      const upd = await dono
        .from("cotacao_seguradora_ajustes")
        .update({ vidros: "Básico" })
        .eq("cotacao_id", cot)
        .select();
      expect(upd.data ?? []).toEqual([]);
      const del = await dono
        .from("cotacao_seguradora_ajustes")
        .delete()
        .eq("cotacao_id", cot)
        .select();
      expect(del.data ?? []).toEqual([]);
      expect(await linha(cot)).not.toBeNull();
    });
  });

  describe("marcar aplicado / não aplicados", () => {
    it("funcionam para o dono e zeram todos", async () => {
      await salvar(dono, cot, "Yelum");
      await dono.rpc("marcar_ajuste_aplicado", { p_cotacao_id: cot, p_seguradora: "Yelum" });
      await dono.rpc("marcar_ajuste_aplicado", { p_cotacao_id: cot, p_seguradora: "Porto" });
      expect((await linha(cot, "Yelum"))?.aplicado_em).not.toBeNull();
      const z = await dono.rpc("marcar_ajustes_nao_aplicados", { p_cotacao_id: cot });
      expect(z.error).toBeNull();
      expect((await linha(cot, "Yelum"))?.aplicado_em).toBeNull();
      expect((await linha(cot, "Porto"))?.aplicado_em).toBeNull();
    });
    it("NEGATIVO: sem acesso -> 42501 e nada muda", async () => {
      await dono.rpc("marcar_ajuste_aplicado", { p_cotacao_id: cot, p_seguradora: "Yelum" });
      const a = await outra.rpc("marcar_ajuste_aplicado", {
        p_cotacao_id: cot,
        p_seguradora: "Yelum",
      });
      const b = await outra.rpc("marcar_ajustes_nao_aplicados", { p_cotacao_id: cot });
      const c = await outra.rpc("marcar_ajuste_aplicado", {
        p_cotacao_id: "00000000-0000-0000-0000-000000000000",
        p_seguradora: "Yelum",
      });
      expect([a.error?.code, b.error?.code, c.error?.code]).toEqual(["42501", "42501", "42501"]);
      expect((await linha(cot, "Yelum"))?.aplicado_em).not.toBeNull();
    });
  });
});
