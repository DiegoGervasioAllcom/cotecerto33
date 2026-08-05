/**
 * H9/H10 (V11 · hierarquia) — escopo por área, alçada por cargo e cadeia com o
 * Coordenador Comercial.
 *
 * O que estes testes protegem, em ordem de gravidade:
 *
 *  1. Supervisor Operacional NÃO tem alçada de desconto ("é o único supervisor
 *     com alçada" refere-se ao de Vendas). Se `fn_modelo_alcada_desconto` voltar
 *     a derivar de perfil em vez de cargo, os dois supervisores compartilham
 *     alçada e o Operacional passa a aprovar desconto — o bug que H6 evita.
 *  2. Master continua enxergando a própria rede depois de passar a responder ao
 *     Coordenador (a regressão que a s_fix_master_rls_escopo_rede corrigiu).
 *  3. `fn_areas_do_usuario` não vira ferramenta de enumeração: é security definer.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  admin,
  loginMatriz,
  criarPersonaComEmpresa,
  criarEmpresa,
  uniq,
  type Db,
} from "../helpers/supabase";

/** Chamada tipada da RPC de áreas, devolvendo só as chaves. */
async function areasDe(client: Db, userId: string): Promise<string[]> {
  const { data, error } = await client.rpc("fn_areas_do_usuario", { _user_id: userId });
  if (error) throw error;
  return (data ?? []).map((r) => r.area_chave).sort();
}

async function modeloAlcada(client: Db, userId: string): Promise<string | null> {
  const { data, error } = await client.rpc("fn_modelo_alcada_desconto", {
    p_profile_id: userId,
  });
  if (error) throw error;
  return data;
}

describe("H2/H3 — catálogo de áreas e cargos preset", () => {
  it("tem as 17 áreas ativas do protótipo V11 e as 4 'em breve'", async () => {
    const { count: ativas } = await admin
      .from("areas")
      .select("chave", { count: "exact", head: true })
      .eq("disponivel", true);
    const { count: futuras } = await admin
      .from("areas")
      .select("chave", { count: "exact", head: true })
      .eq("disponivel", false);
    expect(ativas).toBe(17);
    expect(futuras).toBe(4);
  });

  it("cada cargo preset tem o número de áreas do protótipo r41", async () => {
    // Contagens conferidas contra const CARGOS de cotecerto_prototipo_v11.html.
    // sup_vendas: 11 desde 03/08/2026 (Lis resolveu a divergência r40 x Fluxos
    // a favor dos Fluxos — Estornos entra; r41 já traz o preset corrigido).
    const esperado: Record<string, number> = {
      matriz_total: 17,
      coord_com: 17,
      sup_vendas: 11,
      sup_operacional: 4,
      sup_backoffice: 5,
      assist_com: 3,
      marketing: 5,
    };
    const { data, error } = await admin.from("cargo_areas").select("cargo_id");
    if (error) throw error;
    const contagem = (data ?? []).reduce<Record<string, number>>((acc, r) => {
      acc[r.cargo_id] = (acc[r.cargo_id] ?? 0) + 1;
      return acc;
    }, {});
    for (const [cargo, n] of Object.entries(esperado)) {
      expect(contagem[cargo], `cargo ${cargo}`).toBe(n);
    }
  });
});

describe("H4/H10 — resolução do escopo de áreas", () => {
  it("Matriz vê as 17 áreas ativas, sem depender de cargo", async () => {
    const matriz = await loginMatriz();
    const { data: user } = await matriz.auth.getUser();
    const areas = await areasDe(matriz, user.user!.id);
    expect(areas).toHaveLength(17);
    expect(areas).toContain("mconf");
  });

  it("supervisor com cargo sup_operacional recebe 4 áreas e NÃO recebe Aprovações", async () => {
    const sup = await criarPersonaComEmpresa("supervisor", { emailPrefix: "sup-oper" });
    await admin.from("profiles").update({ cargo_id: "sup_operacional" }).eq("id", sup.userId);

    const areas = await areasDe(sup.client, sup.userId);
    expect(areas).toEqual(["macessos", "mdash", "mdist", "mleads"]);
    expect(areas).not.toContain("maprov");
  });

  it("supervisor com cargo sup_vendas recebe 11 áreas, incluindo Aprovações e Estornos", async () => {
    const sup = await criarPersonaComEmpresa("supervisor", { emailPrefix: "sup-vend" });
    await admin.from("profiles").update({ cargo_id: "sup_vendas" }).eq("id", sup.userId);

    const areas = await areasDe(sup.client, sup.userId);
    expect(areas).toHaveLength(11);
    expect(areas).toContain("maprov");
    // Divergência r40 x Fluxos resolvida pela Lis em 03/08/2026 a favor dos
    // Fluxos — ver docs/PERGUNTAS_PARA_LIS.md item 3.
    expect(areas).toContain("mestorno");
  });

  it("override em profile_areas SUBSTITUI o preset do cargo, não soma", async () => {
    const sup = await criarPersonaComEmpresa("supervisor", { emailPrefix: "sup-ovr" });
    await admin.from("profiles").update({ cargo_id: "sup_vendas" }).eq("id", sup.userId);
    await admin.from("profile_areas").insert([
      { profile_id: sup.userId, area_chave: "mdash" },
      { profile_id: sup.userId, area_chave: "mrel" },
    ]);

    const areas = await areasDe(sup.client, sup.userId);
    expect(areas).toEqual(["mdash", "mrel"]);
    expect(areas).not.toContain("maprov"); // vinha do preset e foi substituído
  });

  it("sem cargo e sem override, o escopo é vazio (não vaza menu)", async () => {
    const sup = await criarPersonaComEmpresa("supervisor", { emailPrefix: "sup-nada" });
    const areas = await areasDe(sup.client, sup.userId);
    expect(areas).toEqual([]);
  });

  it("não permite enumerar o escopo de outra pessoa", async () => {
    const alvo = await criarPersonaComEmpresa("supervisor", { emailPrefix: "sup-alvo" });
    await admin.from("profiles").update({ cargo_id: "sup_vendas" }).eq("id", alvo.userId);
    const curioso = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-curioso" });

    // A função é security definer: sem o guard, devolveria as 11 áreas do alvo.
    expect(await areasDe(curioso.client, alvo.userId)).toEqual([]);
    // A Matriz pode, porque administra acesso (tela Cadastros Matriz).
    const matriz = await loginMatriz();
    expect(await areasDe(matriz, alvo.userId)).toHaveLength(11);
  });
});

describe("H6/H9 — alçada de desconto derivada de cargo", () => {
  let seguradoraId: string;

  beforeAll(async () => {
    const { data, error } = await admin
      .from("seguradoras")
      .insert({ nome: uniq("Seguradora H6") })
      .select("id")
      .single();
    if (error) throw error;
    seguradoraId = data.id;
    // Alçada existe SÓ para supervisor_vendas.
    const { error: e2 } = await admin
      .from("desconto_politicas")
      .insert({ modelo: "supervisor_vendas", seguradora_id: seguradoraId, pct_maximo: 10 });
    if (e2) throw e2;
  });

  it("sup_vendas deriva 'supervisor_vendas' e fica dentro da alçada", async () => {
    const sup = await criarPersonaComEmpresa("supervisor", { emailPrefix: "alc-vend" });
    await admin.from("profiles").update({ cargo_id: "sup_vendas" }).eq("id", sup.userId);

    expect(await modeloAlcada(sup.client, sup.userId)).toBe("supervisor_vendas");
    const { data } = await sup.client.rpc("fn_dentro_alcada_desconto", {
      p_aprovador: sup.userId,
      p_seguradora: seguradoraId,
      p_pct: 8,
    });
    expect(data).toBe(true);
  });

  it("sup_operacional NÃO tem modelo de alçada e fica fora, mesmo com política cadastrada", async () => {
    const sup = await criarPersonaComEmpresa("supervisor", { emailPrefix: "alc-oper" });
    await admin.from("profiles").update({ cargo_id: "sup_operacional" }).eq("id", sup.userId);

    expect(await modeloAlcada(sup.client, sup.userId)).toBeNull();
    const { data } = await sup.client.rpc("fn_dentro_alcada_desconto", {
      p_aprovador: sup.userId,
      p_seguradora: seguradoraId,
      p_pct: 1,
    });
    expect(data).toBe(false); // NULL de modelo => escala, nunca aprova por omissão
  });

  it("supervisor sem cargo definido também fica fora da alçada", async () => {
    const sup = await criarPersonaComEmpresa("supervisor", { emailPrefix: "alc-sem" });
    expect(await modeloAlcada(sup.client, sup.userId)).toBeNull();
  });

  it("coordenador deriva o modelo 'coordenador'", async () => {
    const coord = await criarPersonaComEmpresa("coordenador", { emailPrefix: "coord" });
    expect(await modeloAlcada(coord.client, coord.userId)).toBe("coordenador");
  });

  it("desconto_politicas não aceita mais o modelo legado 'supervisor'", async () => {
    // `modelo` é text nos tipos gerados (o check é constraint de banco, não enum),
    // então isto compila — quem barra é o Postgres, que é justamente o ponto.
    const { error } = await admin
      .from("desconto_politicas")
      .insert({ modelo: "supervisor", seguradora_id: seguradoraId, pct_maximo: 5 });
    expect(error).not.toBeNull();
  });
});

describe("H5 — cadeia com o Coordenador Comercial", () => {
  it("Master continua enxergando a própria rede reportando ao Coordenador", async () => {
    const coord = await criarPersonaComEmpresa("coordenador", { emailPrefix: "coord-cadeia" });
    const master = await criarPersonaComEmpresa("master", {
      emailPrefix: "master-cadeia",
      superiorId: coord.userId,
    });
    // Franquia pendurada no master, com uma pessoa reportando a ele.
    const franqEmpresa = await criarEmpresa();
    const franq = await criarPersonaComEmpresa("franqueado", {
      empresaId: franqEmpresa.id,
      emailPrefix: "franq-cadeia",
      superiorId: master.userId,
    });

    const { data, error } = await master.client.rpc("empresas_visiveis", {
      _user_id: master.userId,
    });
    if (error) throw error;
    const ids = (data ?? []).map((r) => r.empresa_id);
    expect(ids).toContain(master.empresaId);
    expect(ids, "master perdeu a franquia da rede dele").toContain(franq.empresaId);
  });

  it("Coordenador enxerga a rede toda, como a Matriz", async () => {
    const coord = await criarPersonaComEmpresa("coordenador", { emailPrefix: "coord-visao" });
    const outra = await criarEmpresa(); // empresa sem nenhuma relação com ele

    const { data, error } = await coord.client.rpc("empresas_visiveis", {
      _user_id: coord.userId,
    });
    if (error) throw error;
    expect((data ?? []).map((r) => r.empresa_id)).toContain(outra.id);
  });

  it("Master NÃO enxerga empresa fora da rede dele", async () => {
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-fora" });
    const alheia = await criarEmpresa();

    const { data, error } = await master.client.rpc("empresas_visiveis", {
      _user_id: master.userId,
    });
    if (error) throw error;
    expect((data ?? []).map((r) => r.empresa_id)).not.toContain(alheia.id);
  });
});

describe("H3 — RLS de cargos e profile_areas", () => {
  it("vendedor lê o catálogo mas não escreve cargo", async () => {
    const vend = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-cargo" });

    const { data: leitura, error: erroLeitura } = await vend.client
      .from("cargos")
      .select("id")
      .eq("id", "sup_vendas");
    expect(erroLeitura).toBeNull();
    expect(leitura).toHaveLength(1);

    const { error } = await vend.client
      .from("cargos")
      .insert({ id: uniq("cg").slice(0, 40), nome: "Cargo Pirata" });
    expect(error, "vendedor conseguiu criar cargo").not.toBeNull();
  });

  it("vendedor não escreve escopo de ninguém em profile_areas", async () => {
    const vend = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-areas" });
    const { error } = await vend.client
      .from("profile_areas")
      .insert({ profile_id: vend.userId, area_chave: "mconf" });
    expect(error, "vendedor conseguiu se dar a área de Configurações").not.toBeNull();
  });
});
