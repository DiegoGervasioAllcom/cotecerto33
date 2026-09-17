import { describe, it, expect, beforeAll } from "vitest";
import {
  admin,
  criarPersonaComEmpresa,
  loginMatriz,
  uniq,
  type Db,
} from "../helpers/supabase";

/**
 * RLS de `lead_agendamentos` (retorno/lembrete de lead — base da futura tela
 * "Minha agenda", V12). Visibilidade espelha a policy ATUAL de `leads_select`
 * (20260820000000_fix_leads_select_vazamento_vendedor_full.sql): dono do
 * lead, matriz, e papel de gestão (franqueado/master/supervisor/coordenador)
 * na mesma empresa via `empresas_visiveis()` — vendedor raso NÃO ganha o
 * branch de empresa, então não vê agenda de colega na mesma Franquia Full
 * (mesmo cenário de `rls-full-vendedor-leads.test.ts`).
 *
 * Sem policy de DELETE: marcar `done=true` é o único jeito de "fechar" um
 * agendamento — testado explicitamente abaixo.
 */
describe("RLS lead_agendamentos — visibilidade espelha leads_select", () => {
  let franqueado: Db;
  let vendedor1: Db;
  let vendedor1Id: string;
  let vendedor2: Db;
  let vendedor2Id: string;
  let matriz: Db;

  let leadVendedor1: string;
  let agendamentoVendedor1: string;

  beforeAll(async () => {
    const franq = await criarPersonaComEmpresa("franqueado", { emailPrefix: "agenda-franq" });
    franqueado = franq.client;
    const empresaFull = franq.empresaId;

    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaFull,
      emailPrefix: "agenda-vend-1",
      superiorId: franq.userId,
    });
    vendedor1 = v1.client;
    vendedor1Id = v1.userId;

    const v2 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaFull,
      emailPrefix: "agenda-vend-2",
      superiorId: franq.userId,
    });
    vendedor2 = v2.client;
    vendedor2Id = v2.userId;

    matriz = await loginMatriz();

    const { data: lead, error } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead Agenda Vendedor 1"),
        origem: "teste",
        empresa_id: empresaFull,
        responsavel_id: vendedor1Id,
      })
      .select("id")
      .single();
    if (error) throw error;
    leadVendedor1 = lead.id;

    const { data: agendamento, error: eAg } = await admin
      .from("lead_agendamentos")
      .insert({
        lead_id: leadVendedor1,
        data: "2026-09-20",
        hora: "09:00",
        nota: "ligar de manhã",
        criado_por: vendedor1Id,
      })
      .select("id")
      .single();
    if (eAg) throw eAg;
    agendamentoVendedor1 = agendamento.id;
  });

  it("POSITIVO: dono do lead cria agendamento para o próprio lead", async () => {
    const { data, error } = await vendedor1
      .from("lead_agendamentos")
      .insert({
        lead_id: leadVendedor1,
        data: "2026-09-21",
        nota: "retorno criado pelo próprio vendedor",
        criado_por: vendedor1Id,
      })
      .select("id");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it("POSITIVO: dono do lead vê e edita (fecha) o próprio agendamento", async () => {
    const { data: visto, error: eSel } = await vendedor1
      .from("lead_agendamentos")
      .select("id, done")
      .eq("id", agendamentoVendedor1);
    expect(eSel).toBeNull();
    expect(visto).toHaveLength(1);

    const { data: editado, error: eUpd } = await vendedor1
      .from("lead_agendamentos")
      .update({ done: true })
      .eq("id", agendamentoVendedor1)
      .select("id, done");
    expect(eUpd).toBeNull();
    expect(editado?.[0]?.done).toBe(true);
  });

  it("POSITIVO: matriz vê o agendamento mesmo sem ser responsável pelo lead", async () => {
    const { data, error } = await matriz
      .from("lead_agendamentos")
      .select("id")
      .eq("id", agendamentoVendedor1);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it("POSITIVO: franqueado (dono da rede/gestão) vê o agendamento de vendedor da própria empresa", async () => {
    const { data, error } = await franqueado
      .from("lead_agendamentos")
      .select("id")
      .eq("id", agendamentoVendedor1);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(1);
  });

  it("NEGATIVO: outro vendedor (colega na mesma empresa/Full) NÃO vê o agendamento alheio", async () => {
    const { data, error } = await vendedor2
      .from("lead_agendamentos")
      .select("id")
      .eq("id", agendamentoVendedor1);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("NEGATIVO: outro vendedor NÃO edita o agendamento alheio (update não afeta linhas)", async () => {
    const { data, error } = await vendedor2
      .from("lead_agendamentos")
      .update({ done: true, nota: "forjado" })
      .eq("id", agendamentoVendedor1)
      .select("id");
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    const { data: real } = await admin
      .from("lead_agendamentos")
      .select("nota")
      .eq("id", agendamentoVendedor1)
      .single();
    expect(real?.nota).not.toBe("forjado");
  });

  it("NEGATIVO: outro vendedor NÃO consegue criar agendamento para lead alheio", async () => {
    const { data, error } = await vendedor2
      .from("lead_agendamentos")
      .insert({
        lead_id: leadVendedor1,
        data: "2026-09-22",
        nota: "tentativa de agendamento em lead alheio",
        criado_por: vendedor2Id,
      })
      .select("id");
    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("NEGATIVO: não é possível forjar criado_por de outra pessoa no insert", async () => {
    const { data, error } = await vendedor1
      .from("lead_agendamentos")
      .insert({
        lead_id: leadVendedor1,
        data: "2026-09-23",
        nota: "criado_por forjado",
        criado_por: vendedor2Id,
      })
      .select("id");
    expect(error).not.toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("NEGATIVO: não existe policy de DELETE — apagar direto falha, done=true é o caminho", async () => {
    const { error } = await vendedor1
      .from("lead_agendamentos")
      .delete()
      .eq("id", agendamentoVendedor1);
    // sem policy de delete pra authenticated, a operação não apaga nada (RLS
    // barra silenciosamente: 0 linhas afetadas, sem erro de permissão SQL).
    const { data: aindaExiste } = await admin
      .from("lead_agendamentos")
      .select("id")
      .eq("id", agendamentoVendedor1);
    expect(aindaExiste).toHaveLength(1);
    void error;
  });
});
