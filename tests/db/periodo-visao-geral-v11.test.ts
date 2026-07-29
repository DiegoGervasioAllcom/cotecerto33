import { beforeAll, describe, expect, it } from "vitest";
import { admin, anonClient, criarPersonaComEmpresa, loginMatriz } from "../helpers/supabase";

type Janela = { inicio: string; fim: string };
type RpcClient = {
  rpc: (
    nome: string,
    args: {
      p_periodo: string;
      p_referencia?: string;
      p_inicio?: string;
      p_fim?: string;
    },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type SaldoRpcClient = {
  rpc: (
    nome: "saldo_comissao_visao_geral",
    args: { p_inicio: string; p_fim: string },
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function normalizar(
  client: RpcClient,
  args: Parameters<RpcClient["rpc"]>[1],
): Promise<Janela> {
  const { data, error } = await client.rpc("normalizar_periodo_visao_geral", args);
  if (error) throw new Error(error.message);
  expect(data).toHaveLength(1);
  return (data as Janela[])[0];
}

describe("V11.7.1 — normalizar_periodo_visao_geral()", () => {
  let matriz: RpcClient;

  beforeAll(async () => {
    matriz = (await loginMatriz()) as unknown as RpcClient;
  });

  it.each([
    ["dia", "2026-07-29", "2026-07-29T03:00:00+00:00", "2026-07-30T03:00:00+00:00"],
    ["semana", "2026-07-29", "2026-07-23T03:00:00+00:00", "2026-07-30T03:00:00+00:00"],
    ["semana", "2027-01-03", "2026-12-28T03:00:00+00:00", "2027-01-04T03:00:00+00:00"],
    ["quinzena", "2026-07-15", "2026-07-01T03:00:00+00:00", "2026-07-16T03:00:00+00:00"],
    ["quinzena", "2026-07-16", "2026-07-02T03:00:00+00:00", "2026-07-17T03:00:00+00:00"],
    ["mes", "2026-02-18", "2026-02-01T03:00:00+00:00", "2026-03-01T03:00:00+00:00"],
    ["mes", "2024-02-29", "2024-02-01T03:00:00+00:00", "2024-03-01T03:00:00+00:00"],
  ])("%s gera janela civil correta para %s", async (p_periodo, p_referencia, inicio, fim) => {
    const janela = await normalizar(matriz, {
      p_periodo,
      p_referencia,
    });
    expect(janela).toEqual({ inicio, fim });
  });

  it("semana e quinzena atravessam o início do mês como janelas móveis", async () => {
    const semana = await normalizar(matriz, {
      p_periodo: "semana",
      p_referencia: "2026-03-03",
    });
    const quinzena = await normalizar(matriz, {
      p_periodo: "quinzena",
      p_referencia: "2026-03-03",
    });
    expect(semana).toEqual({
      inicio: "2026-02-25T03:00:00+00:00",
      fim: "2026-03-04T03:00:00+00:00",
    });
    expect(quinzena).toEqual({
      inicio: "2026-02-17T03:00:00+00:00",
      fim: "2026-03-04T03:00:00+00:00",
    });
  });

  it("personalizado trata p_fim como data inclusiva e retorna fim exclusivo", async () => {
    const janela = await normalizar(matriz, {
      p_periodo: "personalizado",
      p_inicio: "2026-02-27",
      p_fim: "2026-03-02",
    });
    expect(janela).toEqual({
      inicio: "2026-02-27T03:00:00+00:00",
      fim: "2026-03-03T03:00:00+00:00",
    });
  });

  it("usa America/Sao_Paulo inclusive em data histórica com horário de verão", async () => {
    const janela = await normalizar(matriz, {
      p_periodo: "dia",
      p_referencia: "2018-11-10",
    });
    expect(janela).toEqual({
      inicio: "2018-11-10T02:00:00+00:00",
      fim: "2018-11-11T02:00:00+00:00",
    });
  });

  it.each([
    [{ p_periodo: "ano", p_referencia: "2026-01-01" }, "periodo_invalido"],
    [{ p_periodo: "personalizado", p_inicio: "2026-01-01" }, "exige_inicio_e_fim"],
    [
      { p_periodo: "personalizado", p_inicio: "2026-01-02", p_fim: "2026-01-01" },
      "fim_anterior_ao_inicio",
    ],
  ])("rejeita entrada inválida %#", async (args, mensagem) => {
    const { error } = await matriz.rpc("normalizar_periodo_visao_geral", args);
    expect(error?.message).toContain(mensagem);
  });

  it("authenticated executa e anon não recebe EXECUTE", async () => {
    const ok = await normalizar(matriz, {
      p_periodo: "mes",
      p_referencia: "2026-07-29",
    });
    expect(ok.inicio).toBe("2026-07-01T03:00:00+00:00");

    const { error } = await (anonClient() as unknown as RpcClient).rpc(
      "normalizar_periodo_visao_geral",
      { p_periodo: "dia", p_referencia: "2026-07-29" },
    );
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/permission denied/i);
  });
});

describe("V11.7.1 — saldo_comissao_visao_geral()", () => {
  const inicio = "2026-07-01T03:00:00.000Z";
  const fim = "2026-08-01T03:00:00.000Z";
  let proprio: SaldoRpcClient;

  beforeAll(async () => {
    const usuario = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "saldo-dashboard-proprio",
    });
    const terceiro = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "saldo-dashboard-terceiro",
    });
    proprio = usuario.client as unknown as SaldoRpcClient;

    const { error } = await admin.from("comissao_lancamentos").insert([
      {
        vendedor_id: usuario.userId,
        beneficiario_id: usuario.userId,
        tipo: "credito",
        valor: 150,
        descricao: "credito dentro da janela",
        criado_em: "2026-07-10T12:00:00.000Z",
      },
      {
        vendedor_id: usuario.userId,
        beneficiario_id: usuario.userId,
        tipo: "debito",
        valor: 35,
        descricao: "debito dentro da janela",
        criado_em: "2026-07-20T12:00:00.000Z",
      },
      {
        vendedor_id: usuario.userId,
        beneficiario_id: usuario.userId,
        tipo: "credito",
        valor: 999,
        descricao: "fora da janela",
        criado_em: fim,
      },
      {
        vendedor_id: terceiro.userId,
        beneficiario_id: terceiro.userId,
        tipo: "credito",
        valor: 5000,
        descricao: "outro beneficiario",
        criado_em: "2026-07-15T12:00:00.000Z",
      },
    ]);
    if (error) throw error;
  });

  it("soma créditos, subtrai débitos e respeita [inicio,fim)", async () => {
    const { data, error } = await proprio.rpc("saldo_comissao_visao_geral", {
      p_inicio: inicio,
      p_fim: fim,
    });
    expect(error).toBeNull();
    expect(data).toEqual([{ saldo: 115, quantidade: 2 }]);
  });

  it("isola lançamentos de outro beneficiário mesmo quando estão na janela", async () => {
    const { data, error } = await proprio.rpc("saldo_comissao_visao_geral", {
      p_inicio: "2026-07-15T00:00:00.000Z",
      p_fim: "2026-07-16T00:00:00.000Z",
    });
    expect(error).toBeNull();
    expect(data).toEqual([{ saldo: 0, quantidade: 0 }]);
  });

  it("anon não executa", async () => {
    const { error } = await (anonClient() as unknown as SaldoRpcClient).rpc(
      "saldo_comissao_visao_geral",
      { p_inicio: inicio, p_fim: fim },
    );
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/permission denied/i);
  });

  it.each([
    [fim, inicio],
    [inicio, inicio],
  ])("rejeita intervalo inválido %#", async (p_inicio, p_fim) => {
    const { data, error } = await proprio.rpc("saldo_comissao_visao_geral", {
      p_inicio,
      p_fim,
    });
    expect(data).toBeNull();
    expect(error?.message).toContain("intervalo_invalido");
  });
});
