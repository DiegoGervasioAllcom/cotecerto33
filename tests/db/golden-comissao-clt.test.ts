import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/**
 * G4.3 (049) — motor de comissão do vendedor CLT (cálculo puro, fn_comissao_clt).
 *
 * Faixas progressivas reais (seed clt_config.progressiva_num, extraídas do
 * protótipo / seed de 005):
 *   até 40.000,00        -> 2,00%
 *   40.000,01 – 55.000   -> 2,25%
 *   55.000,01 – 65.000   -> 2,50%
 *   65.000,01 – 75.000   -> 2,75%
 *   75.000,01 – 85.000   -> 3,00%
 *   85.000,01 – 100.000  -> 3,25%
 *   acima de 100.000     -> 3,50%
 *
 * Fator "novas" (média de % de comissão do PRÓPRIO vendedor nas vendas
 * tipo_venda='novo'): <17% -> 70% | 17-18% -> 80% | 18,01-19% -> 90% |
 * 19,01-20% -> 95% | acima de 20% -> 100%.
 *
 * A função fn_comissao_clt tem EXECUTE revogado de public/anon/authenticated
 * (peça interna do motor) — os testes chamam via `admin` (service_role),
 * igual à fn_pct_comissao_efetivo da 048.
 */
describe("G4.3 — fn_comissao_clt (golden tests)", () => {
  let vendedor: Db;
  let vendedorId: string;
  let empresaId: string;
  const competencia = "2026-07";

  beforeAll(async () => {
    const p = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-clt-golden" });
    vendedor = p.client;
    vendedorId = p.userId;
    empresaId = p.empresaId;
    void vendedor;
  });

  async function inserirProposta(opts: {
    premio: number;
    pago?: boolean;
    tipoVenda?: string | null;
    comissaoPct?: number | null;
    competenciaAlvo?: string;
    cancelada?: boolean;
  }) {
    // pago_em na competência 2026-07 (dia < 26): 2026-07-10.
    const pagoEm =
      opts.pago === false
        ? null
        : (opts.competenciaAlvo === "2026-08" ? "2026-07-28" : "2026-07-10") + "T12:00:00-03:00";

    const { data: proposta, error } = await admin
      .from("propostas")
      .insert({
        empresa_id: empresaId,
        responsavel_id: vendedorId,
        status: "gerada",
        premio: opts.premio,
        tipo_venda: opts.tipoVenda ?? null,
        comissao_pct: opts.comissaoPct ?? null,
        pago_em: pagoEm,
        cancelada_em: opts.cancelada ? "2026-07-15T12:00:00-03:00" : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return proposta.id as string;
  }

  async function limparPropostasDoVendedor() {
    await admin.from("propostas").delete().eq("responsavel_id", vendedorId);
  }

  async function limparElite() {
    await admin
      .from("profiles")
      .update({ faixa_elite_valor: null, faixa_elite_pct: null })
      .eq("id", vendedorId);
  }

  async function calcular(comp = competencia) {
    const { data, error } = await admin.rpc("fn_comissao_clt", {
      p_vendedor: vendedorId,
      p_competencia: comp,
    });
    expect(error).toBeNull();
    return data![0] as {
      producao_total: number;
      producao_novas: number;
      producao_remanejo: number;
      pct_faixa: number;
      valor_base: number;
      valor_elite: number;
      fator_novas: number;
      fator_remanejo: number;
      fator_aplicado: number;
      valor_final: number;
    };
  }

  describe("7 faixas progressivas (produção dentro de cada faixa, sem Elite, sem fator)", () => {
    const casos: Array<{ premio: number; pct: number; valor: number }> = [
      { premio: 20000, pct: 2.0, valor: 400 },
      { premio: 45000, pct: 2.25, valor: 1012.5 },
      { premio: 60000, pct: 2.5, valor: 1500 },
      { premio: 70000, pct: 2.75, valor: 1925 },
      { premio: 80000, pct: 3.0, valor: 2400 },
      { premio: 90000, pct: 3.25, valor: 2925 },
      { premio: 110000, pct: 3.5, valor: 3850 },
    ];

    for (const c of casos) {
      it(`produção ${c.premio} -> faixa ${c.pct}% -> valor_final ${c.valor}`, async () => {
        await limparPropostasDoVendedor();
        await limparElite();
        await inserirProposta({ premio: c.premio });
        const r = await calcular();
        expect(r.producao_total).toBe(c.premio);
        expect(r.pct_faixa).toBe(c.pct);
        expect(r.valor_elite).toBe(0);
        expect(r.fator_aplicado).toBe(1);
        expect(r.valor_final).toBeCloseTo(c.valor, 6);
      });
    }
  });

  describe("borda exata de faixa: 40.000,00 vs 40.000,01", () => {
    it("40.000,00 ainda é a faixa 1 (2,00%)", async () => {
      await limparPropostasDoVendedor();
      await limparElite();
      await inserirProposta({ premio: 40000.0 });
      const r = await calcular();
      expect(r.pct_faixa).toBe(2.0);
      expect(r.valor_final).toBeCloseTo(800.0, 6);
    });

    it("40.000,01 já é a faixa 2 (2,25%)", async () => {
      await limparPropostasDoVendedor();
      await limparElite();
      await inserirProposta({ premio: 40000.01 });
      const r = await calcular();
      expect(r.pct_faixa).toBe(2.25);
      expect(r.valor_final).toBeCloseTo(900.000225, 4);
    });
  });

  describe("faixa Elite individual (modelo EXCEDENTE)", () => {
    it("produção 120.000, limiar 100.000, faixa 3,50% (bracket real) + Elite 4,00% -> 4.300", async () => {
      await limparPropostasDoVendedor();
      await admin
        .from("profiles")
        .update({ faixa_elite_valor: 100000, faixa_elite_pct: 4.0 })
        .eq("id", vendedorId);

      await inserirProposta({ premio: 120000 });
      const r = await calcular();
      expect(r.producao_total).toBe(120000);
      expect(r.pct_faixa).toBe(3.5);
      // valor_base = min(120000,100000) * 3,5% = 3.500
      expect(r.valor_base).toBeCloseTo(3500, 6);
      // valor_elite = max(120000-100000,0) * 4,00% = 800
      expect(r.valor_elite).toBeCloseTo(800, 6);
      expect(r.valor_final).toBeCloseTo(4300, 6);

      await limparElite();
    });
  });

  describe("vendedor sem faixa Elite configurada -> só a progressiva", () => {
    it("faixa_elite_valor/pct nulos -> valor_elite = 0 e valor_final = só a faixa", async () => {
      await limparPropostasDoVendedor();
      await limparElite();
      await inserirProposta({ premio: 50000 });
      const r = await calcular();
      expect(r.pct_faixa).toBe(2.25);
      expect(r.valor_elite).toBe(0);
      expect(r.valor_final).toBeCloseTo(1125, 6);
    });
  });

  describe("fator novas: média de % de comissão do PRÓPRIO vendedor", () => {
    it("2 propostas 'novo' com comissao_pct 10 e 20 (média 15, <17%) -> fator 70% aplicado", async () => {
      await limparPropostasDoVendedor();
      await limparElite();
      await inserirProposta({ premio: 10000, tipoVenda: "novo", comissaoPct: 10 });
      await inserirProposta({ premio: 10000, tipoVenda: "novo", comissaoPct: 20 });

      const r = await calcular();
      expect(r.producao_total).toBe(20000);
      expect(r.pct_faixa).toBe(2.0);
      // valor_base = 20000 * 2% = 400
      expect(r.valor_base).toBeCloseTo(400, 6);
      expect(r.fator_novas).toBe(70);
      expect(r.fator_aplicado).toBeCloseTo(0.7, 6);
      expect(r.valor_final).toBeCloseTo(280, 6);
    });
  });

  describe("produção zero -> comissão zero", () => {
    it("vendedor sem nenhuma proposta paga na competência -> tudo zero", async () => {
      await limparPropostasDoVendedor();
      await limparElite();
      const r = await calcular();
      expect(r.producao_total).toBe(0);
      expect(r.valor_base).toBe(0);
      expect(r.valor_elite).toBe(0);
      expect(r.valor_final).toBe(0);
      expect(r.fator_aplicado).toBe(1);
    });
  });

  describe("competência sem propostas PAGAS (mas com emitida/não-paga) -> não conta", () => {
    it("proposta não paga na competência não entra na produção", async () => {
      await limparPropostasDoVendedor();
      await limparElite();
      await inserirProposta({ premio: 999999, pago: false });
      const r = await calcular();
      expect(r.producao_total).toBe(0);
      expect(r.valor_final).toBe(0);
    });
  });

  describe("proposta cancelada não conta na produção", () => {
    it("50.000 paga normal + 30.000 paga mas cancelada -> produção só 50.000 (faixa 2,25% -> 1.125,00)", async () => {
      await limparPropostasDoVendedor();
      await limparElite();
      await inserirProposta({ premio: 50000 });
      await inserirProposta({ premio: 30000, cancelada: true });

      const r = await calcular();
      // produção = 50.000 (a de 30.000 tem cancelada_em setado e é excluída
      // do filtro `p.cancelada_em is null` da fn_comissao_clt).
      // faixa: 40.000,01 – 55.000 -> 2,25% => valor = 50.000 * 2,25% = 1.125,00
      expect(r.producao_total).toBe(50000);
      expect(r.pct_faixa).toBe(2.25);
      expect(r.valor_final).toBeCloseTo(1125, 6);
    });
  });

  describe("fator remanejo isolado (só produção de renovação)", () => {
    it("2 propostas 'renovacao' de 10.000 com comissao_pct 12 e 14 (média 13, <14%) -> fator 70% -> 280,00", async () => {
      await limparPropostasDoVendedor();
      await limparElite();
      await inserirProposta({ premio: 10000, tipoVenda: "renovacao", comissaoPct: 12 });
      await inserirProposta({ premio: 10000, tipoVenda: "renovacao", comissaoPct: 14 });

      const r = await calcular();
      // produção total = 20.000, faixa até 40.000 -> 2,00% => valor_base = 400
      // média comissao_pct do grupo renovacao = (12+14)/2 = 13, <14% -> fator_remalho_num = 70
      // valor_final = 400 * 0,70 = 280,00
      expect(r.producao_total).toBe(20000);
      expect(r.producao_remanejo).toBe(20000);
      expect(r.pct_faixa).toBe(2.0);
      expect(r.valor_base).toBeCloseTo(400, 6);
      expect(r.fator_remanejo).toBe(70);
      expect(r.fator_aplicado).toBeCloseTo(0.7, 6);
      expect(r.valor_final).toBeCloseTo(280, 6);
    });
  });

  describe("ponderação mista: produção em novas E remanejo com fatores diferentes", () => {
    it("novas 30.000 (pct médio 25 -> fator 100) + remanejo 10.000 (pct médio 12 -> fator 70) -> fator ponderado 0,925 -> 740,00", async () => {
      await limparPropostasDoVendedor();
      await limparElite();
      await inserirProposta({ premio: 30000, tipoVenda: "novo", comissaoPct: 25 });
      await inserirProposta({ premio: 10000, tipoVenda: "renovacao", comissaoPct: 12 });

      const r = await calcular();
      // produção total = 40.000, faixa até 40.000 -> 2,00% => valor_base = 800
      // fator_novas: média 25% > 20% -> 100
      // fator_remanejo: média 12% < 14% -> 70
      // fator ponderado = (30000*100 + 10000*70) / 40000 / 100
      //                 = (3.000.000 + 700.000) / 40000 / 100 = 3.700.000 / 4.000.000 = 0,925
      // valor_final = 800 * 0,925 = 740,00
      expect(r.producao_total).toBe(40000);
      expect(r.producao_novas).toBe(30000);
      expect(r.producao_remanejo).toBe(10000);
      expect(r.pct_faixa).toBe(2.0);
      expect(r.valor_base).toBeCloseTo(800, 6);
      expect(r.fator_novas).toBe(100);
      expect(r.fator_remanejo).toBe(70);
      expect(r.fator_aplicado).toBeCloseTo(0.925, 6);
      expect(r.valor_final).toBeCloseTo(740, 6);
    });
  });

  describe("fn_comissao_clt não é exposta via RPC direta", () => {
    it("NEGATIVO: vendedor autenticado não consegue chamar a função (EXECUTE revogado)", async () => {
      const persona = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-clt-sonda" });
      const { data, error } = await persona.client.rpc("fn_comissao_clt", {
        p_vendedor: persona.userId,
        p_competencia: competencia,
      });
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });
});
