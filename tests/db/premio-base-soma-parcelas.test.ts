import { describe, it, expect } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, uniq } from "../helpers/supabase";

/**
 * Ajustes pós-deploy V12, item 2 (banco): a base de comissão/desconto
 * (`propostas.premio`) não pode mais virar o valor de UMA parcela quando o
 * card da Quiver só oferece parcelamento (sem "avista"). Decisão do usuário:
 * base = nº de parcelas × valor da parcela; com preço à vista, continua
 * sendo o à vista (ver 20260928090000_premio_base_soma_parcelas.sql).
 */
describe("fn_premio_total_de_parcelas — extração pura de texto de parcelamento", () => {
  it("extrai quantidade e valor de 'em Nx de R$ X,XX'", async () => {
    const { data, error } = await admin.rpc("fn_premio_total_de_parcelas", {
      p_texto: "em 12x de R$ 463,20",
    } as never);
    if (error) throw error;
    expect(data).toEqual([{ parcelas_num: 12, valor_parcela: 463.2, premio_total: 5558.4 }]);
  });

  it("extrai quantidade e valor de 'Nx sem juros de R$ X,XX'", async () => {
    const { data, error } = await admin.rpc("fn_premio_total_de_parcelas", {
      p_texto: "3x sem juros de R$ 429,25",
    } as never);
    if (error) throw error;
    expect(data).toEqual([{ parcelas_num: 3, valor_parcela: 429.25, premio_total: 1287.75 }]);
  });

  it("sem quantidade de parcelas identificável não retorna linha (conservador)", async () => {
    const { data, error } = await admin.rpc("fn_premio_total_de_parcelas", {
      p_texto: "sem juros de R$ 429,25",
    } as never);
    if (error) throw error;
    expect(data).toEqual([]);
  });

  it("quantidade fora de 1-12 não retorna linha", async () => {
    const { data, error } = await admin.rpc("fn_premio_total_de_parcelas", {
      p_texto: "13x de R$ 100,00",
    } as never);
    if (error) throw error;
    expect(data).toEqual([]);
  });

  it("texto vazio/nulo não retorna linha", async () => {
    const { data, error } = await admin.rpc("fn_premio_total_de_parcelas", {
      p_texto: "",
    } as never);
    if (error) throw error;
    expect(data).toEqual([]);
  });
});

describe("registrar_premios_quiver — base de comissão é a soma das parcelas", () => {
  async function criarCotacao() {
    const emp = await criarEmpresa({ nome: uniq("Empresa Premio Parcelado") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: emp.id });
    const { data: cot, error } = await admin
      .from("cotacoes")
      .insert({ empresa_id: emp.id, responsavel_id: vendedor.userId, status: "enviada_quiver" })
      .select("id")
      .single();
    if (error) throw error;
    return cot.id as string;
  }

  it("card só-parcelado: cotacao_premios.premio = nº de parcelas × valor da parcela", async () => {
    const cotacaoId = await criarCotacao();
    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: cotacaoId,
      p_payload: {
        temPremios: true,
        cards: [
          {
            seguradora: "Suhai",
            opcoes: [{ tipo: "Roubo e Furto c/ Assistência", parcelas: "em 12x de R$ 463,20" }],
          },
        ],
      } as never,
    });
    expect(error).toBeNull();

    const { data: premios } = await admin
      .from("cotacao_premios")
      .select("seguradora,cobertura,premio")
      .eq("cotacao_id", cotacaoId);
    expect(premios).toHaveLength(1);
    expect(premios?.[0].seguradora).toBe("Suhai");
    expect(Number(premios?.[0].premio)).toBe(5558.4);
  });

  it("com avista presente, continua usando o à vista (parcelas ignorado)", async () => {
    const cotacaoId = await criarCotacao();
    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: cotacaoId,
      p_payload: {
        temPremios: true,
        cards: [
          {
            seguradora: "Porto",
            opcoes: [{ tipo: "Compreensiva", avista: "1.234,56", parcelas: "em 12x de R$ 463,20" }],
          },
        ],
      } as never,
    });
    expect(error).toBeNull();

    const { data: premios } = await admin
      .from("cotacao_premios")
      .select("premio")
      .eq("cotacao_id", cotacaoId);
    expect(Number(premios?.[0].premio)).toBe(1234.56);
  });

  it("texto de parcelas sem quantidade segura: card fica sem prêmio (não grava valor incompleto)", async () => {
    const cotacaoId = await criarCotacao();
    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: cotacaoId,
      p_payload: {
        temPremios: true,
        cards: [
          {
            seguradora: "Suhai",
            opcoes: [{ tipo: "Roubo e Furto", parcelas: "sem juros de R$ 429,25" }],
          },
        ],
      } as never,
    });
    expect(error).toBeNull();

    const { count } = await admin
      .from("cotacao_premios")
      .select("id", { count: "exact", head: true })
      .eq("cotacao_id", cotacaoId);
    expect(count).toBe(0);

    const { data: cot } = await admin
      .from("cotacoes")
      .select("status,quiver_mensagem")
      .eq("id", cotacaoId)
      .single();
    expect(cot?.status).toBe("erro_quiver");
  });
});

describe("registrar_resultado_transmissao_quiver — propaga parcelas_num/valor_parcela", () => {
  it("preenche propostas.parcelas/valor_parcela a partir da tentativa", async () => {
    const emp = await criarEmpresa({ nome: uniq("Empresa Transmissao Parcelada") });
    const vendedor = await criarPersonaComEmpresa("vendedor", { empresaId: emp.id });
    const { data: cot, error: eCot } = await admin
      .from("cotacoes")
      .insert({ empresa_id: emp.id, responsavel_id: vendedor.userId })
      .select("id")
      .single();
    if (eCot) throw eCot;

    const { data: tent, error: eTent } = await admin
      .from("cotacao_transmissoes")
      .insert({
        cotacao_id: cot.id,
        seguradora: "Suhai",
        forma_pagamento: "boleto",
        premio: 5558.4,
        parcelas_num: 12,
        valor_parcela: 463.2,
      })
      .select("id")
      .single();
    if (eTent) throw eTent;

    const { error } = await admin.rpc("registrar_resultado_transmissao_quiver", {
      p_tentativa_id: tent.id,
      p_transmitido: true,
    });
    expect(error).toBeNull();

    const { data: prop } = await admin
      .from("propostas")
      .select("premio,parcelas,valor_parcela")
      .eq("cotacao_id", cot.id)
      .single();
    expect(Number(prop?.premio)).toBe(5558.4);
    expect(prop?.parcelas).toBe(12);
    expect(Number(prop?.valor_parcela)).toBe(463.2);
  });
});
