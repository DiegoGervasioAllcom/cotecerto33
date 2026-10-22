import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz, type Db } from "../helpers/supabase";

/**
 * Supervisor e Coordenador LEEM as cotações da rede (empresas_visiveis), com as filhas
 * e as transmissões; escrita segue só do responsável (20261022162940).
 */
const FILHAS = [
  "cotacao_coberturas",
  "cotacao_perfil",
  "cotacao_premios",
  "cotacao_segurado",
  "cotacao_seguro",
  "cotacao_veiculo",
  "cotacao_transmissoes",
] as const;

async function montarCotacao(empresaId: string, responsavelId: string) {
  const { data, error } = await admin
    .from("cotacoes")
    .insert({ empresa_id: empresaId, responsavel_id: responsavelId })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id;
  const ins = [
    admin.from("cotacao_segurado").insert({ cotacao_id: id, nome: "Segurado Rede" }),
    admin
      .from("cotacao_veiculo")
      .insert({ cotacao_id: id, marca_nome: "FIAT", modelo_nome: "UNO" }),
    admin.from("cotacao_coberturas").insert({ cotacao_id: id }),
    admin.from("cotacao_perfil").insert({ cotacao_id: id }),
    admin.from("cotacao_premios").insert({ cotacao_id: id, seguradora: "Seguradora Teste" }),
    admin.from("cotacao_seguro").insert({ cotacao_id: id }),
    admin.from("cotacao_transmissoes").insert({ cotacao_id: id, seguradora: "Seguradora Teste" }),
  ];
  for (const r of await Promise.all(ins)) if (r.error) throw r.error;
  const p = await admin.rpc("registrar_calculo_etapa", {
    p_cotacao_id: id,
    p_etapa: "login",
    p_seq: 1,
  });
  if (p.error) throw p.error;
  return id;
}

describe("RLS cotações — supervisor/coordenador leem a rede, sem escrever", () => {
  let sup: Db;
  let supOutra: Db;
  let coord: Db;
  let vendOutraEmpresa: Db;
  let vendColega: Db; // colega de empresa DISTINTA, fora da subárvore
  let masterRede: Db;
  let masterOutra: Db;
  let matriz: Db;

  let cotRede: string;
  let cotOutra: string;
  let cotDesligado: string;
  let cotPendente: string;

  const lerCot = (c: Db, id: string) => c.from("cotacoes").select("id").eq("id", id);

  beforeAll(async () => {
    const s = await criarPersonaComEmpresa("supervisor", { emailPrefix: "sup-cotrede" });
    sup = s.client;
    const m = await criarPersonaComEmpresa("master", {
      emailPrefix: "mst-cotrede",
      superiorId: s.userId,
    });
    masterRede = m.client;
    const v = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "vend-cotrede",
      superiorId: m.userId,
    });
    cotRede = await montarCotacao(v.empresaId, v.userId);

    const vd = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "vend-cotrede-desl",
      superiorId: s.userId,
    });
    cotDesligado = await montarCotacao(vd.empresaId, vd.userId);
    await admin
      .from("profiles")
      .update({ desligado_em: new Date().toISOString() })
      .eq("id", vd.userId);

    const vp = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "vend-cotrede-pend",
      superiorId: s.userId,
    });
    cotPendente = await montarCotacao(vp.empresaId, vp.userId);
    await admin.from("profiles").update({ status: "pendente" }).eq("id", vp.userId);

    // outra cadeia, sem relação
    const s2 = await criarPersonaComEmpresa("supervisor", { emailPrefix: "sup-cotrede-o" });
    supOutra = s2.client;
    const m2 = await criarPersonaComEmpresa("master", {
      emailPrefix: "mst-cotrede-o",
      superiorId: s2.userId,
    });
    masterOutra = m2.client;
    const v2 = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "vend-cotrede-o",
      superiorId: m2.userId,
    });
    vendOutraEmpresa = v2.client;
    cotOutra = await montarCotacao(v2.empresaId, v2.userId);

    vendColega = (await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-cotrede-col" }))
      .client;
    coord = (await criarPersonaComEmpresa("coordenador", { emailPrefix: "coord-cotrede" })).client;
    matriz = await loginMatriz();
  });

  it("supervisor lê cotação e todas as filhas/transmissões/progresso do vendedor da subárvore", async () => {
    const { data, error } = await lerCot(sup, cotRede);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: cotRede }]);
    for (const t of FILHAS) {
      const r = await sup.from(t).select("cotacao_id").eq("cotacao_id", cotRede);
      expect(r.error, t).toBeNull();
      expect(r.data, t).toEqual([{ cotacao_id: cotRede }]);
    }
    const seg = await sup.from("cotacao_segurado").select("nome").eq("cotacao_id", cotRede);
    expect(seg.data).toEqual([{ nome: "Segurado Rede" }]);
    const prog = await sup
      .from("cotacao_calculo_progresso")
      .select("cotacao_id,etapa")
      .eq("cotacao_id", cotRede);
    expect(prog.error).toBeNull();
    expect(prog.data).toEqual([{ cotacao_id: cotRede, etapa: "login" }]);
  });

  it("NEGATIVO: supervisor de outra cadeia não lê nada da cotação", async () => {
    const c = await lerCot(supOutra, cotRede);
    expect(c.error).toBeNull();
    expect(c.data).toEqual([]);
    for (const t of [...FILHAS, "cotacao_calculo_progresso"] as const) {
      const r = await supOutra.from(t).select("cotacao_id").eq("cotacao_id", cotRede);
      expect(r.error, t).toBeNull();
      expect(r.data, t).toEqual([]);
    }
  });

  it("NEGATIVO: supervisor não escreve (update 0 linhas, insert recusado, delete 0 linhas)", async () => {
    const upd = await sup.from("cotacoes").update({ step_atual: 7 }).eq("id", cotRede).select("id");
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual([]);
    const real = await admin.from("cotacoes").select("step_atual").eq("id", cotRede).single();
    expect(real.data?.step_atual).not.toBe(7);

    const insSeg = await sup.from("cotacao_segurado").insert({ cotacao_id: cotRede, nome: "X" });
    expect(insSeg.error).not.toBeNull();
    const insVei = await sup
      .from("cotacao_veiculo")
      .insert({ cotacao_id: cotRede, marca_nome: "X", modelo_nome: "Y" });
    expect(insVei.error).not.toBeNull();

    const updSeg = await sup
      .from("cotacao_segurado")
      .update({ nome: "Alterado" })
      .eq("cotacao_id", cotRede)
      .select("nome");
    expect(updSeg.data ?? []).toEqual([]);

    const del = await sup.from("cotacoes").delete().eq("id", cotRede).select("id");
    expect(del.data ?? []).toEqual([]);
    const delSeg = await sup
      .from("cotacao_segurado")
      .delete()
      .eq("cotacao_id", cotRede)
      .select("cotacao_id");
    expect(delSeg.data ?? []).toEqual([]);

    const seg = await admin.from("cotacao_segurado").select("nome").eq("cotacao_id", cotRede);
    expect(seg.data).toEqual([{ nome: "Segurado Rede" }]);
    expect((await admin.from("cotacoes").select("id").eq("id", cotRede)).data).toHaveLength(1);
  });

  it("coordenador lê cotação de qualquer rede (recebe todas as empresas)", async () => {
    for (const id of [cotRede, cotOutra]) {
      expect((await lerCot(coord, id)).data).toEqual([{ id }]);
      const seg = await coord.from("cotacao_segurado").select("cotacao_id").eq("cotacao_id", id);
      expect(seg.data).toEqual([{ cotacao_id: id }]);
      const tr = await coord.from("cotacao_transmissoes").select("cotacao_id").eq("cotacao_id", id);
      expect(tr.data).toEqual([{ cotacao_id: id }]);
    }
  });

  it("NEGATIVO: coordenador também não escreve na cotação", async () => {
    const upd = await coord
      .from("cotacoes")
      .update({ step_atual: 8 })
      .eq("id", cotOutra)
      .select("id");
    expect(upd.data ?? []).toEqual([]);
    const real = await admin.from("cotacoes").select("step_atual").eq("id", cotOutra).single();
    expect(real.data?.step_atual).not.toBe(8);
  });

  it("regressão: vendedores sem vínculo continuam sem ver; master escopado e matriz inalterados", async () => {
    expect((await lerCot(vendOutraEmpresa, cotRede)).data).toEqual([]);
    expect((await lerCot(vendColega, cotRede)).data).toEqual([]);
    for (const t of FILHAS) {
      const r = await vendColega.from(t).select("cotacao_id").eq("cotacao_id", cotRede);
      expect(r.data, t).toEqual([]);
    }
    expect((await lerCot(masterRede, cotRede)).data).toEqual([{ id: cotRede }]);
    expect((await lerCot(masterOutra, cotRede)).data).toEqual([]);
    expect((await lerCot(matriz, cotRede)).data).toEqual([{ id: cotRede }]);
  });

  it("subordinado desligado ou não aprovado não amplia o escopo do supervisor", async () => {
    for (const id of [cotDesligado, cotPendente]) {
      const c = await lerCot(sup, id);
      expect(c.error).toBeNull();
      expect(c.data).toEqual([]);
      const seg = await sup.from("cotacao_segurado").select("cotacao_id").eq("cotacao_id", id);
      expect(seg.data).toEqual([]);
    }
    // controle: a matriz continua vendo (a cotação existe)
    expect((await lerCot(matriz, cotDesligado)).data).toEqual([{ id: cotDesligado }]);
  });

  async function supervisorComCotacao(prefixo: string) {
    const s = await criarPersonaComEmpresa("supervisor", { emailPrefix: prefixo });
    const v = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: `${prefixo}-v`,
      superiorId: s.userId,
    });
    const cot = await montarCotacao(v.empresaId, v.userId);
    // positivo prévio: antes de perder o acesso, o supervisor lê tudo
    const antes = await lerCot(s.client, cot);
    expect(antes.error).toBeNull();
    expect(antes.data).toEqual([{ id: cot }]);
    const segAntes = await s.client.from("cotacao_segurado").select("nome").eq("cotacao_id", cot);
    expect(segAntes.data).toEqual([{ nome: "Segurado Rede" }]);
    const progAntes = await s.client
      .from("cotacao_calculo_progresso")
      .select("etapa")
      .eq("cotacao_id", cot);
    expect(progAntes.data).toEqual([{ etapa: "login" }]);
    return { s, cot };
  }

  it("NEGATIVO: o próprio supervisor desligado (JWT antigo) é barrado com 'Acesso desativado' em cotação, segurado e progresso", async () => {
    const { s, cot } = await supervisorComCotacao("sup-cotrede-deslig");
    const up = await admin
      .from("profiles")
      .update({ desligado_em: new Date().toISOString() })
      .eq("id", s.userId);
    expect(up.error).toBeNull();

    const leituras = [
      s.client.from("cotacoes").select("id").eq("id", cot),
      s.client.from("cotacao_segurado").select("nome").eq("cotacao_id", cot),
      s.client.from("cotacao_calculo_progresso").select("etapa").eq("cotacao_id", cot),
    ];
    for (const r of await Promise.all(leituras)) {
      expect(r.data).toBeNull();
      expect(r.error?.code).toBe("42501");
      expect(r.error?.message).toBe("Acesso desativado. Entre em contato com a Matriz.");
    }
    // controle: a cotação existe
    expect((await lerCot(matriz, cot)).data).toEqual([{ id: cot }]);
  });

  it("NEGATIVO: o próprio supervisor com status pendente lê vazio (sem erro) em cotação, segurado e progresso", async () => {
    const { s, cot } = await supervisorComCotacao("sup-cotrede-pend");
    const up = await admin.from("profiles").update({ status: "pendente" }).eq("id", s.userId);
    expect(up.error).toBeNull();

    const leituras = [
      s.client.from("cotacoes").select("id").eq("id", cot),
      s.client.from("cotacao_segurado").select("nome").eq("cotacao_id", cot),
      s.client.from("cotacao_calculo_progresso").select("etapa").eq("cotacao_id", cot),
    ];
    for (const r of await Promise.all(leituras)) {
      expect(r.error).toBeNull();
      expect(r.data).toEqual([]);
    }
    expect((await lerCot(matriz, cot)).data).toEqual([{ id: cot }]);
  });
});
