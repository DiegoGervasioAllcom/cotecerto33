/**
 * V11.0.4 — taxonomia única de canais (item 9 do Handoff).
 *
 * Critério de aceite do Handoff: "criar/renomear canal reflete em todos os
 * pontos sem duplicidade". Os testes cobrem as duas metades:
 *
 *  - SEM DUPLICIDADE: o índice único usa `nulls not distinct` + `lower(nome)`.
 *    Sem `nulls not distinct`, dois canais Supper de mesmo nome passariam, porque
 *    em Postgres NULL <> NULL num UNIQUE comum — e o escopo global é justamente
 *    `empresa_id is null`.
 *  - REFLETE EM TODOS OS PONTOS: o lead aponta para o canal por FK, então
 *    renomear é um update numa linha. O trigger de normalização garante que os
 *    escritores antigos (que só conhecem o texto `origem`) caiam no mesmo canal.
 */
import { describe, it, expect } from "vitest";
import {
  admin,
  loginMatriz,
  criarPersonaComEmpresa,
  criarEmpresa,
  uniq,
} from "../helpers/supabase";

/** Insere um lead como service_role e devolve o canal_id resolvido. */
async function leadComOrigem(origem: string | null, canalId?: string): Promise<string | null> {
  const { data, error } = await admin
    .from("leads")
    .insert({ nome: uniq("Lead"), origem, ...(canalId ? { canal_id: canalId } : {}) })
    .select("canal_id")
    .single();
  if (error) throw error;
  return data.canal_id;
}

async function canalPorNome(nome: string): Promise<string> {
  const { data, error } = await admin
    .from("canais")
    .select("id")
    .is("empresa_id", null)
    .eq("nome", nome)
    .single();
  if (error) throw error;
  return data.id;
}

describe("V11.0.4 — catálogo de canais", () => {
  it("tem os canais do protótipo, com os dois eixos separados por tipo", async () => {
    // Asserção por nome, não por lista completa: outros testes deste arquivo
    // criam canais globais, e uma igualdade exata quebraria conforme a ordem de
    // execução em vez de apontar problema real.
    const esperado: Record<string, { tipo: string; ordem: number }> = {
      // CANAIS_LEADS do protótipo r40.
      Movida: { tipo: "supper", ordem: 1 },
      Google: { tipo: "supper", ordem: 2 },
      Facebook: { tipo: "supper", ordem: 3 },
      Indicação: { tipo: "manual", ordem: 4 },
      Manual: { tipo: "manual", ordem: 5 },
      Outro: { tipo: "manual", ordem: 6 },
      // Estes dois estavam escondidos dentro de leads.origem e não são captação.
      "Cotação direta": { tipo: "sistema", ordem: 90 },
      Renovação: { tipo: "sistema", ordem: 91 },
    };

    const { data, error } = await admin
      .from("canais")
      .select("nome, tipo, ordem")
      .is("empresa_id", null)
      .in("nome", Object.keys(esperado));
    if (error) throw error;

    expect(data ?? []).toHaveLength(Object.keys(esperado).length);
    for (const c of data ?? []) {
      expect(c.tipo, `tipo do canal ${c.nome}`).toBe(esperado[c.nome].tipo);
      expect(c.ordem, `ordem do canal ${c.nome}`).toBe(esperado[c.nome].ordem);
    }
  });

  it("não aceita canal Supper duplicado, nem variando maiúsculas", async () => {
    const dup = await admin.from("canais").insert({ nome: "Movida", tipo: "supper" });
    expect(dup.error, "passou canal Supper duplicado").not.toBeNull();

    const caso = await admin.from("canais").insert({ nome: "mOvIdA", tipo: "supper" });
    expect(caso.error, "passou duplicado com outra caixa").not.toBeNull();
  });

  it("duas franquias podem ter canal próprio de mesmo nome", async () => {
    const a = await criarEmpresa();
    const b = await criarEmpresa();
    const nome = uniq("Indicação local").slice(0, 60);

    const r1 = await admin.from("canais").insert({ nome, tipo: "manual", empresa_id: a.id });
    const r2 = await admin.from("canais").insert({ nome, tipo: "manual", empresa_id: b.id });
    expect(r1.error).toBeNull();
    expect(r2.error, "unicidade vazou entre escopos de empresa").toBeNull();

    // Mas repetir na MESMA franquia não passa.
    const r3 = await admin.from("canais").insert({ nome, tipo: "manual", empresa_id: a.id });
    expect(r3.error).not.toBeNull();
  });

  it("tipo aceita só supper/manual/sistema", async () => {
    const { error } = await admin
      .from("canais")
      .insert({ nome: uniq("Canal").slice(0, 60), tipo: "inventado" });
    expect(error).not.toBeNull();
  });
});

describe("V11.0.4 — lead resolve o canal", () => {
  it("texto legado que casa com canal vira canal_id", async () => {
    const esperado = await canalPorNome("Movida");
    expect(await leadComOrigem("Movida")).toBe(esperado);
    // O trigger compara sem diferenciar caixa.
    expect(await leadComOrigem("movida")).toBe(esperado);
  });

  it("'cotacao' e 'renovacao' caem nos canais de sistema, não em captação", async () => {
    expect(await leadComOrigem("cotacao")).toBe(await canalPorNome("Cotação direta"));
    expect(await leadComOrigem("renovacao")).toBe(await canalPorNome("Renovação"));
  });

  it("texto desconhecido deixa canal_id nulo em vez de inventar canal", async () => {
    expect(await leadComOrigem(uniq("campanha-que-nao-existe"))).toBeNull();
    expect(await leadComOrigem(null)).toBeNull();
  });

  it("canal_id informado explicitamente ganha do texto legado", async () => {
    const google = await canalPorNome("Google");
    // origem diz Movida, mas quem escreveu já sabia o canal.
    expect(await leadComOrigem("Movida", google)).toBe(google);
  });

  it("renomear o canal reflete no lead sem tocar no lead", async () => {
    const canal = await admin
      .from("canais")
      .insert({ nome: uniq("Parceria").slice(0, 60), tipo: "supper" })
      .select("id, nome")
      .single();
    if (canal.error) throw canal.error;

    const { data: lead } = await admin
      .from("leads")
      .insert({ nome: uniq("Lead renomeio"), canal_id: canal.data.id })
      .select("id")
      .single();

    const novoNome = uniq("Parceria renomeada").slice(0, 60);
    const { error } = await admin.from("canais").update({ nome: novoNome }).eq("id", canal.data.id);
    expect(error).toBeNull();

    // O lead não foi tocado e já lê o nome novo pela FK.
    const { data: lido } = await admin
      .from("leads")
      .select("canais(nome)")
      .eq("id", lead!.id)
      .single();
    expect((lido as { canais: { nome: string } | null }).canais?.nome).toBe(novoNome);
  });
});

describe("V11.0.4 — RLS de canais", () => {
  it("todo autenticado lê os canais Supper", async () => {
    const vend = await criarPersonaComEmpresa("vendedor", { emailPrefix: "canal-vend" });
    const { data, error } = await vend.client.from("canais").select("nome").is("empresa_id", null);
    expect(error).toBeNull();
    expect((data ?? []).map((c) => c.nome)).toContain("Movida");
  });

  it("vendedor não lê canal próprio de franquia de fora da rede dele", async () => {
    const outra = await criarEmpresa();
    const { data: canalAlheio } = await admin
      .from("canais")
      .insert({ nome: uniq("Canal alheio").slice(0, 60), tipo: "manual", empresa_id: outra.id })
      .select("id")
      .single();

    const vend = await criarPersonaComEmpresa("vendedor", { emailPrefix: "canal-fora" });
    const { data } = await vend.client.from("canais").select("id").eq("id", canalAlheio!.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("vendedor não cria canal Supper", async () => {
    const vend = await criarPersonaComEmpresa("vendedor", { emailPrefix: "canal-vend-cria" });
    const { error } = await vend.client
      .from("canais")
      .insert({ nome: uniq("Pirata").slice(0, 60), tipo: "supper" });
    expect(error, "vendedor criou canal global").not.toBeNull();
  });

  it("franqueado cria e remove canal próprio, mas não canal Supper", async () => {
    const franq = await criarPersonaComEmpresa("franqueado", { emailPrefix: "canal-franq" });

    const proprio = await franq.client
      .from("canais")
      .insert({
        nome: uniq("Instagram da unidade").slice(0, 60),
        tipo: "manual",
        empresa_id: franq.empresaId,
      })
      .select("id")
      .single();
    expect(proprio.error, "franquia não conseguiu criar canal próprio").toBeNull();

    const del = await franq.client.from("canais").delete().eq("id", proprio.data!.id);
    expect(del.error).toBeNull();

    const global = await franq.client
      .from("canais")
      .insert({ nome: uniq("Global pirata").slice(0, 60), tipo: "supper" });
    expect(global.error, "franquia criou canal Supper").not.toBeNull();
  });

  it("Matriz habilita canais de um acesso; o próprio vendedor não se habilita", async () => {
    const matriz = await loginMatriz();
    const vend = await criarPersonaComEmpresa("vendedor", { emailPrefix: "canal-hab" });
    const movida = await canalPorNome("Movida");
    const google = await canalPorNome("Google");

    const ok = await matriz
      .from("profile_canais")
      .insert({ profile_id: vend.userId, canal_id: movida });
    expect(ok.error, "Matriz não conseguiu habilitar canal").toBeNull();

    // O vendedor lê os próprios canais...
    const { data: meus } = await vend.client.from("profile_canais").select("canal_id");
    expect((meus ?? []).map((r) => r.canal_id)).toEqual([movida]);

    // ...mas não se habilita em outro.
    const { error } = await vend.client
      .from("profile_canais")
      .insert({ profile_id: vend.userId, canal_id: google });
    expect(error, "vendedor se habilitou num canal novo").not.toBeNull();
  });
});
