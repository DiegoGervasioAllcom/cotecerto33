import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

/**
 * Regressão: kanban pessoal (`/venda/pipeline`) e geral (`/operacao/pipeline-geral`)
 * mostravam leads de OUTROS vendedores da mesma Franquia Full pra quem devia
 * ver só os próprios.
 *
 * Causa raiz: numa Full, o dono é `franqueado` e vários `vendedor` (CLT/vinculado)
 * compartilham o MESMO `profiles.empresa_id`. `empresas_visiveis(auth.uid())`
 * devolve no mínimo a própria empresa pra qualquer perfil — inclusive
 * `vendedor` raso — o que fazia `leads_select` liberar geral via
 * `empresa_id in (select empresa_id from empresas_visiveis(...))`, sem checar
 * papel. Fix: 20260820000000_fix_leads_select_vazamento_vendedor_full.sql —
 * esse branch de empresa só vale pra quem NÃO é `vendedor` raso.
 *
 * Também confirma que `franqueado` (dono) e `master` continuam vendo a rede
 * inteira normalmente — só o `vendedor` raso perdeu o atalho de empresa.
 */
describe("RLS leads — Franquia Full: vendedor não vê lead de colega na mesma empresa", () => {
  let empresaFull: string;
  let franqueado: Db;
  let vendedor1: Db;
  let vendedor1Id: string;
  let vendedor2: Db;

  let leadVendedor1: string;
  let leadVendedor2: string;
  let leadSemDono: string; // empresa_id setado, sem responsavel_id ainda (fila)

  beforeAll(async () => {
    const franq = await criarPersonaComEmpresa("franqueado", { emailPrefix: "full-franq" });
    franqueado = franq.client;
    empresaFull = franq.empresaId;

    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaFull,
      emailPrefix: "full-vend-1",
      superiorId: franq.userId,
    });
    vendedor1 = v1.client;
    vendedor1Id = v1.userId;

    const v2 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaFull,
      emailPrefix: "full-vend-2",
      superiorId: franq.userId,
    });
    vendedor2 = v2.client;

    const { data: l1, error: e1 } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead Vendedor 1"),
        origem: "teste",
        empresa_id: empresaFull,
        responsavel_id: vendedor1Id,
      })
      .select("id")
      .single();
    if (e1) throw e1;
    leadVendedor1 = l1.id;

    const { data: l2, error: e2 } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead Vendedor 2"),
        origem: "teste",
        empresa_id: empresaFull,
        responsavel_id: v2.userId,
      })
      .select("id")
      .single();
    if (e2) throw e2;
    leadVendedor2 = l2.id;

    const { data: l3, error: e3 } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead Sem Dono"),
        origem: "teste",
        empresa_id: empresaFull,
      })
      .select("id")
      .single();
    if (e3) throw e3;
    leadSemDono = l3.id;
  });

  it("POSITIVO: vendedor vê o próprio lead", async () => {
    const { data, error } = await vendedor1.from("leads").select("id").eq("id", leadVendedor1);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("NEGATIVO: vendedor NÃO vê o lead do colega na mesma empresa (Full)", async () => {
    const { data, error } = await vendedor1.from("leads").select("id").eq("id", leadVendedor2);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("NEGATIVO: vendedor NÃO vê lead da empresa ainda sem responsável (fila)", async () => {
    const { data, error } = await vendedor1.from("leads").select("id").eq("id", leadSemDono);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("POSITIVO: cada vendedor, ao listar como o kanban pessoal faz (sem filtro por responsavel_id na query), só recebe o próprio lead", async () => {
    const { data, error } = await vendedor1
      .from("leads")
      .select("id")
      .in("id", [leadVendedor1, leadVendedor2, leadSemDono]);
    expect(error).toBeNull();
    expect((data ?? []).map((l) => l.id)).toEqual([leadVendedor1]);
  });

  it("POSITIVO: franqueado (dono da Full) continua vendo todos os leads da própria rede", async () => {
    const { data, error } = await franqueado
      .from("leads")
      .select("id")
      .in("id", [leadVendedor1, leadVendedor2, leadSemDono]);
    expect(error).toBeNull();
    const ids = new Set((data ?? []).map((l) => l.id));
    expect(ids).toEqual(new Set([leadVendedor1, leadVendedor2, leadSemDono]));
  });
});
