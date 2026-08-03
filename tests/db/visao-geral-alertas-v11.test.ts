/**
 * V11.7.5 / V11.7.6a (Frente 7 — Visão geral) — os 2 alertas de banco novos:
 *
 * - `contar_pendentes_seguradora_visao_geral`: corrige o bug vivo em
 *   `visao-geral.tsx:275` (heurística `status==='gerada'` tratava "ainda não
 *   enviada" como pendência). A fórmula certa (transmitida, não emitida, não
 *   cancelada) já existia no CTE de `funis_por_canal_visao_geral`.
 * - `franquias_abaixo_meta_visao_geral`: régua server-side sobre a fonte real
 *   de venda (`propostas.emitida_em`), pró-rata de `metas.meta_vendas` pela
 *   janela — mesmo padrão de `fn_calcular_performance_pessoa` (D3).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { admin, anonClient, criarPersonaComEmpresa, loginMatriz, uniq } from "../helpers/supabase";

type AlertasClient = {
  rpc: (
    nome: "contar_pendentes_seguradora_visao_geral" | "franquias_abaixo_meta_visao_geral",
    args: { p_inicio: string; p_fim: string },
  ) => Promise<{ data: number | null; error: { message: string } | null }>;
};

// Janela de exatamente 30 dias corridos em America/Sao_Paulo (2026-07-01T00:00
// a 2026-07-31T00:00 local) — pró-rata de meta fica igual à meta cheia
// (meta_vendas * 30/30), o que simplifica os cálculos esperados nos testes.
const INICIO = "2026-07-01T03:00:00.000Z";
const FIM = "2026-07-31T03:00:00.000Z";
const ANO = 2026;
const MES = 7;

async function contarPendentes(client: AlertasClient, inicio = INICIO, fim = FIM): Promise<number> {
  const { data, error } = await client.rpc("contar_pendentes_seguradora_visao_geral", {
    p_inicio: inicio,
    p_fim: fim,
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

async function contarFranquiasAbaixo(
  client: AlertasClient,
  inicio = INICIO,
  fim = FIM,
): Promise<number> {
  const { data, error } = await client.rpc("franquias_abaixo_meta_visao_geral", {
    p_inicio: inicio,
    p_fim: fim,
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

describe("V11.7.5 — contar_pendentes_seguradora_visao_geral()", () => {
  let matriz: AlertasClient;

  beforeAll(async () => {
    matriz = (await loginMatriz()) as unknown as AlertasClient;
  });

  it("conta só transmitida+não emitida+não cancelada; ignora emitida, cancelada e ainda-não-transmitida", async () => {
    const vendedor = await criarPersonaComEmpresa("vendedor", { emailPrefix: "pend-seg" });
    const vendedorClient = vendedor.client as unknown as AlertasClient;

    const { error } = await admin.from("propostas").insert([
      {
        empresa_id: vendedor.empresaId,
        responsavel_id: vendedor.userId,
        numero: uniq("PEND"),
        status: "transmitida",
        transmitida_em: "2026-07-10T12:00:00.000Z",
      }, // pendente — conta
      {
        empresa_id: vendedor.empresaId,
        responsavel_id: vendedor.userId,
        numero: uniq("EMIT"),
        status: "transmitida",
        transmitida_em: "2026-07-10T12:00:00.000Z",
        emitida_em: "2026-07-11T12:00:00.000Z",
      }, // emitida — não conta
      {
        empresa_id: vendedor.empresaId,
        responsavel_id: vendedor.userId,
        numero: uniq("CANC"),
        status: "cancelada",
        transmitida_em: "2026-07-10T12:00:00.000Z",
        cancelada_em: "2026-07-12T12:00:00.000Z",
      }, // cancelada — não conta
      {
        empresa_id: vendedor.empresaId,
        responsavel_id: vendedor.userId,
        numero: uniq("GER"),
        status: "gerada",
      }, // status='gerada', transmitida_em null — ainda não enviada, NÃO é pendência (bug corrigido)
      {
        empresa_id: vendedor.empresaId,
        responsavel_id: vendedor.userId,
        numero: uniq("FORA"),
        status: "transmitida",
        transmitida_em: FIM, // transmitida_em >= p_fim: fora da janela semiaberta
      },
    ]);
    if (error) throw error;

    expect(await contarPendentes(vendedorClient)).toBe(1);
  });

  it("RLS: usuário sem escopo pra ver a empresa não vê a proposta pendente de outra rede", async () => {
    const dono = await criarPersonaComEmpresa("vendedor", { emailPrefix: "pend-seg-dono" });
    const fora = await criarPersonaComEmpresa("vendedor", { emailPrefix: "pend-seg-fora" });

    const baseline = await contarPendentes(matriz);

    const { error } = await admin.from("propostas").insert({
      empresa_id: dono.empresaId,
      responsavel_id: dono.userId,
      numero: uniq("RLS-PEND"),
      status: "transmitida",
      transmitida_em: "2026-07-15T12:00:00.000Z",
    });
    if (error) throw error;

    expect(await contarPendentes(fora.client as unknown as AlertasClient)).toBe(0);
    // matriz vê tudo (has_role matriz em empresas_visiveis) — a nova pendência aparece.
    expect(await contarPendentes(matriz)).toBe(baseline + 1);
  });

  it("anon não executa e intervalo inválido é rejeitado", async () => {
    const anon = anonClient() as unknown as AlertasClient;
    const negado = await anon.rpc("contar_pendentes_seguradora_visao_geral", {
      p_inicio: INICIO,
      p_fim: FIM,
    });
    expect(negado.error?.message).toMatch(/permission denied/i);

    const invalido = await matriz.rpc("contar_pendentes_seguradora_visao_geral", {
      p_inicio: FIM,
      p_fim: INICIO,
    });
    expect(invalido.error?.message).toContain("intervalo_invalido");
  });
});

describe("V11.7.6a — franquias_abaixo_meta_visao_geral()", () => {
  let matriz: AlertasClient;

  beforeAll(async () => {
    matriz = (await loginMatriz()) as unknown as AlertasClient;
  });

  it("conta franquia abaixo da meta pró-rata; ignora acima da meta, cancelada (não é venda) e sem meta cadastrada", async () => {
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "franq-meta-master" });

    const abaixo = await criarPersonaComEmpresa("vendedor", {
      parentId: master.empresaId,
      superiorId: master.userId,
      emailPrefix: "franq-meta-abaixo",
    });
    const acima = await criarPersonaComEmpresa("vendedor", {
      parentId: master.empresaId,
      superiorId: master.userId,
      emailPrefix: "franq-meta-acima",
    });
    const semMeta = await criarPersonaComEmpresa("vendedor", {
      parentId: master.empresaId,
      superiorId: master.userId,
      emailPrefix: "franq-meta-sem",
    });
    const canceladaConta = await criarPersonaComEmpresa("vendedor", {
      parentId: master.empresaId,
      superiorId: master.userId,
      emailPrefix: "franq-meta-cancel",
    });

    const { error: metasError } = await admin.from("metas").insert([
      { escopo: "empresa", ref_id: abaixo.empresaId, ano: ANO, mes: MES, meta_vendas: 5 },
      { escopo: "empresa", ref_id: acima.empresaId, ano: ANO, mes: MES, meta_vendas: 5 },
      { escopo: "empresa", ref_id: canceladaConta.empresaId, ano: ANO, mes: MES, meta_vendas: 1 },
      // semMeta: propositalmente sem linha em metas.
    ]);
    if (metasError) throw metasError;

    const propostas = [
      // abaixo: 3 vendas emitidas < meta pró-rata (5) — entra na contagem.
      ...[1, 2, 3].map((n) => ({
        empresa_id: abaixo.empresaId,
        responsavel_id: abaixo.userId,
        numero: uniq(`ABAIXO-${n}`),
        status: "transmitida",
        emitida_em: "2026-07-10T12:00:00.000Z",
      })),
      // acima: 6 vendas emitidas >= meta pró-rata (5) — não entra.
      ...[1, 2, 3, 4, 5, 6].map((n) => ({
        empresa_id: acima.empresaId,
        responsavel_id: acima.userId,
        numero: uniq(`ACIMA-${n}`),
        status: "transmitida",
        emitida_em: "2026-07-10T12:00:00.000Z",
      })),
      // canceladaConta: 1 proposta emitida MAS cancelada — não conta como venda
      // real, então vendas efetivas = 0 < meta (1) — entra na contagem.
      {
        empresa_id: canceladaConta.empresaId,
        responsavel_id: canceladaConta.userId,
        numero: uniq("CANC-VENDA"),
        status: "cancelada",
        emitida_em: "2026-07-10T12:00:00.000Z",
        cancelada_em: "2026-07-12T12:00:00.000Z",
      },
    ];
    const { error } = await admin.from("propostas").insert(propostas);
    if (error) throw error;

    const masterClient = master.client as unknown as AlertasClient;
    // abaixo (3<5) + canceladaConta (0<1) entram; acima (6>=5) e semMeta (sem linha) não.
    expect(await contarFranquiasAbaixo(masterClient)).toBe(2);
  });

  it("RLS: só conta franquias visíveis ao usuário (master não vê rede lateral)", async () => {
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "franq-meta-rls-master" });
    const franquiaRede = await criarPersonaComEmpresa("vendedor", {
      parentId: master.empresaId,
      superiorId: master.userId,
      emailPrefix: "franq-meta-rls-rede",
    });
    const franquiaLateral = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "franq-meta-rls-lateral",
    });

    const { error: metasError } = await admin.from("metas").insert([
      { escopo: "empresa", ref_id: franquiaRede.empresaId, ano: ANO, mes: MES, meta_vendas: 5 },
      { escopo: "empresa", ref_id: franquiaLateral.empresaId, ano: ANO, mes: MES, meta_vendas: 5 },
    ]);
    if (metasError) throw metasError;
    // nenhuma das duas empresas tem vendas emitidas na janela — ambas ficariam
    // "abaixo" se fossem visíveis; só franquiaRede pertence à rede do master.

    const masterClient = master.client as unknown as AlertasClient;
    expect(await contarFranquiasAbaixo(masterClient)).toBe(1);

    const fora = await criarPersonaComEmpresa("vendedor", { emailPrefix: "franq-meta-rls-fora" });
    expect(await contarFranquiasAbaixo(fora.client as unknown as AlertasClient)).toBe(0);

    // matriz vê as duas (empresas_visiveis retorna tudo para matriz).
    const baseline = await contarFranquiasAbaixo(matriz);
    expect(baseline).toBeGreaterThanOrEqual(2);
  });

  it("anon não executa e intervalo inválido é rejeitado", async () => {
    const anon = anonClient() as unknown as AlertasClient;
    const negado = await anon.rpc("franquias_abaixo_meta_visao_geral", {
      p_inicio: INICIO,
      p_fim: FIM,
    });
    expect(negado.error?.message).toMatch(/permission denied/i);

    const invalido = await matriz.rpc("franquias_abaixo_meta_visao_geral", {
      p_inicio: FIM,
      p_fim: INICIO,
    });
    expect(invalido.error?.message).toContain("intervalo_invalido");
  });
});
