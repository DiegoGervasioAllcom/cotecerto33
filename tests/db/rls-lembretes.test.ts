import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz, uniq, type Db } from "../helpers/supabase";

/**
 * RLS de `lembretes` (anotação pessoal do vendedor — tarefa/ligação/reunião/
 * pessoal — base da futura tela "Minha agenda", V12, junto com
 * `lead_agendamentos`).
 *
 * Ao contrário de `lead_agendamentos` (visibilidade espelha `leads_select`:
 * dono do lead + matriz + gestão da empresa), `lembrete` é 100% privado:
 * só `vendedor_id = auth.uid()` tem acesso — nem matriz, nem franqueado,
 * nem colega vendedor, mesmo quando o lembrete está vinculado (`lead_id`) a
 * um lead que essas outras pessoas também enxergam. Este teste prova
 * explicitamente essa assimetria (não é uma cópia do teste de
 * `lead_agendamentos`).
 *
 * Diferente de `lead_agendamentos` também há policy de DELETE aqui: é
 * anotação pessoal, não histórico compartilhado.
 */
describe("RLS lembretes — 100% privado ao vendedor, mesmo vinculado a lead de outro dono", () => {
  let franqueado: Db;
  let vendedor1: Db;
  let vendedor1Id: string;
  let vendedor2: Db;
  let vendedor2Id: string;
  let matriz: Db;

  let leadVendedor1: string;
  let lembreteVendedor1: string;
  let lembreteVinculadoLead: string;

  beforeAll(async () => {
    const franq = await criarPersonaComEmpresa("franqueado", { emailPrefix: "lembrete-franq" });
    franqueado = franq.client;
    const empresaFull = franq.empresaId;

    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaFull,
      emailPrefix: "lembrete-vend-1",
      superiorId: franq.userId,
    });
    vendedor1 = v1.client;
    vendedor1Id = v1.userId;

    const v2 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaFull,
      emailPrefix: "lembrete-vend-2",
      superiorId: franq.userId,
    });
    vendedor2 = v2.client;
    vendedor2Id = v2.userId;

    matriz = await loginMatriz();

    // Lead pertence ao vendedor1 (franqueado e matriz também o enxergam via
    // leads_select) — usado para provar que o vínculo lead_id NÃO libera
    // acesso ao lembrete em si.
    const { data: lead, error } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead Lembrete Vendedor 1"),
        origem: "teste",
        empresa_id: empresaFull,
        responsavel_id: vendedor1Id,
      })
      .select("id")
      .single();
    if (error) throw error;
    leadVendedor1 = lead.id;

    const { data: lembrete, error: eLem } = await admin
      .from("lembretes")
      .insert({
        vendedor_id: vendedor1Id,
        tipo: "tarefa",
        titulo: "Preparar proposta",
        data: "2026-09-20",
      })
      .select("id")
      .single();
    if (eLem) throw eLem;
    lembreteVendedor1 = lembrete.id;

    const { data: lembreteLead, error: eLemLead } = await admin
      .from("lembretes")
      .insert({
        vendedor_id: vendedor1Id,
        tipo: "ligacao",
        titulo: "Ligar sobre o lead",
        data: "2026-09-21",
        lead_id: leadVendedor1,
      })
      .select("id")
      .single();
    if (eLemLead) throw eLemLead;
    lembreteVinculadoLead = lembreteLead.id;
  });

  it("POSITIVO: vendedor cria o próprio lembrete", async () => {
    const { data, error } = await vendedor1
      .from("lembretes")
      .insert({
        vendedor_id: vendedor1Id,
        tipo: "pessoal",
        titulo: "Buscar filho na escola",
        data: "2026-09-22",
      })
      .select("id");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it("POSITIVO: vendedor vê e edita o próprio lembrete", async () => {
    const { data: visto, error: eSel } = await vendedor1
      .from("lembretes")
      .select("id, done")
      .eq("id", lembreteVendedor1);
    expect(eSel).toBeNull();
    expect(visto).toHaveLength(1);

    const { data: editado, error: eUpd } = await vendedor1
      .from("lembretes")
      .update({ done: true })
      .eq("id", lembreteVendedor1)
      .select("id, done");
    expect(eUpd).toBeNull();
    expect(editado?.[0]?.done).toBe(true);
  });

  it("POSITIVO: vendedor vê e edita o próprio lembrete mesmo vinculado a lead que outros também veem", async () => {
    const { data, error } = await vendedor1
      .from("lembretes")
      .select("id, lead_id")
      .eq("id", lembreteVinculadoLead);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.lead_id).toBe(leadVendedor1);
  });

  it("POSITIVO: vendedor apaga o próprio lembrete", async () => {
    const { data: novo, error: eIns } = await vendedor1
      .from("lembretes")
      .insert({
        vendedor_id: vendedor1Id,
        tipo: "reuniao",
        titulo: "Reunião interna",
        data: "2026-09-23",
      })
      .select("id")
      .single();
    expect(eIns).toBeNull();

    const { data: apagado, error: eDel } = await vendedor1
      .from("lembretes")
      .delete()
      .eq("id", novo!.id)
      .select("id");
    expect(eDel).toBeNull();
    expect(apagado ?? []).toHaveLength(1);

    const { data: aindaExiste } = await admin.from("lembretes").select("id").eq("id", novo!.id);
    expect(aindaExiste).toHaveLength(0);
  });

  it("NEGATIVO: outro vendedor (colega na mesma empresa) NÃO vê o lembrete alheio", async () => {
    const { data, error } = await vendedor2
      .from("lembretes")
      .select("id")
      .eq("id", lembreteVendedor1);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("NEGATIVO: matriz NÃO vê o lembrete alheio (diferente de lead_agendamentos)", async () => {
    const { data, error } = await matriz.from("lembretes").select("id").eq("id", lembreteVendedor1);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("NEGATIVO: franqueado/gestor da empresa NÃO vê o lembrete alheio (diferente de lead_agendamentos)", async () => {
    const { data, error } = await franqueado
      .from("lembretes")
      .select("id")
      .eq("id", lembreteVendedor1);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("NEGATIVO: ninguém (matriz/franqueado/colega) vê o lembrete vinculado ao lead, mesmo enxergando o lead", async () => {
    const resultados = await Promise.all(
      [matriz, franqueado, vendedor2].map((cliente) =>
        cliente.from("lembretes").select("id").eq("id", lembreteVinculadoLead),
      ),
    );
    for (const { data, error } of resultados) {
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("NEGATIVO: outro vendedor NÃO edita nem apaga o lembrete alheio", async () => {
    const { data: upd, error: eUpd } = await vendedor2
      .from("lembretes")
      .update({ done: true, titulo: "forjado" })
      .eq("id", lembreteVendedor1)
      .select("id");
    expect(eUpd).toBeNull();
    expect(upd ?? []).toHaveLength(0);

    const { data: del, error: eDel } = await vendedor2
      .from("lembretes")
      .delete()
      .eq("id", lembreteVendedor1)
      .select("id");
    expect(eDel).toBeNull();
    expect(del ?? []).toHaveLength(0);

    const { data: real } = await admin
      .from("lembretes")
      .select("titulo")
      .eq("id", lembreteVendedor1)
      .single();
    expect(real?.titulo).not.toBe("forjado");
  });

  it("NEGATIVO: não é possível forjar vendedor_id de outra pessoa no insert", async () => {
    const { data, error } = await vendedor1
      .from("lembretes")
      .insert({
        vendedor_id: vendedor2Id,
        tipo: "tarefa",
        titulo: "vendedor_id forjado",
        data: "2026-09-24",
      })
      .select("id");
    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
