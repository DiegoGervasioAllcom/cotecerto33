import { describe, it, expect } from "vitest";
import { loginMatriz, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

/**
 * Correção de inconsistência pré-existente (achada na revisão da G4.1):
 * `clt_config`, `modelos_franquia`, `seguradoras` e `configuracoes_gerais` tinham
 * policy de escrita matriz-only (`for all ... has_role(matriz)`) mas grant de tabela
 * só de `select` para `authenticated`. O grant barra ANTES da RLS, então as escritas
 * diretas do front (configuracoes.tsx / acessos.tsx) falhavam com `permission denied`
 * (42501) mesmo logado como matriz — reproduzido rodando este teste sem a migration.
 *
 * 20260717‥_g4_1_grants_escrita_tabelas_config.sql concede insert/update/delete para
 * `authenticated`; a RLS matriz-only continua sendo a barreira real (mesmo padrão de
 * mensagens_prontas/empresas).
 */
describe("RLS/grants — escrita nas tabelas de configuração (matriz sim, vendedor não)", () => {
  it("POSITIVO: matriz atualiza clt_config (singleton)", async () => {
    const matriz = await loginMatriz();
    const { data, error } = await matriz
      .from("clt_config")
      .update({ atualizado_em: new Date().toISOString() })
      .eq("id", "default")
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("POSITIVO: matriz atualiza configuracoes_gerais (singleton)", async () => {
    const matriz = await loginMatriz();
    const { data, error } = await matriz
      .from("configuracoes_gerais")
      .update({ atualizado_em: new Date().toISOString() })
      .eq("id", "default")
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("POSITIVO: matriz insere, atualiza e apaga em modelos_franquia", async () => {
    const matriz = await loginMatriz();
    const nome = uniq("Modelo G4");

    const ins = await matriz
      .from("modelos_franquia")
      .insert({ nome, tipo: "franqueada", perc_comissao_padrao: 50 })
      .select("id")
      .single();
    expect(ins.error).toBeNull();

    const upd = await matriz
      .from("modelos_franquia")
      .update({ descricao: "editado no teste" })
      .eq("id", ins.data!.id)
      .select("id");
    expect(upd.error).toBeNull();
    expect(upd.data).toHaveLength(1);

    const del = await matriz.from("modelos_franquia").delete().eq("id", ins.data!.id);
    expect(del.error).toBeNull();
  });

  it("POSITIVO: matriz insere, atualiza e apaga em seguradoras", async () => {
    const matriz = await loginMatriz();
    const nome = uniq("Seguradora G4");

    const ins = await matriz.from("seguradoras").insert({ nome }).select("id").single();
    expect(ins.error).toBeNull();

    const upd = await matriz
      .from("seguradoras")
      .update({ ativo: false })
      .eq("id", ins.data!.id)
      .select("id");
    expect(upd.error).toBeNull();
    expect(upd.data).toHaveLength(1);

    const del = await matriz.from("seguradoras").delete().eq("id", ins.data!.id);
    expect(del.error).toBeNull();
  });

  it("NEGATIVO: vendedor não insere em nenhuma das 4 tabelas (RLS barra)", async () => {
    const { client: vendedor } = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "g4-grants-vendedor",
    });

    const tentativas = [
      vendedor.from("clt_config").insert({ id: uniq("clt") }),
      vendedor
        .from("modelos_franquia")
        .insert({ nome: uniq("Modelo Hack"), tipo: "franqueada", perc_comissao_padrao: 10 }),
      vendedor.from("seguradoras").insert({ nome: uniq("Seguradora Hack") }),
      vendedor.from("configuracoes_gerais").insert({ id: uniq("conf") }),
    ] as const;

    for (const tentativa of tentativas) {
      const { error } = await tentativa;
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    }
  });

  it("NEGATIVO: update de vendedor não afeta nenhuma linha (RLS filtra)", async () => {
    const { client: vendedor } = await criarPersonaComEmpresa("vendedor", {
      emailPrefix: "g4-grants-vendedor-upd",
    });

    const cltUpd = await vendedor
      .from("clt_config")
      .update({ atualizado_em: new Date().toISOString() })
      .eq("id", "default")
      .select("id");
    expect(cltUpd.error).toBeNull();
    expect(cltUpd.data).toHaveLength(0);

    const confUpd = await vendedor
      .from("configuracoes_gerais")
      .update({ atualizado_em: new Date().toISOString() })
      .eq("id", "default")
      .select("id");
    expect(confUpd.error).toBeNull();
    expect(confUpd.data).toHaveLength(0);

    const modelosUpd = await vendedor
      .from("modelos_franquia")
      .update({ descricao: "hack" })
      .neq("descricao", "x")
      .select("id");
    expect(modelosUpd.error).toBeNull();
    expect(modelosUpd.data).toHaveLength(0);

    const segUpd = await vendedor
      .from("seguradoras")
      .update({ ativo: false })
      .eq("ativo", true)
      .select("id");
    expect(segUpd.error).toBeNull();
    expect(segUpd.data).toHaveLength(0);
  });
});
