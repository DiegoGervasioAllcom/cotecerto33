import { beforeAll, describe, expect, it } from "vitest";
import { admin, anonClient, criarPersonaComEmpresa, loginMatriz, uniq } from "../helpers/supabase";

type Funil = {
  canal_id: string;
  canal_nome: string;
  ordem: number;
  indicacoes: number;
  contatos: number;
  cotacoes: number;
  negociacoes: number;
  transmissoes: number;
  pendentes: number;
  vendas_emitidas: number;
};

type FunilClient = {
  rpc: (
    nome: "funis_por_canal_visao_geral",
    args: { p_inicio: string; p_fim: string },
  ) => Promise<{ data: Funil[] | null; error: { message: string } | null }>;
};

const inicio = "2026-07-01T03:00:00.000Z";
const fim = "2026-08-01T03:00:00.000Z";

async function rpc(client: FunilClient, de = inicio, ate = fim): Promise<Funil[]> {
  const { data, error } = await client.rpc("funis_por_canal_visao_geral", {
    p_inicio: de,
    p_fim: ate,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

describe("V11.7.3 — funis_por_canal_visao_geral()", () => {
  let matriz: FunilClient;
  let vendedor: FunilClient;
  let vendedorId: string;
  let empresaId: string;
  let movidaId: string;
  let googleId: string;

  beforeAll(async () => {
    matriz = (await loginMatriz()) as unknown as FunilClient;
    const persona = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "funil-canal-vendedor",
    });
    vendedor = persona.client as unknown as FunilClient;
    vendedorId = persona.userId;
    empresaId = persona.empresaId;

    const { data: canais, error: canaisError } = await admin
      .from("canais")
      .select("id, nome")
      .is("empresa_id", null)
      .in("nome", ["Movida", "Google"]);
    if (canaisError) throw canaisError;
    movidaId = canais?.find((c) => c.nome === "Movida")?.id ?? "";
    googleId = canais?.find((c) => c.nome === "Google")?.id ?? "";
    if (!movidaId || !googleId) throw new Error("seed dos canais do funil ausente");

    const outra = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "funil-canal-fora",
    });

    const { data: leads, error: leadsError } = await admin
      .from("leads")
      .insert([
        {
          nome: uniq("Movida completo"),
          empresa_id: empresaId,
          responsavel_id: vendedorId,
          canal_id: movidaId,
          criado_em: "2026-07-10T12:00:00.000Z",
          ultimo_atendimento_em: "2026-07-10T12:05:00.000Z",
        },
        {
          nome: uniq("Movida pendente"),
          empresa_id: empresaId,
          responsavel_id: vendedorId,
          canal_id: movidaId,
          criado_em: "2026-07-11T12:00:00.000Z",
        },
        {
          nome: uniq("Google fora"),
          empresa_id: outra.empresaId,
          responsavel_id: outra.userId,
          canal_id: googleId,
          criado_em: "2026-07-12T12:00:00.000Z",
        },
        {
          nome: uniq("Movida fora periodo"),
          empresa_id: empresaId,
          responsavel_id: vendedorId,
          canal_id: movidaId,
          criado_em: fim,
        },
      ])
      .select("id, nome");
    if (leadsError) throw leadsError;

    const completo = leads?.find((l) => l.nome.startsWith("Movida completo"))?.id ?? "";
    const pendente = leads?.find((l) => l.nome.startsWith("Movida pendente"))?.id ?? "";
    if (!completo || !pendente) throw new Error("fixtures de lead ausentes");

    const { data: cotacoes, error: cotacoesError } = await admin
      .from("cotacoes")
      .insert([
        {
          empresa_id: empresaId,
          responsavel_id: vendedorId,
          lead_id: completo,
          status: "proposta",
        },
        {
          empresa_id: empresaId,
          responsavel_id: vendedorId,
          lead_id: pendente,
          status: "proposta",
        },
      ])
      .select("id, lead_id");
    if (cotacoesError) throw cotacoesError;

    const cotCompleto = cotacoes?.find((c) => c.lead_id === completo)?.id ?? "";
    const cotPendente = cotacoes?.find((c) => c.lead_id === pendente)?.id ?? "";

    const { error: propostasError } = await admin.from("propostas").insert([
      {
        empresa_id: empresaId,
        responsavel_id: vendedorId,
        lead_id: completo,
        cotacao_id: cotCompleto,
        numero: uniq("PROP"),
        status: "transmitida",
        negociacao_status: "aceita",
        transmitida_em: "2026-07-13T12:00:00.000Z",
        emitida_em: "2026-07-14T12:00:00.000Z",
      },
      {
        empresa_id: empresaId,
        responsavel_id: vendedorId,
        lead_id: pendente,
        cotacao_id: cotPendente,
        numero: uniq("PROP"),
        status: "transmitida",
        negociacao_status: "em_negociacao",
        transmitida_em: "2026-07-15T12:00:00.000Z",
      },
    ]);
    if (propostasError) throw propostasError;
  });

  it("configura exatamente Movida, Google, Facebook e Manual pela taxonomia", async () => {
    const funis = await rpc(matriz);
    expect(funis.map((f) => f.canal_nome)).toEqual(["Movida", "Google", "Facebook", "Manual"]);
    expect(funis.map((f) => f.ordem)).toEqual([1, 2, 3, 5]);
  });

  it("agrega marcos distintos por lead e respeita a janela [inicio,fim)", async () => {
    const movida = (await rpc(vendedor)).find((f) => f.canal_id === movidaId);
    expect(movida).toMatchObject({
      indicacoes: 2,
      contatos: 2,
      cotacoes: 2,
      negociacoes: 2,
      transmissoes: 2,
      pendentes: 1,
      vendas_emitidas: 1,
    });
  });

  it("RLS impede o vendedor de agregar leads de outra empresa", async () => {
    const google = (await rpc(vendedor)).find((f) => f.canal_id === googleId);
    expect(google).toMatchObject({
      indicacoes: 0,
      contatos: 0,
      cotacoes: 0,
      negociacoes: 0,
      transmissoes: 0,
      pendentes: 0,
      vendas_emitidas: 0,
    });

    const googleMatriz = (await rpc(matriz)).find((f) => f.canal_id === googleId);
    expect(googleMatriz?.indicacoes).toBeGreaterThanOrEqual(1);
  });

  it("master vê o funil da sua rede e NÃO agrega a rede lateral", async () => {
    const master = await criarPersonaComEmpresa("master", {
      emailPrefix: "funil-canal-master",
    });
    const vendedorDaRede = await criarPersonaComEmpresa("vendedor", {
      superiorId: master.userId,
      emailPrefix: "funil-canal-rede-master",
    });
    const vendedorLateral = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "funil-canal-rede-lateral",
    });

    const { error } = await admin.from("leads").insert([
      {
        nome: uniq("Movida rede master"),
        empresa_id: vendedorDaRede.empresaId,
        responsavel_id: vendedorDaRede.userId,
        canal_id: movidaId,
        criado_em: "2026-07-20T12:00:00.000Z",
      },
      {
        nome: uniq("Google rede lateral"),
        empresa_id: vendedorLateral.empresaId,
        responsavel_id: vendedorLateral.userId,
        canal_id: googleId,
        criado_em: "2026-07-20T12:00:00.000Z",
      },
    ]);
    if (error) throw error;

    const funis = await rpc(master.client as unknown as FunilClient);
    expect(funis.find((f) => f.canal_id === movidaId)?.indicacoes).toBe(1);
    expect(funis.find((f) => f.canal_id === googleId)?.indicacoes).toBe(0);
  });

  it("anon não executa e intervalo inválido é rejeitado", async () => {
    const anon = anonClient() as unknown as FunilClient;
    const negado = await anon.rpc("funis_por_canal_visao_geral", {
      p_inicio: inicio,
      p_fim: fim,
    });
    expect(negado.error?.message).toMatch(/permission denied/i);

    const invalido = await vendedor.rpc("funis_por_canal_visao_geral", {
      p_inicio: fim,
      p_fim: inicio,
    });
    expect(invalido.error?.message).toContain("intervalo_invalido");
  });
});
