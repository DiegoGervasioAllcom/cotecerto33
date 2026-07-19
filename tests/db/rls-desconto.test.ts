import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/**
 * G3.1 — RLS das tabelas base do fluxo de desconto adicional multinível.
 *
 * 20260718235007_g3_1_tabelas_desconto.sql cria 4 tabelas (schema apenas —
 * as RPCs de solicitar/aprovar/escalar são o PR2 G3.2):
 *
 * - desconto_politicas / respostas_padrao: SELECT liberado a authenticated,
 *   escrita só matriz (padrão comissao_regras/G4.1: grant amplo + policy
 *   matriz-only é a barreira).
 * - desconto_solicitacoes / desconto_trilha: SELECT restrito (solicitante,
 *   nivel_atual, matriz, ou rede visível do solicitante via
 *   empresas_visiveis()); insert/update fechados (sem policy) — só via RPC
 *   security definer do PR2.
 *
 * O caso crítico é o não-vazamento de inbox entre redes paralelas: um pedido
 * da rede A não pode ser lido por um usuário comum da rede B.
 */
describe("G3.1 — RLS desconto_politicas / desconto_solicitacoes / desconto_trilha / respostas_padrao", () => {
  let matriz: Db;
  let vendedor: Db;
  let seguradoraId: string;

  beforeAll(async () => {
    const m = await criarPersonaComEmpresa("matriz", { emailPrefix: "g31-matriz" });
    matriz = m.client;

    const v = await criarPersonaComEmpresa("vendedor", { emailPrefix: "g31-vendedor" });
    vendedor = v.client;

    const { data: segs } = await admin.from("seguradoras").select("id").limit(3);
    seguradoraId = segs![0].id;
  });

  describe("desconto_politicas", () => {
    it("authenticated (vendedor) lê", async () => {
      const { error } = await vendedor.from("desconto_politicas").select("*");
      expect(error).toBeNull();
    });

    it("vendedor NÃO escreve; matriz escreve", async () => {
      const { data: segs } = await admin.from("seguradoras").select("id").limit(3);
      const segVend = segs![1].id;
      const segMatriz = segs![2].id;

      // Suíte roda 2x seguidas sem truncates (padrão do repo) — limpa a linha
      // desta combinação (modelo, seguradora) se já existir de um run anterior.
      await admin
        .from("desconto_politicas")
        .delete()
        .eq("modelo", "master")
        .eq("seguradora_id", segMatriz);

      const { error: eVend } = await vendedor.from("desconto_politicas").insert({
        modelo: "master",
        seguradora_id: segVend,
        pct_maximo: 10,
      });
      expect(eVend).not.toBeNull();

      const { data, error: eMatriz } = await matriz
        .from("desconto_politicas")
        .insert({
          modelo: "master",
          seguradora_id: segMatriz,
          pct_maximo: 10,
        })
        .select("id")
        .single();
      expect(eMatriz).toBeNull();
      expect(data?.id).toBeTruthy();
    });

    it("check rejeita pct_maximo fora de 0-100", async () => {
      const { error } = await matriz.from("desconto_politicas").insert({
        modelo: "supervisor",
        seguradora_id: seguradoraId,
        pct_maximo: 150,
      });
      expect(error).not.toBeNull();
    });
  });

  describe("respostas_padrao", () => {
    it("authenticated (vendedor) lê; vendedor não escreve; matriz escreve", async () => {
      const { error: eSelect } = await vendedor.from("respostas_padrao").select("*");
      expect(eSelect).toBeNull();

      const { error: eVend } = await vendedor.from("respostas_padrao").insert({
        titulo: "hackeado",
        texto: "x",
      });
      expect(eVend).not.toBeNull();

      const { data, error: eMatriz } = await matriz
        .from("respostas_padrao")
        .insert({ titulo: "Resposta geral", texto: "Segue condição padrão." })
        .select("id")
        .single();
      expect(eMatriz).toBeNull();
      expect(data?.id).toBeTruthy();
    });
  });

  describe("desconto_solicitacoes / desconto_trilha — não-vazamento de inbox", () => {
    it("solicitante e nivel_atual veem; rede B não vê; matriz vê", async () => {
      // Rede A: master -> vendedor (superior_id), pedido do vendedor pendente no master.
      const masterA = await criarPersonaComEmpresa("master", { emailPrefix: "g31-masterA" });
      const empVendedorA = await criarEmpresa({
        nome: "G31 Vendedor A",
        parent_id: masterA.empresaId,
      });
      const vendedorA = await criarPersonaComEmpresa("vendedor", {
        empresaId: empVendedorA.id,
        emailPrefix: "g31-vendedorA",
        superiorId: masterA.userId,
      });

      const cotacao = await admin
        .from("cotacoes")
        .insert({ empresa_id: empVendedorA.id, responsavel_id: vendedorA.userId })
        .select("id")
        .single();
      expect(cotacao.error).toBeNull();

      const solicitacao = await admin
        .from("desconto_solicitacoes")
        .insert({
          cotacao_id: cotacao.data!.id,
          solicitante_id: vendedorA.userId,
          nivel_atual: masterA.userId,
          seguradora_id: seguradoraId,
          pct_pedido: 5,
        })
        .select("id")
        .single();
      expect(solicitacao.error).toBeNull();
      const solicitacaoId = solicitacao.data!.id;

      await admin.from("desconto_trilha").insert({
        solicitacao_id: solicitacaoId,
        autor_id: vendedorA.userId,
        acao: "solicitou",
        pct: 5,
      });

      // Rede B: usuário sem relação nenhuma com a rede A.
      const foraDaCadeia = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "g31-foraB",
      });

      // Solicitante vê.
      const bySolicitante = await vendedorA.client
        .from("desconto_solicitacoes")
        .select("id")
        .eq("id", solicitacaoId);
      expect(bySolicitante.error).toBeNull();
      expect(bySolicitante.data?.length).toBe(1);

      // nivel_atual (master) vê.
      const byNivelAtual = await masterA.client
        .from("desconto_solicitacoes")
        .select("id")
        .eq("id", solicitacaoId);
      expect(byNivelAtual.error).toBeNull();
      expect(byNivelAtual.data?.length).toBe(1);

      // Matriz vê.
      const byMatriz = await matriz
        .from("desconto_solicitacoes")
        .select("id")
        .eq("id", solicitacaoId);
      expect(byMatriz.error).toBeNull();
      expect(byMatriz.data?.length).toBe(1);

      // Rede B (fora da cadeia) NÃO vê.
      const byForaDaCadeia = await foraDaCadeia.client
        .from("desconto_solicitacoes")
        .select("id")
        .eq("id", solicitacaoId);
      expect(byForaDaCadeia.error).toBeNull();
      expect(byForaDaCadeia.data?.length).toBe(0);

      // Mesma regra vale para a trilha.
      const trilhaBySolicitante = await vendedorA.client
        .from("desconto_trilha")
        .select("id")
        .eq("solicitacao_id", solicitacaoId);
      expect(trilhaBySolicitante.error).toBeNull();
      expect(trilhaBySolicitante.data?.length).toBe(1);

      const trilhaByForaDaCadeia = await foraDaCadeia.client
        .from("desconto_trilha")
        .select("id")
        .eq("solicitacao_id", solicitacaoId);
      expect(trilhaByForaDaCadeia.error).toBeNull();
      expect(trilhaByForaDaCadeia.data?.length).toBe(0);
    });

    it("insert/update em desconto_solicitacoes fechado para authenticated (só RPC)", async () => {
      const { error } = await vendedor.from("desconto_solicitacoes").insert({
        cotacao_id: "00000000-0000-0000-0000-000000000000",
        solicitante_id: "00000000-0000-0000-0000-000000000000",
        seguradora_id: seguradoraId,
        pct_pedido: 5,
      });
      expect(error).not.toBeNull();
    });

    it("check rejeita pct_pedido fora de 0-100", async () => {
      const cotacaoAdmin = await admin.from("cotacoes").select("id, empresa_id").limit(1).single();
      expect(cotacaoAdmin.error).toBeNull();
      const { data: perfilAny } = await admin.from("profiles").select("id").limit(1).single();

      const { error } = await admin.from("desconto_solicitacoes").insert({
        cotacao_id: cotacaoAdmin.data!.id,
        solicitante_id: perfilAny!.id,
        seguradora_id: seguradoraId,
        pct_pedido: 200,
      });
      expect(error).not.toBeNull();
    });
  });
});
