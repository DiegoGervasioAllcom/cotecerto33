import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { admin, loginMatriz, uniq, type Db } from "../helpers/supabase";
import { veiculoLabel } from "@/lib/veiculo";

/**
 * Regressão: a query de "leads em avaliação da Matriz" (tela de distribuição) selecionava
 * `dados_veiculo`, coluna inexistente na tabela `leads` (o schema real tem `dados: Json`).
 * No PostgREST, selecionar coluna inexistente faz a query INTEIRA falhar — a lista ficava
 * sempre vazia em produção, sem nenhum erro visível na tela (o `.data` some, o `error` é
 * ignorado). Este teste roda EXATAMENTE o mesmo select da tela e trava contra a coluna
 * fantasma voltar (o guard crítico é `error` ser `null`).
 */
describe("query de leads em avaliação da matriz (distribuição)", () => {
  let matriz: Db;
  let leadId: string;
  const veiculoInserido = {
    veiculo: { marca_nome: "FIAT", modelo_nome: "UNO", ano_modelo: "2020" },
  };

  beforeAll(async () => {
    matriz = await loginMatriz();

    // Fixture via admin: lead já triado para avaliação da matriz, com veículo em `dados`.
    const { data: lead, error } = await admin
      .from("leads")
      .insert({
        nome: uniq("Lead avaliacao veiculo"),
        origem: "teste",
        em_avaliacao_matriz: true,
        dados: veiculoInserido,
      })
      .select("id")
      .single();
    if (error) throw error;
    leadId = lead.id;
  });

  afterAll(async () => {
    if (leadId) await admin.from("leads").delete().eq("id", leadId);
  });

  it("select da tela não falha (coluna `dados` existe) e devolve o lead com veículo legível", async () => {
    // Mesmas colunas e filtro usados em src/routes/_authenticated/comando/distribuicao.tsx
    const { data, error } = await matriz
      .from("leads")
      .select(
        "id,nome,motivo_perda,submotivo_perda,destino_perda_sugerido,observacao_perda,dados,responsavel_id,empresa_id,atualizado_em",
      )
      .eq("em_avaliacao_matriz", true)
      .order("atualizado_em", { ascending: false })
      .limit(200);

    // Guard crítico contra a regressão: coluna inexistente (`dados_veiculo`) fazia a query
    // inteira falhar e `error` vinha preenchido — a lista aparecia vazia sem sinalizar o motivo.
    expect(error).toBeNull();
    expect(data).not.toBeNull();

    const row = (data ?? []).find((x) => x.id === leadId);
    expect(row).toBeTruthy();
    expect(veiculoLabel(row!.dados as Record<string, unknown> | null)).toBe("FIAT UNO 2020");
  });
});
