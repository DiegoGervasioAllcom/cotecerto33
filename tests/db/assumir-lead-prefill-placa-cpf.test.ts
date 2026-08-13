import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

/**
 * `assumir_lead` pré-preenche cotacao_veiculo.placa e
 * cotacao_segurado.cpf_cnpj a partir de `leads.dados` (genérico: qualquer
 * origem que povoe `dados->>'placa'` / `dados->>'cpf'`, não só
 * captacao_movida). 20260813020000_assumir_lead_prefill_placa_cpf.sql.
 */
describe("assumir_lead — prefill de placa/cpf a partir de leads.dados", () => {
  let vendedor: Db;
  let empresaId: string;
  let vendedorId: string;

  beforeAll(async () => {
    const v = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-prefill" });
    vendedor = v.client;
    empresaId = v.empresaId;
    vendedorId = v.userId;
  });

  async function criarLead(dados: Record<string, string> | null) {
    const { data, error } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead Prefill"),
        contato: "11999990000",
        empresa_id: empresaId,
        responsavel_id: vendedorId,
        dados,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  it("com placa e cpf em dados: preenche cotacao_veiculo.placa e cotacao_segurado.cpf_cnpj", async () => {
    const leadId = await criarLead({ placa: "ABC1D23", cpf: "12345678900", canal: "vianuvem" });

    const { data: cotId, error } = await vendedor.rpc("assumir_lead", { p_lead_id: leadId });
    expect(error).toBeNull();
    expect(cotId).toBeTruthy();

    const { data: segurado } = await admin
      .from("cotacao_segurado")
      .select("cpf_cnpj, nome, celular")
      .eq("cotacao_id", cotId as string)
      .single();
    expect(segurado?.cpf_cnpj).toBe("12345678900");

    const { data: veiculo } = await admin
      .from("cotacao_veiculo")
      .select("placa")
      .eq("cotacao_id", cotId as string)
      .maybeSingle();
    expect(veiculo?.placa).toBe("ABC1D23");
  });

  it("sem placa/cpf em dados (lead manual comum): não quebra e não cria linha vazia de veículo", async () => {
    const leadId = await criarLead(null);

    const { data: cotId, error } = await vendedor.rpc("assumir_lead", { p_lead_id: leadId });
    expect(error).toBeNull();

    const { data: segurado } = await admin
      .from("cotacao_segurado")
      .select("cpf_cnpj")
      .eq("cotacao_id", cotId as string)
      .single();
    expect(segurado?.cpf_cnpj).toBeNull();

    const { data: veiculo } = await admin
      .from("cotacao_veiculo")
      .select("placa")
      .eq("cotacao_id", cotId as string)
      .maybeSingle();
    expect(veiculo).toBeNull();
  });

  it("chamar assumir_lead duas vezes: não duplica nem sobrescreve edição manual do vendedor", async () => {
    const leadId = await criarLead({ placa: "XYZ9K88", cpf: "98765432100" });

    const { data: cotId1, error: err1 } = await vendedor.rpc("assumir_lead", { p_lead_id: leadId });
    expect(err1).toBeNull();

    // vendedor edita manualmente depois de assumir
    await admin
      .from("cotacao_segurado")
      .update({ cpf_cnpj: "11122233344" })
      .eq("cotacao_id", cotId1 as string);
    await admin
      .from("cotacao_veiculo")
      .update({ placa: "EDITADA1" })
      .eq("cotacao_id", cotId1 as string);

    const { data: cotId2, error: err2 } = await vendedor.rpc("assumir_lead", { p_lead_id: leadId });
    expect(err2).toBeNull();
    expect(cotId2).toBe(cotId1);

    const { data: segurados } = await admin
      .from("cotacao_segurado")
      .select("cpf_cnpj")
      .eq("cotacao_id", cotId1 as string);
    expect(segurados ?? []).toHaveLength(1);
    expect(segurados?.[0]?.cpf_cnpj).toBe("11122233344");

    const { data: veiculos } = await admin
      .from("cotacao_veiculo")
      .select("placa")
      .eq("cotacao_id", cotId1 as string);
    expect(veiculos ?? []).toHaveLength(1);
    expect(veiculos?.[0]?.placa).toBe("EDITADA1");
  });
});
