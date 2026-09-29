import { describe, it, expect, beforeAll } from "vitest";
import {
  admin,
  anonClient,
  criarEmpresa,
  criarPersonaComEmpresa,
  type Db,
} from "../helpers/supabase";

/**
 * V12 Impressão fatia B — migrations v12_impressao_registro e
 * v12_impressao_rpc_comissao.
 */
describe("impressão — rpc_comissao_para_impressao + rpc_registrar_impressao", () => {
  let empCad: string; // com % cadastrado (33)
  let empFb: string; // sem cadastro -> fallback
  let dono: Db;
  let donoId: string;
  let colega: Db; // mesma empresa, não é dono
  let outra: Db; // outra empresa
  let donoFb: Db;
  let donoFbId: string;
  let cotCad: string;
  let cotFb: string;

  beforeAll(async () => {
    empCad = (await criarEmpresa({ nome: "Impr Cad" })).id;
    empFb = (await criarEmpresa({ nome: "Impr Fb" })).id;
    await admin.from("empresas").update({ perc_comissao: 33 }).eq("id", empCad);
    await admin.from("empresas").update({ perc_comissao: null, modelo_id: null }).eq("id", empFb);

    const d = await criarPersonaComEmpresa("vendedor", {
      empresaId: empCad,
      emailPrefix: "impr-dono",
    });
    dono = d.client;
    donoId = d.userId;
    colega = (
      await criarPersonaComEmpresa("vendedor", { empresaId: empCad, emailPrefix: "impr-col" })
    ).client;
    outra = (await criarPersonaComEmpresa("vendedor", { emailPrefix: "impr-outra" })).client;
    const f = await criarPersonaComEmpresa("vendedor", {
      empresaId: empFb,
      emailPrefix: "impr-fb",
    });
    donoFb = f.client;
    donoFbId = f.userId;

    const c1 = await admin
      .from("cotacoes")
      .insert({ empresa_id: empCad, responsavel_id: donoId })
      .select("id")
      .single();
    if (c1.error) throw c1.error;
    cotCad = c1.data.id;
    const c2 = await admin
      .from("cotacoes")
      .insert({ empresa_id: empFb, responsavel_id: donoFbId })
      .select("id")
      .single();
    if (c2.error) throw c2.error;
    cotFb = c2.data.id;
  });

  const reg = (c: Db, cot: string, extra: Record<string, unknown> = {}) =>
    c.rpc("rpc_registrar_impressao", {
      p_cotacao_id: cot,
      p_acao: "baixar",
      p_modelo: "a",
      p_detalhada: false,
      p_seguradoras: ["porto"],
      p_com_comissao: false,
      ...extra,
    } as never);

  describe("rpc_comissao_para_impressao", () => {
    it("dono recebe o % cadastrado", async () => {
      const { data, error } = await dono.rpc("rpc_comissao_para_impressao", {
        p_cotacao_id: cotCad,
      });
      expect(error).toBeNull();
      expect(Number(data)).toBe(33);
    });
    it("colega de empresa (escopo) também recebe", async () => {
      const { data, error } = await colega.rpc("rpc_comissao_para_impressao", {
        p_cotacao_id: cotCad,
      });
      expect(error).toBeNull();
      expect(Number(data)).toBe(33);
    });
    it("fallback devolve NULL (nunca o 16)", async () => {
      const { data, error } = await donoFb.rpc("rpc_comissao_para_impressao", {
        p_cotacao_id: cotFb,
      });
      expect(error).toBeNull();
      expect(data).toBeNull();
    });
    it("NEGATIVO: outra empresa recebe erro de permissão", async () => {
      const { data, error } = await outra.rpc("rpc_comissao_para_impressao", {
        p_cotacao_id: cotCad,
      });
      expect(data).toBeNull();
      expect(error?.code).toBe("42501");
    });
    it("NEGATIVO: anon negado", async () => {
      const { error } = await anonClient().rpc("rpc_comissao_para_impressao", {
        p_cotacao_id: cotCad,
      });
      expect(error).not.toBeNull();
    });
    it("fn_pct_comissao_efetivo continua fechada para authenticated", async () => {
      const { error } = await dono.rpc("fn_pct_comissao_efetivo", { p_empresa_id: empCad });
      expect(error).not.toBeNull();
    });
  });

  describe("cotação com responsavel_id NULL (sem vazamento por NULL)", () => {
    let cotNula: string;
    beforeAll(async () => {
      const c = await admin
        .from("cotacoes")
        .insert({ empresa_id: empCad, responsavel_id: null })
        .select("id")
        .single();
      if (c.error) throw c.error;
      cotNula = c.data.id;
    });
    it("NEGATIVO: outra empresa -> 42501 nas duas RPCs", async () => {
      const a = await outra.rpc("rpc_comissao_para_impressao", { p_cotacao_id: cotNula });
      expect(a.error?.code).toBe("42501");
      expect((await reg(outra, cotNula)).error?.code).toBe("42501");
    });
    it("POSITIVO: colega com a empresa em empresas_visiveis -> ok", async () => {
      const a = await colega.rpc("rpc_comissao_para_impressao", { p_cotacao_id: cotNula });
      expect(a.error).toBeNull();
      expect(Number(a.data)).toBe(33);
      expect((await reg(colega, cotNula)).error).toBeNull();
    });
    it("NEGATIVO: cotação inexistente -> 42501 (não sonda existência)", async () => {
      const inex = "00000000-0000-4000-8000-000000000000";
      expect((await reg(dono, inex)).error?.code).toBe("42501");
    });
  });

  describe("trilha sobrevive à exclusão da cotação (sem FK)", () => {
    it("apagar a cotação funciona e a linha de impressão permanece; apagar a linha segue barrado; RPCs recusam cotação inexistente", async () => {
      const c = await admin
        .from("cotacoes")
        .insert({ empresa_id: empCad, responsavel_id: donoId })
        .select("id")
        .single();
      if (c.error) throw c.error;
      const cotId = c.data.id;
      const { data: id, error } = await reg(dono, cotId);
      expect(error).toBeNull();

      const del = await admin.from("cotacoes").delete().eq("id", cotId);
      expect(del.error).toBeNull();

      const { data: linha } = await admin
        .from("cotacao_impressoes")
        .select("id, cotacao_id")
        .eq("id", id as string)
        .single();
      expect(linha?.cotacao_id).toBe(cotId);

      const delLinha = await admin
        .from("cotacao_impressoes")
        .delete()
        .eq("id", id as string);
      expect(delLinha.error?.code).toBe("42501");

      expect((await reg(dono, cotId)).error?.code).toBe("42501");
      const r = await dono.rpc("rpc_comissao_para_impressao", { p_cotacao_id: cotId });
      expect(r.error?.code).toBe("42501");
    });
  });

  describe("rpc_registrar_impressao + cotacao_impressoes", () => {
    it("com comissão: pct_exibido vem do servidor", async () => {
      const { data: id, error } = await reg(dono, cotCad, { p_com_comissao: true });
      expect(error).toBeNull();
      const { data } = await admin
        .from("cotacao_impressoes")
        .select("*")
        .eq("id", id as string)
        .single();
      expect(Number(data?.pct_exibido)).toBe(33);
      expect(data?.empresa_id).toBe(empCad);
      expect(data?.usuario_id).toBe(donoId);
    });
    it("payload não aceita pct_exibido (parâmetro inexistente)", async () => {
      const { error } = await reg(dono, cotCad, { p_com_comissao: true, p_pct_exibido: 99 });
      expect(error).not.toBeNull();
    });
    it("sem comissão: pct_exibido NULL", async () => {
      const { data: id } = await reg(dono, cotCad);
      const { data } = await admin
        .from("cotacao_impressoes")
        .select("pct_exibido, com_comissao")
        .eq("id", id as string)
        .single();
      expect(data?.pct_exibido).toBeNull();
      expect(data?.com_comissao).toBe(false);
    });
    it("NEGATIVO: e-mail com comissão recusado", async () => {
      const { error } = await reg(dono, cotCad, {
        p_acao: "email",
        p_com_comissao: true,
        p_destinatario: "a@b.com",
      });
      expect(error?.code).toBe("22023");
    });
    it("NEGATIVO: com_comissao em fallback recusado", async () => {
      const { error } = await reg(donoFb, cotFb, { p_com_comissao: true });
      expect(error?.code).toBe("22023");
    });
    it("NEGATIVO: outra empresa não registra", async () => {
      const { error } = await reg(outra, cotCad);
      expect(error?.code).toBe("42501");
    });
    it("NEGATIVO: anon não registra", async () => {
      const { error } = await reg(anonClient(), cotCad);
      expect(error).not.toBeNull();
    });
    it("CHECKs: ação/modelo inválidos, destinatário > 254, seguradoras > 2000", async () => {
      expect((await reg(dono, cotCad, { p_acao: "x" })).error?.code).toBe("23514");
      expect((await reg(dono, cotCad, { p_modelo: "z" })).error?.code).toBe("23514");
      expect((await reg(dono, cotCad, { p_destinatario: "a".repeat(255) })).error?.code).toBe(
        "23514",
      );
      const grande = Array.from({ length: 300 }, () => "seguradora-x");
      expect((await reg(dono, cotCad, { p_seguradoras: grande })).error?.code).toBe("23514");
    });
    it("CHECKs de tabela: pct > 100 e pct sem comissão rejeitados", async () => {
      const base = {
        cotacao_id: cotCad,
        empresa_id: empCad,
        usuario_id: donoId,
        acao: "baixar",
        modelo: "a",
      };
      expect(
        (
          await admin
            .from("cotacao_impressoes")
            .insert({ ...base, com_comissao: true, pct_exibido: 101 })
        ).error?.code,
      ).toBe("23514");
      expect(
        (
          await admin
            .from("cotacao_impressoes")
            .insert({ ...base, com_comissao: false, pct_exibido: 10 })
        ).error?.code,
      ).toBe("23514");
      expect(
        (
          await admin
            .from("cotacao_impressoes")
            .insert({ ...base, acao: "email", com_comissao: true, pct_exibido: 10 })
        ).error?.code,
      ).toBe("23514");
    });

    it("RLS leitura: dono e colega veem; outra empresa não", async () => {
      expect(
        ((await dono.from("cotacao_impressoes").select("id").eq("cotacao_id", cotCad)).data ?? [])
          .length,
      ).toBeGreaterThan(0);
      expect(
        ((await colega.from("cotacao_impressoes").select("id").eq("cotacao_id", cotCad)).data ?? [])
          .length,
      ).toBeGreaterThan(0);
      expect(
        (await outra.from("cotacao_impressoes").select("id").eq("cotacao_id", cotCad)).data ?? [],
      ).toHaveLength(0);
    });
    it("NEGATIVO: INSERT/UPDATE/DELETE diretos negados a authenticated", async () => {
      const ins = await dono
        .from("cotacao_impressoes")
        .insert({ cotacao_id: cotCad, empresa_id: empCad, acao: "baixar", modelo: "a" } as never);
      expect(ins.error).not.toBeNull();
      const { data: linha } = await admin
        .from("cotacao_impressoes")
        .select("id")
        .eq("cotacao_id", cotCad)
        .limit(1)
        .single();
      const upd = await dono
        .from("cotacao_impressoes")
        .update({ detalhada: true })
        .eq("id", linha!.id)
        .select();
      expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);
      const del = await dono.from("cotacao_impressoes").delete().eq("id", linha!.id).select();
      expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
    });
    it("trigger: UPDATE e DELETE falham até via service role", async () => {
      const { data: linha } = await admin
        .from("cotacao_impressoes")
        .select("id")
        .eq("cotacao_id", cotCad)
        .limit(1)
        .single();
      const upd = await admin
        .from("cotacao_impressoes")
        .update({ detalhada: true })
        .eq("id", linha!.id);
      expect(upd.error?.code).toBe("42501"); // permission denied (grant) ou trigger
      const del = await admin.from("cotacao_impressoes").delete().eq("id", linha!.id);
      expect(del.error?.code).toBe("42501");
    });
  });
});
