import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa } from "../helpers/supabase";
import type { Db } from "../helpers/supabase";

/**
 * Complemento do endereço (20261007141902_complemento_endereco.sql): coluna em
 * cotacao_segurado gravada por salvar_cotacao_rascunho e número limitado a 10.
 */
describe("complemento do endereço", () => {
  let client: Db;

  beforeAll(async () => {
    client = (await criarPersonaComEmpresa("vendedor")).client;
  });

  const payload = (numero: string, complemento: string | null) =>
    ({
      step_atual: 1,
      segurado: { nome: "Fixture Complemento", numero, complemento },
      seguro: {},
      veiculo: {},
      perfil: {},
      coberturas: {},
    }) as never;

  async function salvar(numero: string, complemento: string | null) {
    return client.rpc("salvar_cotacao_rascunho", {
      p_cotacao_id: null as unknown as string,
      p_payload: payload(numero, complemento),
    });
  }

  it("grava número e complemento separados", async () => {
    const { data: cotId, error } = await salvar("40", "BL F02 AP 111");
    expect(error).toBeNull();
    const { data } = await admin
      .from("cotacao_segurado")
      .select("numero,complemento")
      .eq("cotacao_id", cotId as string)
      .single();
    expect(data).toEqual({ numero: "40", complemento: "BL F02 AP 111" });
  });

  it("complemento vazio fica nulo/vazio sem erro", async () => {
    const { data: cotId, error } = await salvar("121", null);
    expect(error).toBeNull();
    const { data } = await admin
      .from("cotacao_segurado")
      .select("numero,complemento")
      .eq("cotacao_id", cotId as string)
      .single();
    expect(data?.numero).toBe("121");
    expect(data?.complemento ?? null).toBeNull();
  });

  it("NEGATIVO: número com mais de 10 e complemento com mais de 30 são recusados (23514)", async () => {
    expect((await salvar("40 BL F02 AP 111", null)).error?.code).toBe("23514");
    expect((await salvar("40", "x".repeat(31))).error?.code).toBe("23514");
    expect((await salvar("1234567890", "x".repeat(30))).error).toBeNull();
  });
});
