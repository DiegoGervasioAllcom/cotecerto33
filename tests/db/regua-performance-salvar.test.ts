/**
 * V11 · D2 (Frente 4) — salvar a régua de performance, com gate de diretor.
 *
 * `fn_salvar_regua_performance` delega o gate pra `fn_registrar_alteracao`
 * (V11.0.5/V11.0.6) — não reimplementa nada de diretor/senha/histórico, só
 * confere a regra própria da régua (travado não pode ser "melhor" que atenção)
 * e aplica o UPDATE depois que o gate passar.
 */
import { describe, it, expect } from "vitest";
import { admin, criarPersonaComEmpresa, uniq } from "../helpers/supabase";

const SENHA = "Teste@123!"; // default de criarUsuario

async function criarDiretor(prefix: string) {
  const p = await criarPersonaComEmpresa("matriz", { emailPrefix: prefix });
  const { error } = await admin
    .from("profiles")
    .update({ diretor: true, cargo_id: "matriz_total" })
    .eq("id", p.userId);
  if (error) throw error;
  return p;
}

const PARAMS_VALIDOS = {
  p_janela_dias: 30,
  p_conv_atencao_pct: 25,
  p_conv_travado_pct: 15,
  p_dias_atencao: 10,
  p_dias_travado: 15,
  p_cancelamentos_limite: 3,
  p_pausa_leads_ativa: true,
  p_notifica_supervisor: true,
};

describe("V11 · D2 — fn_salvar_regua_performance", () => {
  it("diretor com senha salva a régua e gera histórico com DE/PARA", async () => {
    const diretor = await criarDiretor(uniq("regua-ok"));
    // Lê o valor atual e usa algo garantidamente diferente — a régua é uma
    // linha global compartilhada entre execuções da suíte (sem truncate),
    // então um valor fixo pode coincidir com o que ficou de uma run anterior.
    const { data: atual } = await admin
      .from("regua_performance_config")
      .select("cancelamentos_limite")
      .eq("bloco", "interno")
      .single();
    const novoLimite = (atual?.cancelamentos_limite ?? 0) + 1;

    const { error } = await diretor.client.rpc("fn_salvar_regua_performance", {
      p_bloco: "interno",
      p_senha: SENHA,
      ...PARAMS_VALIDOS,
      p_cancelamentos_limite: novoLimite,
    });
    expect(error).toBeNull();

    const { data: regua } = await admin
      .from("regua_performance_config")
      .select("cancelamentos_limite,atualizado_por")
      .eq("bloco", "interno")
      .single();
    expect(regua?.cancelamentos_limite).toBe(novoLimite);
    expect(regua?.atualizado_por).toBe(diretor.userId);

    const { data: hist } = await admin
      .from("historico_alteracoes")
      .select("area,o_que,de_para")
      .eq("autor_id", diretor.userId)
      .single();
    expect(hist?.area).toBe("Performance");
    expect(hist?.o_que).toContain("interno");
    expect(hist?.de_para).toBeTruthy();
  });

  it("salva o bloco full também com gate de diretor — diverge do protótipo", async () => {
    const diretor = await criarDiretor(uniq("regua-full"));

    const { error } = await diretor.client.rpc("fn_salvar_regua_performance", {
      p_bloco: "full",
      p_senha: SENHA,
      ...PARAMS_VALIDOS,
    });
    expect(error).toBeNull();
  });

  it("não-diretor é rejeitado, régua não muda", async () => {
    const naoDiretor = await criarPersonaComEmpresa("matriz", {
      emailPrefix: uniq("regua-nao-dir"),
    });
    const { data: antes } = await admin
      .from("regua_performance_config")
      .select("cancelamentos_limite")
      .eq("bloco", "rede")
      .single();

    const { error } = await naoDiretor.client.rpc("fn_salvar_regua_performance", {
      p_bloco: "rede",
      p_senha: SENHA,
      ...PARAMS_VALIDOS,
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");

    const { data: depois } = await admin
      .from("regua_performance_config")
      .select("cancelamentos_limite")
      .eq("bloco", "rede")
      .single();
    expect(depois?.cancelamentos_limite).toBe(antes?.cancelamentos_limite);
  });

  it("senha errada é rejeitada", async () => {
    const diretor = await criarDiretor(uniq("regua-senha-errada"));
    const { error } = await diretor.client.rpc("fn_salvar_regua_performance", {
      p_bloco: "interno",
      p_senha: "senha-errada",
      ...PARAMS_VALIDOS,
    });
    expect(error).not.toBeNull();
  });

  it("rejeita conversão de travado maior que a de atenção, com mensagem amigável", async () => {
    const diretor = await criarDiretor(uniq("regua-conv-invalida"));
    const { error } = await diretor.client.rpc("fn_salvar_regua_performance", {
      p_bloco: "interno",
      p_senha: SENHA,
      ...PARAMS_VALIDOS,
      p_conv_atencao_pct: 10,
      p_conv_travado_pct: 20,
    });
    expect(error?.message).toContain("não pode ser maior");
  });

  it("rejeita dias_travado menor que dias_atencao, com mensagem amigável", async () => {
    const diretor = await criarDiretor(uniq("regua-dias-invalidos"));
    const { error } = await diretor.client.rpc("fn_salvar_regua_performance", {
      p_bloco: "interno",
      p_senha: SENHA,
      ...PARAMS_VALIDOS,
      p_dias_atencao: 20,
      p_dias_travado: 10,
    });
    expect(error?.message).toContain("não podem ser menores");
  });

  it("rejeita bloco inválido", async () => {
    const diretor = await criarDiretor(uniq("regua-bloco-invalido"));
    const { error } = await diretor.client.rpc("fn_salvar_regua_performance", {
      p_bloco: "xxx",
      p_senha: SENHA,
      ...PARAMS_VALIDOS,
    });
    expect(error?.message).toContain("Bloco inválido");
  });
});
