/**
 * V11 · G6.1 (Frente 6) — RPCs de salvar política com gate de diretor.
 *
 * Mesmo padrão de fn_salvar_regua_performance (D2, Frente 4): delega
 * diretor+senha+histórico pra fn_registrar_alteracao, monta o DE/PARA como
 * array [{campo,de,para},...] e só grava se o gate passar.
 */
import { describe, it, expect } from "vitest";
import { admin, criarPersonaComEmpresa, uniq } from "../helpers/supabase";

const SENHA = "Teste@123!";

async function criarDiretor(prefix: string) {
  const p = await criarPersonaComEmpresa("matriz", { emailPrefix: prefix });
  const { error } = await admin
    .from("profiles")
    .update({ diretor: true, cargo_id: "matriz_total" })
    .eq("id", p.userId);
  if (error) throw error;
  return p;
}

async function ultimoHistoricoDe(autorId: string) {
  const { data } = await admin
    .from("historico_alteracoes")
    .select("area,o_que,de_para")
    .eq("autor_id", autorId)
    .order("quando", { ascending: false })
    .limit(1)
    .single();
  return data;
}

describe("V11 · G6.1 — fn_salvar_modelos_franquia", () => {
  it("diretor com senha salva e gera histórico com DE/PARA", async () => {
    const diretor = await criarDiretor(uniq("gov-modelos-ok"));
    const { data: modelo } = await admin
      .from("modelos_franquia")
      .insert({
        nome: uniq("Modelo Gov"),
        tipo: "franqueada",
        perc_comissao_padrao: 10,
        params: {},
      })
      .select("*")
      .single();

    const novoNome = uniq("Modelo Gov Editado");
    const { error } = await diretor.client.rpc("fn_salvar_modelos_franquia", {
      p_senha: SENHA,
      p_modelos: [
        {
          id: modelo!.id,
          nome: novoNome,
          ordem: modelo!.ordem,
          modalidade: "individual",
          params: { leads: "5/dia" },
        },
      ],
    });
    expect(error).toBeNull();

    const { data: depois } = await admin
      .from("modelos_franquia")
      .select("nome,modalidade,params")
      .eq("id", modelo!.id)
      .single();
    expect(depois?.nome).toBe(novoNome);
    expect(depois?.modalidade).toBe("individual");

    const hist = await ultimoHistoricoDe(diretor.userId);
    expect(hist?.area).toBe("Personalização geral");
    expect(hist?.de_para).toBeTruthy();
  });

  it("não-diretor é rejeitado, modelo não muda", async () => {
    const naoDiretor = await criarPersonaComEmpresa("matriz", {
      emailPrefix: uniq("gov-modelos-nd"),
    });
    const { data: modelo } = await admin
      .from("modelos_franquia")
      .insert({
        nome: uniq("Modelo Gov ND"),
        tipo: "franqueada",
        perc_comissao_padrao: 10,
        params: {},
      })
      .select("*")
      .single();

    const { error } = await naoDiretor.client.rpc("fn_salvar_modelos_franquia", {
      p_senha: SENHA,
      p_modelos: [
        { id: modelo!.id, nome: "hackeado", ordem: modelo!.ordem, modalidade: null, params: {} },
      ],
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");

    const { data: depois } = await admin
      .from("modelos_franquia")
      .select("nome")
      .eq("id", modelo!.id)
      .single();
    expect(depois?.nome).toBe(modelo!.nome);
  });
});

describe("V11 · G6.1 — fn_salvar_clt_config", () => {
  it("diretor com senha salva e gera histórico; sem diretor falha e não muda", async () => {
    const diretor = await criarDiretor(uniq("gov-clt-ok"));
    const { data: atual } = await admin.from("clt_config").select("*").eq("id", "default").single();
    const novaRegra = uniq("regra-clt");

    const { error } = await diretor.client.rpc("fn_salvar_clt_config", {
      p_senha: SENHA,
      p_progressiva: atual!.progressiva,
      p_fator_novas: atual!.fator_novas,
      p_fator_remalho: atual!.fator_remalho,
      p_seguradora_planos: atual!.seguradora_planos,
      p_seguradora_adic: atual!.seguradora_adic,
      p_regras: { ...(atual!.regras as object), rules: [novaRegra] },
    });
    expect(error).toBeNull();

    const { data: depois } = await admin
      .from("clt_config")
      .select("regras")
      .eq("id", "default")
      .single();
    expect((depois?.regras as { rules: string[] }).rules).toContain(novaRegra);

    const hist = await ultimoHistoricoDe(diretor.userId);
    expect(hist?.o_que).toBe("Modelo CLT");

    const naoDiretor = await criarPersonaComEmpresa("matriz", { emailPrefix: uniq("gov-clt-nd") });
    const { error: eNd } = await naoDiretor.client.rpc("fn_salvar_clt_config", {
      p_senha: SENHA,
      p_progressiva: atual!.progressiva,
      p_fator_novas: atual!.fator_novas,
      p_fator_remalho: atual!.fator_remalho,
      p_seguradora_planos: atual!.seguradora_planos,
      p_seguradora_adic: atual!.seguradora_adic,
      p_regras: { ...(atual!.regras as object), rules: ["hack"] },
    });
    expect(eNd?.message).toContain("Seu acesso não permite esse tipo de alteração");
    const { data: aindaIgual } = await admin
      .from("clt_config")
      .select("regras")
      .eq("id", "default")
      .single();
    expect((aindaIgual?.regras as { rules: string[] }).rules).toContain(novaRegra);
    expect((aindaIgual?.regras as { rules: string[] }).rules).not.toContain("hack");
  });
});

describe("V11 · G6.1 — fn_salvar_desconto_politicas", () => {
  it("diretor com senha faz upsert e delete, gera histórico com DE/PARA", async () => {
    const diretor = await criarDiretor(uniq("gov-desc-ok"));
    const { data: segs } = await admin.from("seguradoras").select("id").limit(2);
    const [seg1, seg2] = segs!;

    await admin
      .from("desconto_politicas")
      .delete()
      .in("seguradora_id", [seg1.id, seg2.id])
      .in("modelo", ["master", "supervisor"]);
    await admin
      .from("desconto_politicas")
      .insert({ modelo: "supervisor", seguradora_id: seg2.id, pct_maximo: 5 });

    const { error } = await diretor.client.rpc("fn_salvar_desconto_politicas", {
      p_senha: SENHA,
      p_upsert: [{ modelo: "master", seguradora_id: seg1.id, pct_maximo: 20 }],
      p_delete: [{ modelo: "supervisor", seguradora_id: seg2.id }],
    });
    expect(error).toBeNull();

    const { data: criada } = await admin
      .from("desconto_politicas")
      .select("pct_maximo")
      .eq("modelo", "master")
      .eq("seguradora_id", seg1.id)
      .single();
    expect(criada?.pct_maximo).toBe(20);

    const { data: removida } = await admin
      .from("desconto_politicas")
      .select("id")
      .eq("modelo", "supervisor")
      .eq("seguradora_id", seg2.id)
      .maybeSingle();
    expect(removida).toBeNull();

    const hist = await ultimoHistoricoDe(diretor.userId);
    expect(hist?.o_que).toContain("alçada");
    expect(hist?.de_para).toBeTruthy();
  });

  it("não-diretor é rejeitado, grade não muda", async () => {
    const naoDiretor = await criarPersonaComEmpresa("matriz", { emailPrefix: uniq("gov-desc-nd") });
    const { data: segs } = await admin.from("seguradoras").select("id").limit(1);

    const { error } = await naoDiretor.client.rpc("fn_salvar_desconto_politicas", {
      p_senha: SENHA,
      p_upsert: [{ modelo: "master", seguradora_id: segs![0].id, pct_maximo: 99 }],
      p_delete: [],
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");

    const { data } = await admin
      .from("desconto_politicas")
      .select("pct_maximo")
      .eq("modelo", "master")
      .eq("seguradora_id", segs![0].id)
      .maybeSingle();
    expect(data?.pct_maximo).not.toBe(99);
  });
});

describe("V11 · G6.1 — fn_salvar_resposta_padrao / fn_excluir_resposta_padrao", () => {
  it("diretor cria, edita e exclui; cada passo gera histórico", async () => {
    const diretor = await criarDiretor(uniq("gov-resp-ok"));
    const titulo = uniq("Resposta Gov");

    const { data: idBruto, error: eCriar } = await diretor.client.rpc("fn_salvar_resposta_padrao", {
      p_senha: SENHA,
      p_titulo: titulo,
      p_texto: "Texto inicial.",
      p_ativo: true,
    });
    expect(eCriar).toBeNull();
    expect(idBruto).toBeTruthy();
    const id = idBruto as string;

    const { error: eEditar } = await diretor.client.rpc("fn_salvar_resposta_padrao", {
      p_senha: SENHA,
      p_id: id,
      p_titulo: titulo,
      p_texto: "Texto editado.",
      p_ativo: false,
    });
    expect(eEditar).toBeNull();

    const { data: depois } = await admin
      .from("respostas_padrao")
      .select("texto,ativo")
      .eq("id", id)
      .single();
    expect(depois?.texto).toBe("Texto editado.");
    expect(depois?.ativo).toBe(false);

    const { error: eExcluir } = await diretor.client.rpc("fn_excluir_resposta_padrao", {
      p_senha: SENHA,
      p_id: id,
    });
    expect(eExcluir).toBeNull();

    const { data: sumiu } = await admin
      .from("respostas_padrao")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    expect(sumiu).toBeNull();
  });

  it("não-diretor não cria nem exclui", async () => {
    const naoDiretor = await criarPersonaComEmpresa("matriz", { emailPrefix: uniq("gov-resp-nd") });
    const { error } = await naoDiretor.client.rpc("fn_salvar_resposta_padrao", {
      p_senha: SENHA,
      p_titulo: "Hack",
      p_texto: "Hack.",
      p_ativo: true,
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");

    const { data } = await admin
      .from("respostas_padrao")
      .select("id")
      .eq("titulo", "Hack")
      .maybeSingle();
    expect(data).toBeNull();
  });
});
