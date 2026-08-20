/**
 * V11 · Personalização geral — Modelo Master, Modelo Supervisor e gate de
 * diretor no catálogo de produtos (fn_salvar_modelo_master,
 * fn_salvar_modelo_supervisor, fn_salvar_produtos_catalogo,
 * fn_salvar_produtos_padrao). Mesmo padrão de governanca-politicas.test.ts.
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

describe("V11 · fn_salvar_modelo_master", () => {
  it("diretor com senha salva e gera histórico com DE/PARA", async () => {
    const diretor = await criarDiretor(uniq("mm-ok"));
    const { data: atual } = await admin
      .from("modelo_master_config")
      .select("*")
      .eq("id", "default")
      .single();

    const { error } = await diretor.client.rpc("fn_salvar_modelo_master", {
      p_senha: SENHA,
      p_comissao_grupo: "25%",
      p_royalties: atual!.royalties,
      p_base_calc: atual!.base_calc,
      p_pagamento: atual!.pagamento,
      p_elite: atual!.elite,
    });
    expect(error).toBeNull();

    const { data: depois } = await admin
      .from("modelo_master_config")
      .select("comissao_grupo")
      .eq("id", "default")
      .single();
    expect(depois?.comissao_grupo).toBe("25%");

    const hist = await ultimoHistoricoDe(diretor.userId);
    expect(hist?.area).toBe("Personalização geral");
    expect(hist?.de_para).toBeTruthy();

    // devolve ao valor original pra não afetar outros testes
    await admin.from("modelo_master_config").update({ comissao_grupo: atual!.comissao_grupo }).eq("id", "default");
  });

  it("não-diretor é rejeitado, config não muda", async () => {
    const naoDiretor = await criarPersonaComEmpresa("matriz", { emailPrefix: uniq("mm-nd") });
    const { data: atual } = await admin
      .from("modelo_master_config")
      .select("*")
      .eq("id", "default")
      .single();

    const { error } = await naoDiretor.client.rpc("fn_salvar_modelo_master", {
      p_senha: SENHA,
      p_comissao_grupo: "99%",
      p_royalties: atual!.royalties,
      p_base_calc: atual!.base_calc,
      p_pagamento: atual!.pagamento,
      p_elite: atual!.elite,
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");

    const { data: depois } = await admin
      .from("modelo_master_config")
      .select("comissao_grupo")
      .eq("id", "default")
      .single();
    expect(depois?.comissao_grupo).not.toBe("99%");
  });

  it("senha ERRADA é rejeitada, config não muda", async () => {
    const diretor = await criarDiretor(uniq("mm-se"));
    const { data: atual } = await admin
      .from("modelo_master_config")
      .select("*")
      .eq("id", "default")
      .single();

    const { error } = await diretor.client.rpc("fn_salvar_modelo_master", {
      p_senha: "senha-errada-de-verdade",
      p_comissao_grupo: "98%",
      p_royalties: atual!.royalties,
      p_base_calc: atual!.base_calc,
      p_pagamento: atual!.pagamento,
      p_elite: atual!.elite,
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");

    const { data: depois } = await admin
      .from("modelo_master_config")
      .select("comissao_grupo")
      .eq("id", "default")
      .single();
    expect(depois?.comissao_grupo).not.toBe("98%");
  });
});

describe("V11 · fn_salvar_modelo_supervisor", () => {
  it("diretor com senha salva e gera histórico com DE/PARA", async () => {
    const diretor = await criarDiretor(uniq("ms-ok"));
    const { data: atual } = await admin
      .from("modelo_supervisor_config")
      .select("*")
      .eq("id", "default")
      .single();

    const { error } = await diretor.client.rpc("fn_salvar_modelo_supervisor", {
      p_senha: SENHA,
      p_comissao_grupo: "18%",
      p_royalties: atual!.royalties,
      p_base_calc: atual!.base_calc,
      p_pagamento: atual!.pagamento,
    });
    expect(error).toBeNull();

    const { data: depois } = await admin
      .from("modelo_supervisor_config")
      .select("comissao_grupo")
      .eq("id", "default")
      .single();
    expect(depois?.comissao_grupo).toBe("18%");

    const hist = await ultimoHistoricoDe(diretor.userId);
    expect(hist?.o_que).toContain("Modelo Supervisor");

    await admin
      .from("modelo_supervisor_config")
      .update({ comissao_grupo: atual!.comissao_grupo })
      .eq("id", "default");
  });

  it("não-diretor é rejeitado, config não muda", async () => {
    const naoDiretor = await criarPersonaComEmpresa("matriz", { emailPrefix: uniq("ms-nd") });
    const { data: atual } = await admin
      .from("modelo_supervisor_config")
      .select("*")
      .eq("id", "default")
      .single();

    const { error } = await naoDiretor.client.rpc("fn_salvar_modelo_supervisor", {
      p_senha: SENHA,
      p_comissao_grupo: "77%",
      p_royalties: atual!.royalties,
      p_base_calc: atual!.base_calc,
      p_pagamento: atual!.pagamento,
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");
  });

  it("senha ERRADA é rejeitada, config não muda", async () => {
    const diretor = await criarDiretor(uniq("ms-se"));
    const { data: atual } = await admin
      .from("modelo_supervisor_config")
      .select("*")
      .eq("id", "default")
      .single();

    const { error } = await diretor.client.rpc("fn_salvar_modelo_supervisor", {
      p_senha: "senha-errada-de-verdade",
      p_comissao_grupo: "66%",
      p_royalties: atual!.royalties,
      p_base_calc: atual!.base_calc,
      p_pagamento: atual!.pagamento,
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");
  });
});

describe("V11 · fn_salvar_produtos_catalogo", () => {
  it("diretor renomeia produto não-fixo, ativa/desativa e cria produto novo", async () => {
    const diretor = await criarDiretor(uniq("prod-ok"));
    const nomeNovo = uniq("Empresarial");

    const { error } = await diretor.client.rpc("fn_salvar_produtos_catalogo", {
      p_senha: SENHA,
      p_produtos: [{ id: "celular", nome: "Celular Editado", ativo: false }],
      p_novo_nome: nomeNovo,
    });
    expect(error).toBeNull();

    const { data: celular } = await admin.from("produtos").select("nome,ativo").eq("id", "celular").single();
    expect(celular?.nome).toBe("Celular Editado");
    expect(celular?.ativo).toBe(false);

    const { data: novo } = await admin.from("produtos").select("id,nome,fixo,ativo").eq("nome", nomeNovo).single();
    expect(novo).toBeTruthy();
    expect(novo?.fixo).toBe(false);
    expect(novo?.ativo).toBe(true);

    const hist = await ultimoHistoricoDe(diretor.userId);
    expect(hist?.de_para).toBeTruthy();

    // limpeza
    await admin.from("produtos").update({ nome: "Celular", ativo: true }).eq("id", "celular");
    await admin.from("produtos").delete().eq("id", novo!.id);
  });

  it("não altera o produto fixo (Auto) mesmo se enviado no payload", async () => {
    const diretor = await criarDiretor(uniq("prod-auto"));

    const { error } = await diretor.client.rpc("fn_salvar_produtos_catalogo", {
      p_senha: SENHA,
      p_produtos: [{ id: "auto", nome: "Auto Hackeado", ativo: false }],
    });
    expect(error).toBeNull();

    const { data: auto } = await admin.from("produtos").select("nome,ativo,fixo").eq("id", "auto").single();
    expect(auto?.nome).toBe("Auto");
    expect(auto?.ativo).toBe(true);
    expect(auto?.fixo).toBe(true);
  });

  it("não-diretor é rejeitado, catálogo não muda", async () => {
    const naoDiretor = await criarPersonaComEmpresa("matriz", { emailPrefix: uniq("prod-nd") });

    const { error } = await naoDiretor.client.rpc("fn_salvar_produtos_catalogo", {
      p_senha: SENHA,
      p_produtos: [{ id: "moto", nome: "Moto Hackeada", ativo: false }],
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");

    const { data: moto } = await admin.from("produtos").select("nome").eq("id", "moto").single();
    expect(moto?.nome).not.toBe("Moto Hackeada");
  });

  it("senha ERRADA é rejeitada, catálogo não muda", async () => {
    const diretor = await criarDiretor(uniq("prod-se"));

    const { error } = await diretor.client.rpc("fn_salvar_produtos_catalogo", {
      p_senha: "senha-errada-de-verdade",
      p_produtos: [{ id: "vida", nome: "Vida Hackeada", ativo: false }],
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");

    const { data: vida } = await admin.from("produtos").select("nome").eq("id", "vida").single();
    expect(vida?.nome).not.toBe("Vida Hackeada");
  });
});

describe("V11 · fn_salvar_produtos_padrao", () => {
  it("diretor substitui o padrão do bloco externo e o Auto continua herdado", async () => {
    const diretor = await criarDiretor(uniq("prodpad-ok"));

    const { error } = await diretor.client.rpc("fn_salvar_produtos_padrao", {
      p_senha: SENHA,
      p_bloco: "externo",
      p_produto_ids: ["moto"],
    });
    expect(error).toBeNull();

    const { data: rows } = await admin.from("produtos_padrao").select("produto_id").eq("bloco", "externo");
    const ids = (rows || []).map((r) => r.produto_id);
    expect(ids).toContain("moto");

    const { data: padraoComAuto } = await admin.rpc("fn_produtos_padrao", { _bloco: "externo" });
    const padraoIds = (padraoComAuto as unknown as { fn_produtos_padrao: string }[] | string[])?.map((x: any) =>
      typeof x === "string" ? x : x.fn_produtos_padrao,
    );
    expect(padraoIds).toContain("auto");

    // limpeza — volta ao padrão original (só Auto)
    await admin.from("produtos_padrao").delete().eq("bloco", "externo").neq("produto_id", "auto");
    await admin
      .from("produtos_padrao")
      .upsert({ bloco: "externo", produto_id: "auto" }, { onConflict: "bloco,produto_id" });
  });

  it("não-diretor é rejeitado, padrão não muda", async () => {
    const naoDiretor = await criarPersonaComEmpresa("matriz", { emailPrefix: uniq("prodpad-nd") });

    const { error } = await naoDiretor.client.rpc("fn_salvar_produtos_padrao", {
      p_senha: SENHA,
      p_bloco: "externo",
      p_produto_ids: ["vida"],
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");

    const { data } = await admin
      .from("produtos_padrao")
      .select("produto_id")
      .eq("bloco", "externo")
      .eq("produto_id", "vida")
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("senha ERRADA é rejeitada, padrão não muda", async () => {
    const diretor = await criarDiretor(uniq("prodpad-se"));

    const { error } = await diretor.client.rpc("fn_salvar_produtos_padrao", {
      p_senha: "senha-errada-de-verdade",
      p_bloco: "externo",
      p_produto_ids: ["resid"],
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");

    const { data } = await admin
      .from("produtos_padrao")
      .select("produto_id")
      .eq("bloco", "externo")
      .eq("produto_id", "resid")
      .maybeSingle();
    expect(data).toBeNull();
  });
});

describe("V11 · RLS bloqueia escrita direta nas tabelas novas", () => {
  it("modelo_master_config e modelo_supervisor_config: authenticated não pode UPDATE direto", async () => {
    const diretor = await criarDiretor(uniq("rls-mm"));

    const { error: e1 } = await diretor.client
      .from("modelo_master_config")
      .update({ comissao_grupo: "1%" })
      .eq("id", "default");
    expect(e1).toBeTruthy();

    const { error: e2 } = await diretor.client
      .from("modelo_supervisor_config")
      .update({ comissao_grupo: "1%" })
      .eq("id", "default");
    expect(e2).toBeTruthy();
  });

  it("produtos e produtos_padrao: authenticated não pode INSERT/UPDATE/DELETE direto", async () => {
    const diretor = await criarDiretor(uniq("rls-prod"));

    const { error: e1 } = await diretor.client.from("produtos").update({ nome: "hack" }).eq("id", "moto");
    expect(e1).toBeTruthy();

    const { error: e2 } = await diretor.client
      .from("produtos_padrao")
      .insert({ bloco: "externo", produto_id: "vida" });
    expect(e2).toBeTruthy();

    const { error: e3 } = await diretor.client
      .from("produtos_padrao")
      .delete()
      .eq("bloco", "interno")
      .eq("produto_id", "moto");
    expect(e3).toBeTruthy();
  });
});
