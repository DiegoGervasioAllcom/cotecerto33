import { describe, expect, it } from "vitest";
import {
  admin,
  criarEmpresa,
  criarPersonaComEmpresa,
  loginMatriz,
  uniq,
} from "../helpers/supabase";

const LOJAS_MOVIDA_SEED = [
  "Americana",
  "Aricanduva",
  "Campinas Amoreiras",
  "Campinas Itapura",
  "Campinas Orosimbo",
  "Campinas Shop Dom Pedro",
  "Itaim Paulista",
  "Jundiaí",
  "Mogi das Cruzes",
  "Penha",
  "Praia Grande",
  "Santos",
  "São José dos Campos",
  "São Miguel Paulista",
  "São Paulo Radial Leste",
  "Suzano",
  "Taubaté",
  "Timóteo Penteado",
  "Vila Carrão",
  "Vila Ema",
  "Vila Guilherme",
].sort();

const ALIASES_MOVIDA_SEED = [
  ["Americana", "Americana"],
  ["Aricanduva", "Aricanduva"],
  ["Campinas Amoreiras", "Campinas Amoreiras"],
  ["Campinas Itapura", "Campinas Itapura"],
  ["Campinas Orosimbo", "Campinas Orosimbo"],
  ["Campinas Shop Dom Pedro", "Campinas - Shopping Dom Pedro"],
  ["Campinas Shop Dom Pedro", "Campinas Shop Dom Pedro"],
  ["Campinas Shop Dom Pedro", "Seminovos Movida Campinas Shopping Dom Pedro"],
  ["Itaim Paulista", "Itaim Paulista"],
  ["Jundiaí", "Jundiai"],
  ["Mogi das Cruzes", "Mogi das Cruzes"],
  ["Penha", "Penha"],
  ["Praia Grande", "Praia Grande"],
  ["Praia Grande", "Seminovos Movida Praia Grande - Sp"],
  ["Santos", "Santos"],
  ["Suzano", "Seminovos Movida Suzano"],
  ["Suzano", "Seminovos Movida Suzano - Sp"],
  ["Suzano", "Suzano"],
  ["São José dos Campos", "Sao Jose dos Campos"],
  ["São Miguel Paulista", "Sao Miguel"],
  ["São Miguel Paulista", "Sao Miguel Paulista"],
  ["São Paulo Radial Leste", "Radial Leste"],
  ["São Paulo Radial Leste", "Sao Paulo Radial Leste"],
  ["Taubaté", "Taubate"],
  ["Timóteo Penteado", "Guarulhos Timoteo Penteado"],
  ["Timóteo Penteado", "Timoteo Penteado"],
  ["Vila Carrão", "Vila Carrao"],
  ["Vila Ema", "Vila Ema"],
  ["Vila Guilherme", "Vila Guilherme"],
]
  .map(([loja, alias]) => `${loja}|${alias}`)
  .sort();

const telefone = () => `11${Math.floor(900000000 + Math.random() * 99999999)}`.slice(0, 11);
const placa = () => `M${Math.floor(Math.random() * 1e7)}`.slice(0, 7).toUpperCase();

async function ingerir(loja: string, nome = uniq("Lead Movida"), placaInformada = placa()) {
  const { data, error } = await admin.rpc("ingerir_lead_externo", {
    type: "INSERT",
    record: { nome_cliente: nome, telefone: telefone(), placa: placaInformada, loja },
  } as never);
  if (error) throw error;
  const row = (data as { lead_id: string; criado: boolean }[])[0];
  return row.lead_id;
}

async function lead(id: string) {
  const { data, error } = await admin
    .from("leads")
    .select("empresa_id,responsavel_id")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function rota(opts?: { exigirOnline?: boolean }) {
  const empresa = await criarEmpresa();
  const { data: loja, error } = await admin
    .from("movida_lojas")
    .insert({
      nome: uniq("Loja Movida"),
      empresa_id: empresa.id,
      exigir_online: opts?.exigirOnline ?? false,
    })
    .select("id")
    .single();
  if (error) throw error;
  const alias = uniq("Movida São José");
  const { error: ea } = await admin.from("movida_loja_aliases").insert({ loja_id: loja.id, alias });
  if (ea) throw ea;
  return { empresaId: empresa.id, lojaId: loja.id, alias };
}

async function membro(
  lojaId: string,
  empresaId: string,
  overrides?: { peso?: number; limite?: number },
) {
  const vendedor = await criarPersonaComEmpresa("vendedor", {
    empresaId,
    emailPrefix: "vend-movida",
  });
  const { error } = await admin.from("movida_loja_vendedores").insert({
    loja_id: lojaId,
    vendedor_id: vendedor.userId,
    peso: overrides?.peso ?? 1,
    limite_diario: overrides?.limite,
  });
  if (error) throw error;
  return vendedor;
}

/** Franqueado Individual (PJ) atuando sozinho como vendedor — 20260818030000. */
async function franqueadoIndividual(lojaId: string, empresaId: string) {
  const { data: modelo, error: modeloError } = await admin
    .from("modelos_franquia")
    .select("id")
    .eq("modalidade", "individual")
    .limit(1)
    .single();
  if (modeloError) throw modeloError;
  const { error: modeloEmpresaError } = await admin
    .from("empresas")
    .update({ modelo_id: modelo.id })
    .eq("id", empresaId);
  if (modeloEmpresaError) throw modeloEmpresaError;

  const franqueado = await criarPersonaComEmpresa("franqueado", {
    empresaId,
    emailPrefix: "franq-indiv-movida",
  });
  const { error } = await admin.from("movida_loja_vendedores").insert({
    loja_id: lojaId,
    vendedor_id: franqueado.userId,
    peso: 1,
  });
  if (error) throw error;
  return franqueado;
}

describe("V11.9.6 — distribuição captacao_movida por loja", () => {
  it("seed cadastra exatamente as 21 lojas na Matriz atual, pausadas e sem vendedores", async () => {
    const { data: matrizes, error: matrizError } = await admin
      .from("empresas")
      .select("id")
      .eq("tipo", "matriz");
    expect(matrizError).toBeNull();
    expect(matrizes).toHaveLength(1);

    const matrizId = matrizes![0].id;
    const { data: lojas, error: lojasError } = await admin
      .from("movida_lojas")
      .select("id,nome,empresa_id,ativa,exigir_online")
      .eq("empresa_id", matrizId)
      .in("nome", LOJAS_MOVIDA_SEED);
    expect(lojasError).toBeNull();
    expect(lojas?.map(({ nome }) => nome).sort()).toEqual(LOJAS_MOVIDA_SEED);
    expect(lojas?.every((loja) => loja.empresa_id === matrizId)).toBe(true);
    expect(lojas?.every((loja) => loja.ativa === false && loja.exigir_online === false)).toBe(true);

    const { count, error: poolError } = await admin
      .from("movida_loja_vendedores")
      .select("vendedor_id", { count: "exact", head: true })
      .in(
        "loja_id",
        lojas!.map(({ id }) => id),
      );
    expect(poolError).toBeNull();
    expect(count).toBe(0);
  });

  it("seed liga exatamente os 29 aliases oficiais às lojas corretas", async () => {
    const { data: lojas, error: lojasError } = await admin
      .from("movida_lojas")
      .select("id,nome")
      .in("nome", LOJAS_MOVIDA_SEED);
    expect(lojasError).toBeNull();
    expect(lojas).toHaveLength(21);

    const nomePorId = new Map(lojas!.map(({ id, nome }) => [id, nome]));
    const { data: aliases, error: aliasesError } = await admin
      .from("movida_loja_aliases")
      .select("loja_id,alias")
      .in(
        "loja_id",
        lojas!.map(({ id }) => id),
      );
    expect(aliasesError).toBeNull();
    expect(
      aliases?.map(({ loja_id, alias }) => `${nomePorId.get(loja_id)}|${alias}`).sort(),
    ).toEqual(ALIASES_MOVIDA_SEED);
  });

  it("RLS: vendedor comum não lê nem altera a configuração das rotas", async () => {
    const r = await rota();
    const v = await membro(r.lojaId, r.empresaId);
    const { data, error } = await v.client.from("movida_lojas").select("id").eq("id", r.lojaId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const { error: escrita } = await v.client
      .from("movida_lojas")
      .update({ ativa: false })
      .eq("id", r.lojaId);
    expect(escrita).toBeNull(); // UPDATE sem linha visível afeta zero linhas
    const { data: preservada } = await admin
      .from("movida_lojas")
      .select("ativa")
      .eq("id", r.lojaId)
      .single();
    expect(preservada?.ativa).toBe(true);
  });

  it("RLS: Master cria rota para a própria empresa e não configura outra rede", async () => {
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-movida" });
    const nome = uniq("Rota criada pelo Master");
    const { data: criada, error: criarError } = await master.client
      .from("movida_lojas")
      .insert({ nome, empresa_id: master.empresaId })
      .select("id,nome")
      .single();

    expect(criarError).toBeNull();
    expect(criada?.nome).toBe(nome);
    const { data: visivel, error: lerError } = await master.client
      .from("movida_lojas")
      .select("id")
      .eq("id", criada!.id);
    expect(lerError).toBeNull();
    expect(visivel).toEqual([{ id: criada!.id }]);

    const outraRede = await criarEmpresa();
    const { error: foraDaRede } = await master.client.from("movida_lojas").insert({
      nome: uniq("Rota de outra rede"),
      empresa_id: outraRede.id,
    });
    expect(foraDaRede).not.toBeNull();
  });

  it("RPC salva loja e alias atomicamente e Matriz/mdist podem administrá-los", async () => {
    const empresa = await criarEmpresa();
    const matriz = await loginMatriz();
    const alias = uniq("Alias atômico");
    const { data: lojaId, error } = await matriz.rpc("fn_salvar_rota_movida", {
      p_loja_id: null,
      p_nome: uniq("Rota atômica"),
      p_alias: alias,
      p_empresa_id: empresa.id,
      p_ativa: true,
      p_exigir_online: false,
    } as never);
    expect(error).toBeNull();
    const { data: aliases } = await matriz
      .from("movida_loja_aliases")
      .select("alias")
      .eq("loja_id", lojaId as string);
    expect(aliases).toEqual([{ alias }]);

    const gestor = await criarPersonaComEmpresa("interno", { emailPrefix: "mdist-movida" });
    await admin.from("profile_areas").insert({ profile_id: gestor.userId, area_chave: "mdist" });
    const { error: mdistError } = await gestor.client
      .from("movida_lojas")
      .update({ ativa: false })
      .eq("id", lojaId as string);
    expect(mdistError).toBeNull();
  });

  it("pool rejeita vendedor suspenso mesmo com role e empresa corretas", async () => {
    const r = await rota();
    const vendedor = await criarPersonaComEmpresa("vendedor", {
      empresaId: r.empresaId,
      emailPrefix: "vend-movida-suspenso",
    });
    const { error: suspenderError } = await admin
      .from("profiles")
      .update({
        status: "suspensa",
        desligado_em: new Date().toISOString(),
        desligado_motivo: "teste de elegibilidade do pool",
      })
      .eq("id", vendedor.userId);
    expect(suspenderError).toBeNull();

    const { error } = await admin.from("movida_loja_vendedores").insert({
      loja_id: r.lojaId,
      vendedor_id: vendedor.userId,
      peso: 1,
    });
    expect(error).not.toBeNull();
    const { data: membroInvalido } = await admin
      .from("movida_loja_vendedores")
      .select("vendedor_id")
      .eq("loja_id", r.lojaId)
      .eq("vendedor_id", vendedor.userId);
    expect(membroInvalido).toEqual([]);
  });

  it("alias explícito normalizado envia todos a um único vendedor elegível", async () => {
    const r = await rota();
    const v = await membro(r.lojaId, r.empresaId);
    const a = await ingerir(`  ${r.alias.toUpperCase()}  `);
    const b = await ingerir(r.alias);
    expect(await lead(a)).toMatchObject({ empresa_id: r.empresaId, responsavel_id: v.userId });
    expect(await lead(b)).toMatchObject({ empresa_id: r.empresaId, responsavel_id: v.userId });
  });

  it("menor carga ponderada usa peso como participação relativa", async () => {
    const r = await rota();
    const leve = await membro(r.lojaId, r.empresaId, { peso: 1 });
    const pesado = await membro(r.lojaId, r.empresaId, { peso: 2 });
    const l1 = await ingerir(r.alias);
    const l2 = await ingerir(r.alias);
    const l3 = await ingerir(r.alias);
    const destinos = await Promise.all([l1, l2, l3].map(lead));
    expect(destinos.filter((x) => x.responsavel_id === pesado.userId)).toHaveLength(2);
    expect(destinos.filter((x) => x.responsavel_id === leve.userId)).toHaveLength(1);
  });

  it("limite diário por membro é contado pela auditoria da rota", async () => {
    const r = await rota();
    const limitado = await membro(r.lojaId, r.empresaId, { limite: 1 });
    const livre = await membro(r.lojaId, r.empresaId);
    const primeiro = await ingerir(r.alias);
    const segundo = await ingerir(r.alias);
    const destinos = [await lead(primeiro), await lead(segundo)];
    expect(destinos.some((x) => x.responsavel_id === limitado.userId)).toBe(true);
    expect(destinos.some((x) => x.responsavel_id === livre.userId)).toBe(true);
  });

  it("rota que exige online deixa na fila global quando ninguém está online", async () => {
    const r = await rota({ exigirOnline: true });
    await membro(r.lojaId, r.empresaId);
    const id = await ingerir(r.alias);
    expect(await lead(id)).toMatchObject({ empresa_id: null, responsavel_id: null });
    const { data: audit } = await admin
      .from("movida_distribuicao_auditoria")
      .select("resultado")
      .eq("lead_id", id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .single();
    expect(audit?.resultado).toBe("sem_elegivel");
  });

  it("rota inativa preserva fila global e registra o motivo", async () => {
    const r = await rota();
    await membro(r.lojaId, r.empresaId);
    await admin.from("movida_lojas").update({ ativa: false }).eq("id", r.lojaId);
    const id = await ingerir(r.alias);
    expect(await lead(id)).toMatchObject({ empresa_id: null, responsavel_id: null });
    const { data } = await admin
      .from("movida_distribuicao_auditoria")
      .select("resultado")
      .eq("lead_id", id)
      .single();
    expect(data?.resultado).toBe("loja_inativa");
  });

  it("travado só fica inelegível quando pausa_leads_ativa está ligada no bloco", async () => {
    const r = await rota();
    const v = await membro(r.lojaId, r.empresaId);
    const { data: configOriginal, error: configError } = await admin
      .from("regua_performance_config")
      .select("pausa_leads_ativa")
      .eq("bloco", "interno")
      .single();
    expect(configError).toBeNull();

    try {
      await admin.from("profiles").update({ performance_status: "travado" }).eq("id", v.userId);
      await admin
        .from("regua_performance_config")
        .update({ pausa_leads_ativa: false })
        .eq("bloco", "interno");
      const liberado = await ingerir(r.alias);
      expect((await lead(liberado)).responsavel_id).toBe(v.userId);
      await admin
        .from("regua_performance_config")
        .update({ pausa_leads_ativa: true })
        .eq("bloco", "interno");
      const pausado = await ingerir(r.alias);
      expect(await lead(pausado)).toMatchObject({ empresa_id: null, responsavel_id: null });
    } finally {
      await admin
        .from("regua_performance_config")
        .update({ pausa_leads_ativa: configOriginal!.pausa_leads_ativa })
        .eq("bloco", "interno");
    }
  });

  it("limite diário é respeitado sob ingestões realmente concorrentes", async () => {
    const r = await rota();
    const limitado = await membro(r.lojaId, r.empresaId, { limite: 1 });
    const ids = await Promise.all(Array.from({ length: 6 }, () => ingerir(r.alias)));
    const destinos = await Promise.all(ids.map(lead));
    expect(destinos.filter((item) => item.responsavel_id === limitado.userId)).toHaveLength(1);
  });

  it("reingestão da mesma placa é idempotente e não redistribui o lead", async () => {
    const r = await rota();
    const v = await membro(r.lojaId, r.empresaId);
    const mesmaPlaca = placa();
    const primeiro = await ingerir(r.alias, uniq("Primeiro"), mesmaPlaca);
    const segundo = await ingerir(r.alias, uniq("Segundo"), mesmaPlaca);
    expect(segundo).toBe(primeiro);
    expect((await lead(primeiro)).responsavel_id).toBe(v.userId);
    const { count } = await admin
      .from("movida_distribuicao_auditoria")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", primeiro)
      .eq("resultado", "distribuido");
    expect(count).toBe(1);
  });

  it("auditoria é append-only, isolada por rede e sobrevive à exclusão do lead", async () => {
    const r = await rota();
    const vendedor = await membro(r.lojaId, r.empresaId);
    const id = await ingerir(r.alias);
    const masterDaRede = await criarPersonaComEmpresa("master", {
      empresaId: r.empresaId,
      emailPrefix: "master-audit-movida",
    });
    const masterOutraRede = await criarPersonaComEmpresa("master", {
      emailPrefix: "master-audit-outra",
    });
    const { data: propria } = await masterDaRede.client
      .from("movida_distribuicao_auditoria")
      .select("id")
      .eq("lead_id", id);
    const { data: cruzada } = await masterOutraRede.client
      .from("movida_distribuicao_auditoria")
      .select("id")
      .eq("lead_id", id);
    expect(propria).toHaveLength(1);
    expect(cruzada).toEqual([]);
    const auditId = propria![0].id;
    const { error: updateError } = await masterDaRede.client
      .from("movida_distribuicao_auditoria")
      .update({ vendedor_id: vendedor.userId })
      .eq("id", auditId);
    const { error: deleteError } = await masterDaRede.client
      .from("movida_distribuicao_auditoria")
      .delete()
      .eq("id", auditId);
    expect(updateError).not.toBeNull();
    expect(deleteError).not.toBeNull();
    await admin.from("leads").delete().eq("id", id);
    const { data: retida } = await admin
      .from("movida_distribuicao_auditoria")
      .select("lead_id,resultado")
      .eq("id", auditId)
      .single();
    expect(retida).toMatchObject({ lead_id: null, resultado: "distribuido" });
  });

  it("franqueado Individual (PJ) entra no pool e recebe lead distribuído", async () => {
    const r = await rota();
    const f = await franqueadoIndividual(r.lojaId, r.empresaId);
    const id = await ingerir(r.alias);
    expect(await lead(id)).toMatchObject({ empresa_id: r.empresaId, responsavel_id: f.userId });
  });

  it("franqueado Full não entra no pool — só franqueado Individual é aceito", async () => {
    const r = await rota();
    const { data: modeloFull, error: modeloError } = await admin
      .from("modelos_franquia")
      .select("id")
      .eq("modalidade", "full")
      .limit(1)
      .single();
    expect(modeloError).toBeNull();
    await admin.from("empresas").update({ modelo_id: modeloFull!.id }).eq("id", r.empresaId);
    const franqueadoFull = await criarPersonaComEmpresa("franqueado", {
      empresaId: r.empresaId,
      emailPrefix: "franq-full-movida",
    });
    const { error } = await admin.from("movida_loja_vendedores").insert({
      loja_id: r.lojaId,
      vendedor_id: franqueadoFull.userId,
      peso: 1,
    });
    expect(error).not.toBeNull();
  });

  it("sem alias cai na fila global; reprocessamento da loja só toca pendentes daquela rota", async () => {
    const r = await rota();
    const semAlias = await ingerir(uniq("Loja desconhecida"));
    const daRota = await ingerir(r.alias);
    expect(await lead(semAlias)).toMatchObject({ empresa_id: null, responsavel_id: null });
    expect(await lead(daRota)).toMatchObject({ empresa_id: null, responsavel_id: null });
    const v = await membro(r.lojaId, r.empresaId);
    const { data, error } = await admin.rpc("reprocessar_leads_movida_pendentes", {
      p_loja_id: r.lojaId,
      p_limite: 50,
    });
    expect(error).toBeNull();
    expect(data?.[0]).toMatchObject({ processados: 1, distribuidos: 1, pendentes: 0 });
    expect(await lead(daRota)).toMatchObject({ empresa_id: r.empresaId, responsavel_id: v.userId });
    expect(await lead(semAlias)).toMatchObject({ empresa_id: null, responsavel_id: null });
  });
});
