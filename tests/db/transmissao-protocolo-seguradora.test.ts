import { describe, it, expect } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, uniq } from "../helpers/supabase";

/** V12.4.1: RPC registrar_resultado_transmissao_quiver grava protocolo_seguradora. */
describe("transmissão Quiver — protocolo da seguradora (V12.4.1)", () => {
  async function cenario() {
    const empresa = await criarEmpresa({ nome: uniq("Empresa Protocolo") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: empresa.id });
    const { data: cot, error } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresa.id, responsavel_id: vendedor.userId })
      .select("id")
      .single();
    if (error) throw error;
    return { vendedor, cotacaoId: cot.id as string };
  }

  async function tentativa(cotacaoId: string) {
    const { data, error } = await admin
      .from("cotacao_transmissoes")
      .insert({
        cotacao_id: cotacaoId,
        seguradora: "Seguradora Teste",
        forma_pagamento: "boleto",
        premio: 100,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  async function registrar(cotacaoId: string, args: Record<string, unknown>) {
    const id = await tentativa(cotacaoId);
    const { error } = await admin.rpc("registrar_resultado_transmissao_quiver", {
      p_tentativa_id: id,
      ...args,
    } as never);
    if (error) throw error;
  }

  async function protocolo(cotacaoId: string) {
    const { data, error } = await admin
      .from("propostas")
      .select("protocolo_seguradora")
      .eq("cotacao_id", cotacaoId)
      .single();
    if (error) throw error;
    return data.protocolo_seguradora;
  }

  it("com p_protocolo grava na proposta", async () => {
    const { cotacaoId } = await cenario();
    await registrar(cotacaoId, { p_transmitido: true, p_protocolo: "PROT-123" });
    expect(await protocolo(cotacaoId)).toBe("PROT-123");
  });

  it("chamada com os 6 args antigos continua funcionando e deixa null", async () => {
    const { cotacaoId } = await cenario();
    await registrar(cotacaoId, {
      p_transmitido: true,
      p_motivo: null,
      p_mensagem: null,
      p_numero_cotacao: "1",
      p_capturado_em: new Date().toISOString(),
    });
    expect(await protocolo(cotacaoId)).toBeNull();
  });

  it("reenvio sem protocolo não apaga o já gravado; com novo protocolo atualiza", async () => {
    const { cotacaoId } = await cenario();
    await registrar(cotacaoId, { p_transmitido: true, p_protocolo: "PROT-A" });
    await registrar(cotacaoId, { p_transmitido: true });
    expect(await protocolo(cotacaoId)).toBe("PROT-A");
    await registrar(cotacaoId, { p_transmitido: true, p_protocolo: "PROT-B" });
    expect(await protocolo(cotacaoId)).toBe("PROT-B");
  });

  it("texto > 60 é cortado sem estourar o check", async () => {
    const { cotacaoId } = await cenario();
    await registrar(cotacaoId, { p_transmitido: true, p_protocolo: "X".repeat(100) });
    expect(await protocolo(cotacaoId)).toBe("X".repeat(60));
  });

  it("só espaços vira null", async () => {
    const { cotacaoId } = await cenario();
    await registrar(cotacaoId, { p_transmitido: true, p_protocolo: "   " });
    expect(await protocolo(cotacaoId)).toBeNull();
  });

  it("falha não grava protocolo", async () => {
    const { cotacaoId } = await cenario();
    await registrar(cotacaoId, {
      p_transmitido: false,
      p_motivo: "ERRO",
      p_protocolo: "NAO-GRAVAR",
    });
    expect(await protocolo(cotacaoId)).toBeNull();
  });

  it("authenticated não executa a RPC de 7 args", async () => {
    const { vendedor, cotacaoId } = await cenario();
    const id = await tentativa(cotacaoId);
    const { error } = await vendedor.client.rpc("registrar_resultado_transmissao_quiver", {
      p_tentativa_id: id,
      p_transmitido: true,
      p_protocolo: "HACK",
    });
    expect(error).toBeTruthy();
  });
});
