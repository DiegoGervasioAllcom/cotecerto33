import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/**
 * V12.4.12: `quiver_resultado_raw` não guarda htmlSnippet/rawText (dado pessoal
 * bruto do portal). Cobre a RPC registrar_premios_quiver, a função pura
 * quiver_sem_bruto e a limpeza em lote dos registros antigos.
 */
describe("quiver_resultado_raw sem bruto do portal", () => {
  let empresaId: string;
  let respId: string;
  let anon: Db;

  const cards = () => [
    {
      seguradora: "Porto",
      logo: "x.png",
      htmlSnippet: "<div>CPF 123.456.789-00</div>",
      rawText: "Fulano CPF 123.456.789-00",
      opcoes: [{ tipo: "Compreensiva", avista: "1.234,56", parcelas: "em 12x de R$ 110,00" }],
    },
    {
      seguradora: "Azul",
      rawText: "texto",
      opcoes: [{ tipo: "Básica", avista: "900,00" }],
    },
  ];

  const rpcLote = (c: Db, p_limite = 500) =>
    (
      c.rpc as unknown as (
        f: string,
        a: object,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    )("quiver_limpar_bruto_lote", { p_limite });

  async function novaCotacao() {
    const { data, error } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId, responsavel_id: respId, status: "enviada_quiver" })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  beforeAll(async () => {
    empresaId = (await criarEmpresa({ nome: "Empresa Quiver Sem Bruto" })).id;
    const p = await criarPersonaComEmpresa("vendedor", {
      empresaId,
      emailPrefix: "vend-quiver-bruto",
    });
    respId = p.userId;
    anon = p.client;
  });

  it("RPC sucesso: grava raw sem htmlSnippet/rawText, demais campos e prêmios intactos", async () => {
    const id = await novaCotacao();
    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: id,
      p_payload: { temPremios: true, extra: 1, cards: cards() } as never,
    });
    expect(error).toBeNull();

    const { data: cot } = await admin
      .from("cotacoes")
      .select("status,quiver_resultado_raw")
      .eq("id", id)
      .single();
    expect(cot?.status).toBe("calculada");
    const raw = cot?.quiver_resultado_raw as { extra: number; cards: Record<string, unknown>[] };
    expect(raw.extra).toBe(1);
    expect(raw.cards).toHaveLength(2);
    for (const c of raw.cards) {
      expect(c).not.toHaveProperty("htmlSnippet");
      expect(c).not.toHaveProperty("rawText");
    }
    expect(raw.cards[0]).toEqual({
      seguradora: "Porto",
      logo: "x.png",
      opcoes: cards()[0].opcoes,
    });
    expect(raw.cards[1].seguradora).toBe("Azul");

    const { data: premios } = await admin
      .from("cotacao_premios")
      .select("seguradora,cobertura,premio")
      .eq("cotacao_id", id)
      .order("seguradora");
    expect(premios?.map((p) => [p.seguradora, Number(p.premio)])).toEqual([
      ["Azul", 900],
      ["Porto", 1234.56],
    ]);
  });

  it("RPC erro: caminho erro_quiver também grava raw limpo", async () => {
    const id = await novaCotacao();
    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: id,
      p_payload: {
        temPremios: false,
        mensagem: "falhou",
        cards: [{ seguradora: "X", htmlSnippet: "<b>", rawText: "t" }],
      } as never,
    });
    expect(error).toBeNull();
    const { data } = await admin
      .from("cotacoes")
      .select("status,quiver_resultado_raw")
      .eq("id", id)
      .single();
    expect(data?.status).toBe("erro_quiver");
    expect(data?.quiver_resultado_raw).toEqual({
      temPremios: false,
      mensagem: "falhou",
      cards: [{ seguradora: "X" }],
    });
  });

  it("limpeza em lote: linha suja fica limpa; idempotente; usuário comum não executa", async () => {
    const id = await novaCotacao();
    const { error: eUp } = await admin
      .from("cotacoes")
      .update({ quiver_resultado_raw: { temPremios: true, cards: cards() } as never })
      .eq("id", id);
    expect(eUp).toBeNull();

    const cont = async () => {
      const { data } = await admin
        .from("cotacoes")
        .select("quiver_resultado_raw")
        .eq("id", id)
        .single();
      return JSON.stringify(data?.quiver_resultado_raw);
    };
    expect(await cont()).toContain("htmlSnippet");

    let n = 1;
    let guarda = 0;
    while (n > 0 && guarda++ < 50) {
      const r = await rpcLote(admin);
      expect(r.error).toBeNull();
      n = r.data as unknown as number;
    }
    const depois = await cont();
    expect(depois).not.toContain("htmlSnippet");
    expect(depois).not.toContain("rawText");
    expect(depois).toContain("Compreensiva");

    const again = await rpcLote(admin);
    expect(again.data).toBe(0);

    const neg = await rpcLote(anon, 1);
    expect(neg.error?.message ?? "").toMatch(/permission denied/i);
  });

  it("quiver_sem_bruto é interna: authenticated não executa", async () => {
    const r = await (
      anon.rpc as unknown as (
        f: string,
        a: object,
      ) => Promise<{ error: { message: string } | null }>
    )("quiver_sem_bruto", { p: {} });
    expect(r.error?.message ?? "").toMatch(/permission denied/i);
  });

  it("payload sem cards é gravado igual", async () => {
    const id = await novaCotacao();
    const payload = { temPremios: false, placaNaoEncontrada: true, mensagem: "m" };
    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: id,
      p_payload: payload as never,
    });
    expect(error).toBeNull();
    const { data } = await admin
      .from("cotacoes")
      .select("quiver_resultado_raw")
      .eq("id", id)
      .single();
    expect(data?.quiver_resultado_raw).toEqual(payload);
  });
});
