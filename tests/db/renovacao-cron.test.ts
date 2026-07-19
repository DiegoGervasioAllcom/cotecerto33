import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

/**
 * G6.1 — job de renovação: cria lead de renovação 60 dias antes do
 * vencimento da apólice (propostas.vencimento) e marca 'perdido' o lead
 * cuja apólice já venceu e que ainda estava aberto.
 */
describe("criar_leads_renovacao()", () => {
  let empresaId: string;
  const propostaIds: string[] = [];
  const leadIds: string[] = [];

  function isoInDays(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async function criarPropostaComVencimento(vencimento: string, opts?: { cancelada?: boolean }) {
    const { data: cliente, error: eCli } = await admin
      .from("clientes")
      .insert({ nome: uniq("Cliente Renovacao"), empresa_id: empresaId })
      .select("id")
      .single();
    if (eCli) throw eCli;

    const { data: lead, error: eLead } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead original"),
        origem: "teste",
        cliente_id: cliente.id,
        empresa_id: empresaId,
        status_pipeline: "ganho",
      })
      .select("id")
      .single();
    if (eLead) throw eLead;
    leadIds.push(lead.id);

    const { data: proposta, error: eProp } = await admin
      .from("propostas")
      .insert({
        empresa_id: empresaId,
        lead_id: lead.id,
        vencimento,
        cancelada_em: opts?.cancelada ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (eProp) throw eProp;
    propostaIds.push(proposta.id);
    return proposta.id;
  }

  async function chamarJob(): Promise<{ criados: number; expirados: number } | null> {
    const { data, error } = await (admin as unknown as Db).rpc("criar_leads_renovacao");
    if (error) throw error;
    return data as { criados: number; expirados: number } | null;
  }

  beforeAll(async () => {
    empresaId = (await criarEmpresa()).id;
  });

  afterAll(async () => {
    if (leadIds.length) {
      await admin.from("leads").delete().in("id", leadIds);
    }
    if (propostaIds.length) {
      await admin.from("leads").delete().in("renovacao_proposta_id", propostaIds);
      await admin.from("propostas").delete().in("id", propostaIds);
    }
  });

  it("apólice vencendo em +30 dias gera 1 lead de renovação vinculado; rodar de novo não duplica", async () => {
    const propostaId = await criarPropostaComVencimento(isoInDays(30));

    await chamarJob();

    const { data: leadsCriados, error } = await admin
      .from("leads")
      .select("id,origem,status_pipeline,renovacao_proposta_id")
      .eq("renovacao_proposta_id", propostaId);
    if (error) throw error;
    expect(leadsCriados).toHaveLength(1);
    expect(leadsCriados![0].origem).toBe("renovacao");
    expect(leadsCriados![0].status_pipeline).toBe("novo");
    leadIds.push(leadsCriados![0].id);

    // roda de novo — não deve duplicar
    await chamarJob();
    const { data: leadsDepois, error: e2 } = await admin
      .from("leads")
      .select("id")
      .eq("renovacao_proposta_id", propostaId);
    if (e2) throw e2;
    expect(leadsDepois).toHaveLength(1);
  });

  it("apólice vencendo em +90 dias (fora da janela de 60) não gera lead", async () => {
    const propostaId = await criarPropostaComVencimento(isoInDays(90));

    await chamarJob();

    const { data, error } = await admin
      .from("leads")
      .select("id")
      .eq("renovacao_proposta_id", propostaId);
    if (error) throw error;
    expect(data).toHaveLength(0);
  });

  it("apólice cancelada não gera lead de renovação", async () => {
    const propostaId = await criarPropostaComVencimento(isoInDays(20), { cancelada: true });

    await chamarJob();

    const { data, error } = await admin
      .from("leads")
      .select("id")
      .eq("renovacao_proposta_id", propostaId);
    if (error) throw error;
    expect(data).toHaveLength(0);
  });

  it("apólice já vencida com lead de renovação ainda aberto é marcada 'perdido'", async () => {
    const propostaId = await criarPropostaComVencimento(isoInDays(-5));

    // cria manualmente o lead de renovação aberto (simula que já tinha sido criado
    // dentro da janela de 60 dias, antes de vencer)
    const { data: leadAberto, error: eL } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead renovacao aberto"),
        origem: "renovacao",
        status_pipeline: "novo",
        renovacao_proposta_id: propostaId,
      })
      .select("id")
      .single();
    if (eL) throw eL;
    leadIds.push(leadAberto.id);

    await chamarJob();

    const { data: leadDepois, error } = await admin
      .from("leads")
      .select("status_pipeline")
      .eq("id", leadAberto.id)
      .single();
    if (error) throw error;
    expect(leadDepois!.status_pipeline).toBe("perdido");
  });

  it("NEGATIVO: usuário comum (não-matriz) não pode disparar o job global", async () => {
    // A função varre propostas/leads de TODAS as empresas — só cron (auth.uid()
    // nulo) ou Matriz podem chamar. Um vendedor autenticado deve ser barrado.
    const vend = await criarPersonaComEmpresa("vendedor", { emailPrefix: uniq("renov-gate") });
    const { error } = await vend.client.rpc("criar_leads_renovacao");
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/permiss/i);
  });
});
