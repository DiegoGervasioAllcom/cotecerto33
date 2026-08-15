import { describe, it, expect } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz, uniq } from "../helpers/supabase";

/**
 * RLS de `consultas_placa` — o histórico das consultas ao decodificador
 * de placa. Escrita é exclusiva da server function (service_role); o
 * front só lê, e só o que lhe pertence.
 *
 * Asserts sempre com clients autenticados por persona; o service_role
 * aparece apenas para montar as fixtures (é ele que grava de verdade).
 */
describe("consultas_placa — RLS", () => {
  async function gravarConsulta(opts: {
    userId: string | null;
    empresaId: string | null;
    placa?: string;
  }) {
    const placa = opts.placa ?? uniq("XYZ").slice(0, 7).toUpperCase();
    const { data, error } = await admin
      .from("consultas_placa")
      .insert({
        placa,
        consultado_por: opts.userId,
        empresa_id: opts.empresaId,
        sucesso: true,
        marca: "CHEVROLET",
        modelo: "COBALT 1.8 LTZ",
        ano_modelo: "2015",
        fipe_codigo: "004420-2",
        fipe_valor: 43399,
        payload: { placa, marca: "CHEVROLET", fipe: [] },
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id, placa };
  }

  it("o vendedor lê a própria consulta e NÃO lê a de outro vendedor", async () => {
    const a = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vendA" });
    const b = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vendB" });
    const consultaA = await gravarConsulta({ userId: a.userId, empresaId: a.empresaId });
    const consultaB = await gravarConsulta({ userId: b.userId, empresaId: b.empresaId });

    const { data: vistoPorA } = await a.client
      .from("consultas_placa")
      .select("id")
      .in("id", [consultaA.id, consultaB.id]);
    expect(vistoPorA?.map((r) => r.id)).toEqual([consultaA.id]);

    // NEGATIVO: leitura direta da consulta alheia devolve vazio, não erro.
    const { data: alheia } = await b.client
      .from("consultas_placa")
      .select("id")
      .eq("id", consultaA.id);
    expect(alheia).toEqual([]);
  });

  it("a matriz enxerga a consulta de um vendedor da rede", async () => {
    const matriz = await loginMatriz();
    const { data: perfilMatriz } = await matriz
      .from("profiles")
      .select("id,empresa_id")
      .eq("email", "desenvolvimento@suppercerto.com.br")
      .single();
    // Vendedor pendurado na própria empresa da matriz: garante que a
    // empresa está dentro de empresas_visiveis() da matriz.
    const vend = await criarPersonaComEmpresa("vendedor", {
      empresaId: perfilMatriz!.empresa_id!,
      emailPrefix: "vendRede",
      superiorId: perfilMatriz!.id,
    });
    const consulta = await gravarConsulta({
      userId: vend.userId,
      empresaId: vend.empresaId,
    });

    const { data } = await matriz.from("consultas_placa").select("id").eq("id", consulta.id);
    expect(data?.map((r) => r.id)).toEqual([consulta.id]);
  });

  it("authenticated NÃO consegue inserir, atualizar nem apagar", async () => {
    const v = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vendW" });
    const consulta = await gravarConsulta({ userId: v.userId, empresaId: v.empresaId });

    // INSERT: sem policy de insert para authenticated.
    const { error: eIns } = await v.client
      .from("consultas_placa")
      .insert({ placa: "ABC1D23", consultado_por: v.userId, sucesso: true });
    expect(eIns).not.toBeNull();

    // UPDATE: silenciosamente sem efeito (0 linhas) — a linha segue intacta.
    await v.client.from("consultas_placa").update({ marca: "ADULTERADA" }).eq("id", consulta.id);
    const { data: depois } = await admin
      .from("consultas_placa")
      .select("marca")
      .eq("id", consulta.id)
      .single();
    expect(depois?.marca).toBe("CHEVROLET");

    // DELETE: idem — a linha continua lá.
    await v.client.from("consultas_placa").delete().eq("id", consulta.id);
    const { count } = await admin
      .from("consultas_placa")
      .select("id", { count: "exact", head: true })
      .eq("id", consulta.id);
    expect(count).toBe(1);
  });

  it("os checks de tamanho e faixa barram lixo", async () => {
    // placa fora de 5..10 caracteres
    const { error: ePlaca } = await admin
      .from("consultas_placa")
      .insert({ placa: "AB", sucesso: false });
    expect(ePlaca).not.toBeNull();

    // fipe_valor precisa ser > 0
    const { error: eValor } = await admin
      .from("consultas_placa")
      .insert({ placa: "ABC1D23", sucesso: true, fipe_valor: 0 });
    expect(eValor).not.toBeNull();

    // marca acima de 120 caracteres
    const { error: eMarca } = await admin
      .from("consultas_placa")
      .insert({ placa: "ABC1D23", sucesso: true, marca: "M".repeat(121) });
    expect(eMarca).not.toBeNull();
  });
});
