import { describe, it, expect, beforeAll } from "vitest";
import {
  admin,
  loginMatriz,
  criarEmpresa,
  criarPersonaComEmpresa,
  type Db,
} from "../helpers/supabase";

/** V12.4.7 fatia 1 — bucket propostas-docs, proposta_documentos e RPCs só service_role. */
describe("proposta_documentos", () => {
  let empresa: string;
  let donoId: string;
  let dono: Db;
  let outro: Db;
  let outroId: string;
  let matriz: Db;
  let cotacao: string;
  let proposta: string;
  const sha = "a".repeat(64);

  const registrar = (status: string, extra: Record<string, unknown> = {}) =>
    admin.rpc("registrar_documento_proposta", {
      p_cotacao_id: cotacao,
      p_tipo: "proposta_pdf",
      p_status: status,
      p_storage_path: status === "ok" ? `${empresa}/${proposta}/proposta.pdf` : null,
      p_nome: status === "ok" ? "proposta.pdf" : null,
      p_tamanho: status === "ok" ? 2048 : null,
      p_sha256: status === "ok" ? sha : null,
      p_erro_codigo: status === "ok" ? null : "timeout",
      ...extra,
    } as never);
  const doc = async () =>
    (await admin.from("proposta_documentos").select("*").eq("proposta_id", proposta).single()).data;

  beforeAll(async () => {
    empresa = (await criarEmpresa({ nome: "PropDoc" })).id;
    const d = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresa,
      emailPrefix: "pd-dono",
    });
    dono = d.client;
    donoId = d.userId;
    const o = await criarPersonaComEmpresa("vendedor", { emailPrefix: "pd-outro" });
    outro = o.client;
    outroId = o.userId;
    matriz = await loginMatriz();

    const c = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresa, responsavel_id: donoId })
      .select("id")
      .single();
    if (c.error) throw c.error;
    cotacao = c.data.id;
    const p = await admin
      .from("propostas")
      .insert({
        empresa_id: empresa,
        cotacao_id: cotacao,
        responsavel_id: donoId,
        numero: `PRP-${Date.now() % 100000}`,
        status: "transmitida",
        transmissao_status: "transmitida",
      } as never)
      .select("id")
      .single();
    if (p.error) throw p.error;
    proposta = p.data.id;
    const t = await admin.from("cotacao_transmissoes").insert({
      cotacao_id: cotacao,
      proposta_id: proposta,
      status: "transmitida",
    });
    if (t.error) throw t.error;
  });

  it("RPC falha sem transmissão bem-sucedida", async () => {
    const outraCot = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresa, responsavel_id: donoId })
      .select("id")
      .single();
    const r = await registrar("falhou", { p_cotacao_id: outraCot.data!.id });
    expect(r.error?.hint).toBe("sem_transmissao");
  });

  it("falhou -> cria com tentativas=1; segunda falha incrementa", async () => {
    expect((await registrar("falhou")).error).toBeNull();
    expect((await doc())?.tentativas).toBe(1);
    expect((await registrar("falhou")).error).toBeNull();
    const d = await doc();
    expect(d?.tentativas).toBe(2);
    expect(d?.status).toBe("falhou");
  });

  it("ok promove, é idempotente e não é rebaixado por falhou", async () => {
    expect((await registrar("ok")).error).toBeNull();
    let d = await doc();
    expect(d?.status).toBe("ok");
    expect(d?.capturado_em).not.toBeNull();
    expect((await registrar("falhou")).error).toBeNull();
    d = await doc();
    expect(d?.status).toBe("ok");
    expect(d?.storage_path).toContain("proposta.pdf");
    expect(d?.erro_codigo).toBeNull();
    const { count } = await admin
      .from("proposta_documentos")
      .select("*", { count: "exact", head: true })
      .eq("proposta_id", proposta);
    expect(count).toBe(1);
  });

  it("checks: ok exige arquivo; sha e tamanho inválidos rejeitados", async () => {
    expect((await registrar("ok", { p_tamanho: 10 })).error).not.toBeNull();
    expect((await registrar("ok", { p_sha256: "xyz" })).error).not.toBeNull();
    expect((await registrar("talvez")).error).not.toBeNull();
    expect((await registrar("ok", { p_tipo: "boleto" })).error).not.toBeNull();
  });

  describe("RLS e grants", () => {
    it("dono e matriz veem; outro vendedor não", async () => {
      expect((await dono.from("proposta_documentos").select("id")).data).toHaveLength(1);
      expect(
        (await matriz.from("proposta_documentos").select("id").eq("proposta_id", proposta)).data,
      ).toHaveLength(1);
      expect((await outro.from("proposta_documentos").select("id")).data).toHaveLength(0);
    });

    it("authenticated não escreve", async () => {
      const row = {
        proposta_id: proposta,
        empresa_id: empresa,
        tipo: "proposta_pdf",
        status: "pendente",
      };
      expect((await dono.from("proposta_documentos").insert(row as never)).error).not.toBeNull();
      await dono
        .from("proposta_documentos")
        .update({ status: "falhou" })
        .eq("proposta_id", proposta);
      await dono.from("proposta_documentos").delete().eq("proposta_id", proposta);
      expect((await doc())?.status).toBe("ok");
    });

    it("RPCs só service_role", async () => {
      for (const c of [dono, matriz]) {
        const a = await c.rpc("registrar_documento_proposta", {
          p_cotacao_id: cotacao,
          p_tipo: "proposta_pdf",
          p_status: "falhou",
          p_storage_path: null,
          p_nome: null,
          p_tamanho: null,
          p_sha256: null,
          p_erro_codigo: "x",
        } as never);
        expect(a.error?.code).toBe("42501");
        const b = await c.rpc("solicitar_recaptura_documento_proposta", {
          p_proposta_id: proposta,
          p_uid: donoId,
        } as never);
        expect(b.error?.code).toBe("42501");
      }
    });
  });

  describe("solicitar_recaptura_documento_proposta", () => {
    let cot2: string;
    let prop2: string;
    const pedir = (p: string, uid: string) =>
      admin.rpc("solicitar_recaptura_documento_proposta", {
        p_proposta_id: p,
        p_uid: uid,
      } as never);

    beforeAll(async () => {
      const c = await admin
        .from("cotacoes")
        .insert({ empresa_id: empresa, responsavel_id: donoId })
        .select("id")
        .single();
      cot2 = c.data!.id;
      const p = await admin
        .from("propostas")
        .insert({
          empresa_id: empresa,
          cotacao_id: cot2,
          responsavel_id: donoId,
          numero: `PRP-${(Date.now() + 1) % 100000}`,
          status: "transmitida",
          transmissao_status: "transmitida",
        } as never)
        .select("id")
        .single();
      prop2 = p.data!.id;
    });

    it("sem acesso e inexistente respondem igual (42501)", async () => {
      const outroUid = outroId;
      expect((await pedir(prop2, outroUid)).error?.code).toBe("42501");
      expect((await pedir("00000000-0000-0000-0000-000000000000", donoId)).error?.code).toBe(
        "42501",
      );
    });

    it("dono pede; segundo pedido em <5 min é barrado; após 5 min passa", async () => {
      expect((await pedir(prop2, donoId)).error).toBeNull();
      const d = (
        await admin
          .from("proposta_documentos")
          .select("status,tentado_em")
          .eq("proposta_id", prop2)
          .single()
      ).data;
      expect(d?.status).toBe("pendente");
      const r = await pedir(prop2, donoId);
      expect(r.error?.code).toBe("P0001");
      expect(r.error?.hint).toBe("muito_cedo");
      await admin
        .from("proposta_documentos")
        .update({ tentado_em: new Date(Date.now() - 6 * 60000).toISOString() })
        .eq("proposta_id", prop2);
      expect((await pedir(prop2, donoId)).error).toBeNull();
    });

    it("matriz pode; documento ok não recaptura; não transmitida é barrada", async () => {
      const matrizUid = (await matriz.auth.getUser()).data.user!.id;
      await admin.from("proposta_documentos").update({ tentado_em: null }).eq("proposta_id", prop2);
      expect((await pedir(prop2, matrizUid)).error).toBeNull();
      expect((await pedir(proposta, donoId)).error?.hint).toBe("ja_capturado");
      await admin.from("propostas").update({ transmissao_status: "falha" }).eq("id", prop2);
      expect((await pedir(prop2, donoId)).error?.hint).toBe("nao_transmitida");
    });
  });

  it("cascade ao apagar a proposta", async () => {
    await admin.from("cotacao_transmissoes").delete().eq("proposta_id", proposta);
    expect((await admin.from("propostas").delete().eq("id", proposta)).error).toBeNull();
    const { count } = await admin
      .from("proposta_documentos")
      .select("*", { count: "exact", head: true })
      .eq("proposta_id", proposta);
    expect(count).toBe(0);
  });

  it("bucket privado, só PDF, 10 MB, sem policy para anon/authenticated", async () => {
    const { data } = await admin.storage.getBucket("propostas-docs");
    const b = data as unknown as {
      public: boolean;
      file_size_limit: number;
      allowed_mime_types: string[];
    };
    expect(b.public).toBe(false);
    expect(b.file_size_limit).toBe(10485760);
    expect(b.allowed_mime_types).toEqual(["application/pdf"]);
    const up = await dono.storage
      .from("propostas-docs")
      .upload("x/y.pdf", new Blob(["%PDF-"], { type: "application/pdf" }));
    expect(up.error).not.toBeNull();
    expect((await dono.storage.from("propostas-docs").list("")).data ?? []).toHaveLength(0);
  });
});
