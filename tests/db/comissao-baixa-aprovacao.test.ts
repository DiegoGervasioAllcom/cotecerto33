import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

describe("comissão abaixo de 20% — aprovação", () => {
  let empresa: string;
  let sup: { client: Db; userId: string };
  let vend: { client: Db; userId: string };
  let terceiro: Db;
  let matriz: Db;
  let cot: string;

  const novaCot = async () => {
    const r = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresa, responsavel_id: vend.userId })
      .select("id")
      .single();
    if (r.error) throw r.error;
    return r.data.id;
  };
  const salvar = (c: Db, cotId: string, seg: string, pct: number) =>
    c.rpc("salvar_ajuste_seguradora", {
      p_cotacao_id: cotId,
      p_seguradora: seg,
      p_franquia_1: null,
      p_franquia_2: null,
      p_vidros: null,
      p_carro_reserva: null,
      p_comissao_pct: pct,
    } as never);
  const solicitar = (cotId: string, seg: string, pct: number) =>
    vend.client.rpc("solicitar_comissao_baixa", {
      p_cotacao_id: cotId,
      p_seguradora: seg,
      p_comissao_pct: pct,
    });

  beforeAll(async () => {
    const s = await criarPersonaComEmpresa("supervisor", { emailPrefix: "cb-sup" });
    sup = s;
    empresa = s.empresaId;
    vend = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresa,
      emailPrefix: "cb-vend",
      superiorId: s.userId,
    });
    terceiro = (await criarPersonaComEmpresa("vendedor", { emailPrefix: "cb-ter" })).client;
    const { loginMatriz } = await import("../helpers/supabase");
    matriz = await loginMatriz();
    cot = await novaCot();
  });

  it("limites da solicitação: 9 e 20 e 31 rejeitados; 10 e 19.99 aceitos", async () => {
    for (const v of [9, 9.99, 20, 31]) {
      expect((await solicitar(cot, "L" + v, v)).error?.code).toBe("23514");
    }
    for (const v of [10, 19.99]) {
      const r = await solicitar(cot, "L" + v, v);
      expect(r.error).toBeNull();
    }
  });

  it("salvar_ajuste: 20 e 30 passam; 31 e 9 caem no check; 19.99 sem aprovação é 42501", async () => {
    const c = await novaCot();
    expect((await salvar(vend.client, c, "A", 20)).error).toBeNull();
    expect((await salvar(vend.client, c, "B", 30)).error).toBeNull();
    expect((await salvar(vend.client, c, "C", 31)).error?.code).toBe("23514");
    expect((await salvar(vend.client, c, "C", 9)).error?.code).toBe("23514");
    expect((await salvar(vend.client, c, "C", 19.99)).error?.code).toBe("42501");
  });

  it("só nivel_atual ou matriz aprova; terceiro não vê nem aprova; aprovar grava ajuste", async () => {
    const c = await novaCot();
    const id = (await solicitar(c, "Porto", 15)).data as string;
    expect(id).toBeTruthy();
    expect((await terceiro.from("comissao_solicitacoes").select("id").eq("id", id)).data).toEqual(
      [],
    );
    expect(
      (await terceiro.from("comissao_trilha").select("id").eq("solicitacao_id", id)).data,
    ).toEqual([]);
    expect((await terceiro.rpc("aprovar_comissao_baixa", { p_id: id })).error?.code).toBe("42501");
    expect((await vend.client.rpc("aprovar_comissao_baixa", { p_id: id })).error?.code).toBe(
      "42501",
    );
    expect(
      (await sup.client.from("comissao_solicitacoes").select("id").eq("id", id)).data,
    ).toHaveLength(1);
    const ok = await sup.client.rpc("aprovar_comissao_baixa", { p_id: id });
    expect(ok.error).toBeNull();
    expect(ok.data?.[0]).toMatchObject({
      cotacao_id: c,
      seguradora: "Porto",
      solicitante_id: vend.userId,
    });
    const aj = await admin
      .from("cotacao_seguradora_ajustes")
      .select("comissao_pct, aplicado_em")
      .eq("cotacao_id", c)
      .single();
    expect(Number(aj.data?.comissao_pct)).toBe(15);
    expect(aj.data?.aplicado_em).toBeNull();
    // bypass: valor diferente do aprovado continua bloqueado; igual passa
    expect((await salvar(vend.client, c, "Porto", 14)).error?.code).toBe("42501");
    expect((await salvar(vend.client, c, "Porto", 15)).error).toBeNull();
    // já resolvida
    expect((await sup.client.rpc("aprovar_comissao_baixa", { p_id: id })).error?.code).toBe(
      "22023",
    );
  });

  it("matriz aprova; sem superior só a matriz resolve", async () => {
    const sem = await criarPersonaComEmpresa("franqueado", { emailPrefix: "cb-sem" });
    const c = (
      await admin
        .from("cotacoes")
        .insert({ empresa_id: sem.empresaId, responsavel_id: sem.userId })
        .select("id")
        .single()
    ).data!.id;
    const id = (
      await sem.client.rpc("solicitar_comissao_baixa", {
        p_cotacao_id: c,
        p_seguradora: "Azul",
        p_comissao_pct: 12,
      })
    ).data as string;
    expect((await terceiro.rpc("aprovar_comissao_baixa", { p_id: id })).error?.code).toBe("42501");
    expect((await matriz.rpc("aprovar_comissao_baixa", { p_id: id })).error).toBeNull();
  });

  it("recusa grava motivo; nova solicitação cancela a pendente; cancelar só o solicitante", async () => {
    const c = await novaCot();
    const a = (await solicitar(c, "HDI", 11)).data as string;
    const b = (await solicitar(c, "HDI", 12)).data as string;
    const ra = await admin.from("comissao_solicitacoes").select("status").eq("id", a).single();
    expect(ra.data?.status).toBe("cancelada");
    expect(
      (await sup.client.rpc("recusar_comissao_baixa", { p_id: b, p_motivo: "não" })).error,
    ).toBeNull();
    const rb = await admin
      .from("comissao_solicitacoes")
      .select("status, motivo_recusa")
      .eq("id", b)
      .single();
    expect(rb.data).toMatchObject({ status: "recusada", motivo_recusa: "não" });
    expect((await salvar(vend.client, c, "HDI", 12)).error?.code).toBe("42501");
    const d = (await solicitar(c, "Suhai", 13)).data as string;
    expect((await sup.client.rpc("cancelar_comissao_baixa", { p_id: d })).error?.code).toBe(
      "42501",
    );
    expect((await vend.client.rpc("cancelar_comissao_baixa", { p_id: d })).error).toBeNull();
  });

  it("trilha é imutável e sem escrita direta", async () => {
    const t = await admin.from("comissao_trilha").select("id").limit(1).single();
    expect(
      (await admin.from("comissao_trilha").update({ observacao: "x" }).eq("id", t.data!.id)).error,
    ).not.toBeNull();
    expect(
      (await admin.from("comissao_trilha").delete().eq("id", t.data!.id)).error,
    ).not.toBeNull();
    const ins = await vend.client.from("comissao_solicitacoes").insert({
      cotacao_id: cot,
      empresa_id: empresa,
      seguradora: "X",
      comissao_pct: 15,
      solicitante_id: vend.userId,
    });
    expect(ins.error).not.toBeNull();
  });

  it("calculo_erro: service role grava/limpa; vendedor lê mas não escreve; limite 500", async () => {
    const c = await novaCot();
    const id = (await solicitar(c, "HDI", 12)).data as string;
    const w = await admin
      .from("comissao_solicitacoes")
      .update({ calculo_erro: "falhou", calculo_erro_em: new Date().toISOString() })
      .eq("id", id);
    expect(w.error).toBeNull();
    const r = await vend.client
      .from("comissao_solicitacoes")
      .select("calculo_erro")
      .eq("id", id)
      .single();
    expect(r.data?.calculo_erro).toBe("falhou");
    const v = await vend.client
      .from("comissao_solicitacoes")
      .update({ calculo_erro: null })
      .eq("id", id)
      .select();
    expect(v.error !== null || (v.data ?? []).length === 0).toBe(true);
    expect(
      (
        await admin
          .from("comissao_solicitacoes")
          .update({ calculo_erro: "x".repeat(501) })
          .eq("id", id)
      ).error,
    ).not.toBeNull();
    expect(
      (
        await admin
          .from("comissao_solicitacoes")
          .update({ calculo_erro: null, calculo_erro_em: null })
          .eq("id", id)
      ).error,
    ).toBeNull();
  });
});
