/**
 * V11 · D3 (Frente 4) — fn_calcular_performance_pessoa.
 *
 * Só calcula os números da janela deslizante (dias corridos) — não decide
 * status (isso é do job, D4). Só `service_role` executa: qualquer
 * autenticado poder chamar isso pra um profile_id arbitrário vazaria
 * leads/propostas/comissão de terceiros.
 */
import { describe, it, expect } from "vitest";
import { admin, criarPersonaComEmpresa, uniq } from "../helpers/supabase";

const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
function ha(dias: number, horasExtra = 0): string {
  return new Date(Date.now() - dias * DIA_MS - horasExtra * HORA_MS).toISOString();
}

/** Retorno de fn_calcular_performance_pessoa é jsonb — o client tipa como Json genérico. */
interface ResultadoPerformance {
  leads: number;
  cotacoes: number;
  propostas: number;
  vendas: number;
  cancelamentos: number;
  conversao_pct: number;
  comissao: number;
  dias_sem_venda: number;
  meta_vendas_mes: number | null;
  meta_vendas_prorata: number | null;
}

describe("V11 · D3 — fn_calcular_performance_pessoa", () => {
  it("rejeita bloco inválido", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("perf-bloco") });
    const { error } = await admin.rpc("fn_calcular_performance_pessoa", {
      p_profile_id: pessoa.userId,
      p_bloco: "xxx",
    });
    expect(error?.message).toContain("Bloco inválido");
  });

  it("cliente autenticado (não service_role) não consegue chamar — função não é exposta", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("perf-gate") });
    const { error } = await pessoa.client.rpc("fn_calcular_performance_pessoa", {
      p_profile_id: pessoa.userId,
      p_bloco: "interno",
    });
    expect(error).not.toBeNull();
  });

  it("calcula leads/cotações/propostas/vendas/conversão/cancelamentos/comissão/meta na janela", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("perf-calc") });
    const { userId, empresaId } = pessoa;

    const { data: regua } = await admin
      .from("regua_performance_config")
      .select("janela_dias")
      .eq("bloco", "interno")
      .single();
    const janela = regua!.janela_dias;

    // 3 leads dentro da janela, 2 fora
    await admin.from("leads").insert([
      { empresa_id: empresaId, responsavel_id: userId, nome: "L1", criado_em: ha(5) },
      { empresa_id: empresaId, responsavel_id: userId, nome: "L2", criado_em: ha(3) },
      { empresa_id: empresaId, responsavel_id: userId, nome: "L3", criado_em: ha(1) },
      { empresa_id: empresaId, responsavel_id: userId, nome: "L4-fora", criado_em: ha(janela + 5) },
      { empresa_id: empresaId, responsavel_id: userId, nome: "L5-fora", criado_em: ha(janela + 8) },
    ]);

    // 2 cotações dentro, 1 fora
    await admin.from("cotacoes").insert([
      { empresa_id: empresaId, responsavel_id: userId, criado_em: ha(4) },
      { empresa_id: empresaId, responsavel_id: userId, criado_em: ha(2) },
      { empresa_id: empresaId, responsavel_id: userId, criado_em: ha(janela + 3) },
    ]);

    // p1: emitida dentro da janela -> conta como venda
    // p2: criada e emitida fora da janela, cancelada DENTRO -> só cancelamento
    // p3: gerada dentro da janela, sem emissão/cancelamento -> só "propostas"
    await admin.from("propostas").insert([
      {
        empresa_id: empresaId,
        responsavel_id: userId,
        status: "transmitida",
        criado_em: ha(5),
        emitida_em: ha(4, 1),
      },
      {
        empresa_id: empresaId,
        responsavel_id: userId,
        status: "cancelada",
        criado_em: ha(janela + 20),
        emitida_em: ha(janela + 20),
        cancelada_em: ha(3),
      },
      {
        empresa_id: empresaId,
        responsavel_id: userId,
        status: "gerada",
        criado_em: ha(2),
      },
    ]);

    // comissão: dentro da janela crédito 500 + débito 100 = 400; fora, 1000 (ignorado)
    await admin.from("comissao_lancamentos").insert([
      {
        vendedor_id: userId,
        beneficiario_id: userId,
        tipo: "credito",
        valor: 500,
        descricao: uniq("credito-dentro"),
        criado_em: ha(2),
      },
      {
        vendedor_id: userId,
        beneficiario_id: userId,
        tipo: "debito",
        valor: 100,
        descricao: uniq("debito-dentro"),
        criado_em: ha(1),
      },
      {
        vendedor_id: userId,
        beneficiario_id: userId,
        tipo: "credito",
        valor: 1000,
        descricao: uniq("credito-fora"),
        criado_em: ha(janela + 10),
      },
    ]);

    const hoje = new Date();
    await admin.from("metas").insert({
      escopo: "usuario",
      ref_id: userId,
      ano: hoje.getFullYear(),
      mes: hoje.getMonth() + 1,
      meta_vendas: 10,
    });

    const { data: raw, error } = await admin.rpc("fn_calcular_performance_pessoa", {
      p_profile_id: userId,
      p_bloco: "interno",
    });
    expect(error).toBeNull();
    const data = raw as unknown as ResultadoPerformance;

    expect(data.leads).toBe(3);
    expect(data.cotacoes).toBe(2);
    expect(data.propostas).toBe(2); // p1 + p3 (p2 tem criado_em fora da janela)
    expect(data.vendas).toBe(1); // só p1
    expect(data.cancelamentos).toBe(1); // só p2
    expect(data.conversao_pct).toBeCloseTo(33.33, 1); // 1 venda / 3 leads
    expect(data.comissao).toBe(400);
    expect(data.dias_sem_venda).toBeGreaterThanOrEqual(4);
    expect(data.dias_sem_venda).toBeLessThanOrEqual(5);
    expect(data.meta_vendas_mes).toBe(10);
    expect(data.meta_vendas_prorata).toBeCloseTo((10 * janela) / 30, 1);
  });

  it("sem lead nenhum, conversão é 0 (não divide por zero)", async () => {
    const pessoa = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("perf-zero") });
    const { data: raw, error } = await admin.rpc("fn_calcular_performance_pessoa", {
      p_profile_id: pessoa.userId,
      p_bloco: "rede",
    });
    expect(error).toBeNull();
    const data = raw as unknown as ResultadoPerformance;
    expect(data.leads).toBe(0);
    expect(data.vendas).toBe(0);
    expect(data.conversao_pct).toBe(0);
    expect(data.meta_vendas_mes).toBeNull();
    expect(data.meta_vendas_prorata).toBeNull();
  });
});
