/**
 * V11 · G6.3 (Frente 6) — dupla aprovação para incluir/remover diretor.
 *
 * `diretor_propostas` + `propor_alteracao_diretor`/`confirmar_alteracao_diretor`
 * (V11.6.4 no banco). Mesmo padrão de senha+diretor das outras RPCs de
 * governança (G6.1/V11.0.5): quem propõe e quem confirma precisam ser
 * diretores diferentes, cada um confirmando a própria senha de login.
 *
 * O teste NÃO assume quantos diretores já existem no banco compartilhado
 * (worktrees/execuções paralelas podem deixar resíduo — ver nota de memória
 * "Supabase local compartilhado entre worktrees"): `garantirDoisDiretores()`
 * reduz o total global para exatamente 2 (mesma técnica, um a um, de
 * `rls-governanca-v11.test.ts`) antes de qualquer asserção sobre a trava do
 * mínimo, e usa esses 2 como base para os cenários de propor/confirmar.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { admin, anonClient, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

const SENHA = "Teste@123!"; // default de criarUsuario/criarPersonaComEmpresa

async function loginComoProfile(id: string): Promise<Db> {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data.user?.email) {
    throw new Error(`getUserById ${id}: ${error?.message ?? "sem email"}`);
  }
  const client = anonClient();
  const { error: eLogin } = await client.auth.signInWithPassword({
    email: data.user.email,
    password: SENHA,
  });
  if (eLogin) throw new Error(`login ${data.user.email}: ${eLogin.message}`);
  return client;
}

/** Cria uma pessoa da Matriz com a marcação de diretor (fixture direta, sem RPC). */
async function criarDiretor(prefix: string) {
  const p = await criarPersonaComEmpresa("matriz", { emailPrefix: prefix });
  const { error } = await admin.from("profiles").update({ diretor: true }).eq("id", p.userId);
  if (error) throw error;
  return p;
}

/**
 * Garante 2 diretores com senha CONHECIDA pelo teste (`criarDiretor`, senha
 * padrão de fixture) e reduz o resto do total global a zero.
 *
 * Cria os 2 novos ANTES de demover qualquer diretor pré-existente — assim o
 * total nunca passa pelo mínimo de 2 nesse meio-tempo, e a trava do V11.0.5
 * nunca bloqueia a demoção dos antigos (o pool só cresce até demover, depois
 * encolhe de uma vez). Isso importa desde que `supabase/seed.sql` (regra 2
 * das Regras Decididas) passou a criar 2 diretores reais (Ana/Melo) com senha
 * própria (`Supper@123!`) — a versão antiga desta function tentava logar com
 * a senha genérica de fixture em QUALQUER diretor pré-existente, o que quebra
 * contra os do seed.
 */
async function garantirDoisDiretores(): Promise<{ a: Db; aId: string; b: Db; bId: string }> {
  const a = await criarDiretor(uniq("g63-base-a"));
  const b = await criarDiretor(uniq("g63-base-b"));

  const { data: outros } = await admin
    .from("profiles")
    .select("id")
    .eq("diretor", true)
    .not("id", "in", `(${a.userId},${b.userId})`);
  for (const { id } of outros ?? []) {
    await admin.from("profiles").update({ diretor: false }).eq("id", id);
  }

  const aClient = await loginComoProfile(a.userId);
  const bClient = await loginComoProfile(b.userId);
  return { a: aClient, aId: a.userId, b: bClient, bId: b.userId };
}

describe("V11 · G6.3 — propor_alteracao_diretor / confirmar_alteracao_diretor", () => {
  let base: { a: Db; aId: string; b: Db; bId: string };

  beforeAll(async () => {
    base = await garantirDoisDiretores();
  });

  it("não-diretor não pode propor nem confirmar", async () => {
    const naoDiretor = await criarPersonaComEmpresa("matriz", { emailPrefix: uniq("g63-nd") });
    const alvo = await criarPersonaComEmpresa("matriz", { emailPrefix: uniq("g63-nd-alvo") });

    const { error: ePropor } = await naoDiretor.client.rpc("propor_alteracao_diretor", {
      p_senha: SENHA,
      p_alvo_id: alvo.userId,
      p_acao: "incluir",
    });
    expect(ePropor?.message).toContain("Seu acesso não permite esse tipo de alteração");

    // Uma proposta legítima (do diretor base A) para o não-diretor confirmar.
    const { data: propostaId, error: eCriar } = await base.a.rpc("propor_alteracao_diretor", {
      p_senha: SENHA,
      p_alvo_id: alvo.userId,
      p_acao: "incluir",
    });
    expect(eCriar).toBeNull();

    const { error: eConfirmar } = await naoDiretor.client.rpc("confirmar_alteracao_diretor", {
      p_senha: SENHA,
      p_proposta_id: propostaId as string,
      p_aprovar: true,
    });
    expect(eConfirmar?.message).toContain("Seu acesso não permite esse tipo de alteração");

    const { data: aindaFalse } = await admin
      .from("profiles")
      .select("diretor")
      .eq("id", alvo.userId)
      .single();
    expect(aindaFalse?.diretor).toBe(false);

    const { data: proposta } = await admin
      .from("diretor_propostas")
      .select("status")
      .eq("id", propostaId as string)
      .single();
    expect(proposta?.status).toBe("pendente");
  });

  it("propor com senha ERRADA falha, nenhuma proposta é criada", async () => {
    const alvo = await criarPersonaComEmpresa("matriz", { emailPrefix: uniq("g63-se-alvo") });

    const { error } = await base.a.rpc("propor_alteracao_diretor", {
      p_senha: "senha-errada-de-verdade",
      p_alvo_id: alvo.userId,
      p_acao: "incluir",
    });
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");

    const { data: propostas } = await admin
      .from("diretor_propostas")
      .select("id")
      .eq("alvo_id", alvo.userId);
    expect(propostas ?? []).toHaveLength(0);

    const { data: aindaNaoDiretor } = await admin
      .from("profiles")
      .select("diretor")
      .eq("id", alvo.userId)
      .single();
    expect(aindaNaoDiretor?.diretor).toBe(false);
  });

  it("propor remoção que deixaria só 1 diretor falha", async () => {
    const { error } = await base.b.rpc("propor_alteracao_diretor", {
      p_senha: SENHA,
      p_alvo_id: base.aId,
      p_acao: "remover",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("mínimo é 2");

    const { data: aindaDiretor } = await admin
      .from("profiles")
      .select("diretor")
      .eq("id", base.aId)
      .single();
    expect(aindaDiretor?.diretor).toBe(true);

    const { data: nenhumaProposta } = await admin
      .from("diretor_propostas")
      .select("id")
      .eq("alvo_id", base.aId)
      .eq("acao", "remover");
    expect(nenhumaProposta ?? []).toHaveLength(0);
  });

  it("proposta+confirmação por outro diretor aplica a mudança e gera histórico; confirmar com senha errada e auto-confirmação falham antes", async () => {
    const candidato = await criarPersonaComEmpresa("matriz", { emailPrefix: uniq("g63-inc") });

    const { data: propostaId, error: ePropor } = await base.a.rpc("propor_alteracao_diretor", {
      p_senha: SENHA,
      p_alvo_id: candidato.userId,
      p_acao: "incluir",
    });
    expect(ePropor).toBeNull();
    expect(propostaId).toBeTruthy();

    // Proposta duplicada enquanto a primeira está pendente é rejeitada.
    const { error: eDup } = await base.a.rpc("propor_alteracao_diretor", {
      p_senha: SENHA,
      p_alvo_id: candidato.userId,
      p_acao: "incluir",
    });
    expect(eDup?.message).toContain("Já existe uma proposta pendente");

    // Senha errada no confirmar: falha, nada muda.
    const { error: eSenhaErrada } = await base.b.rpc("confirmar_alteracao_diretor", {
      p_senha: "senha-errada-de-verdade",
      p_proposta_id: propostaId as string,
      p_aprovar: true,
    });
    expect(eSenhaErrada?.message).toContain("Seu acesso não permite esse tipo de alteração");

    // Quem propôs não pode confirmar a própria proposta.
    const { error: eAuto } = await base.a.rpc("confirmar_alteracao_diretor", {
      p_senha: SENHA,
      p_proposta_id: propostaId as string,
      p_aprovar: true,
    });
    expect(eAuto?.message).toContain("Quem confirma não pode ser quem propôs");

    const { data: aindaPendente } = await admin
      .from("diretor_propostas")
      .select("status")
      .eq("id", propostaId as string)
      .single();
    expect(aindaPendente?.status).toBe("pendente");
    const { data: aindaNaoDiretor } = await admin
      .from("profiles")
      .select("diretor")
      .eq("id", candidato.userId)
      .single();
    expect(aindaNaoDiretor?.diretor).toBe(false);

    // Agora sim: diretor B (≠ A, que propôs) confirma com a senha certa.
    const { error: eConfirmar } = await base.b.rpc("confirmar_alteracao_diretor", {
      p_senha: SENHA,
      p_proposta_id: propostaId as string,
      p_aprovar: true,
    });
    expect(eConfirmar).toBeNull();

    const { data: agoraDiretor } = await admin
      .from("profiles")
      .select("diretor")
      .eq("id", candidato.userId)
      .single();
    expect(agoraDiretor?.diretor).toBe(true);

    const { data: propostaFinal } = await admin
      .from("diretor_propostas")
      .select("status, confirmado_por, resolvido_em")
      .eq("id", propostaId as string)
      .single();
    expect(propostaFinal?.status).toBe("confirmada");
    expect(propostaFinal?.confirmado_por).toBe(base.bId);
    expect(propostaFinal?.resolvido_em).toBeTruthy();

    const { data: historico } = await admin
      .from("historico_alteracoes")
      .select("area, o_que, de_para")
      .eq("area", "Personalização geral")
      .eq("o_que", "Diretores")
      .order("quando", { ascending: false })
      .limit(1)
      .single();
    expect(historico?.o_que).toBe("Diretores");
    expect(JSON.stringify(historico?.de_para)).toContain("false");
    expect(JSON.stringify(historico?.de_para)).toContain("true");

    // Fecha o ciclo: com o candidato agora diretor (total = 3), removê-lo de
    // volta não fere o mínimo — cobre o caminho feliz de 'remover'.
    const { data: propostaRemocao, error: eProporRemocao } = await base.a.rpc(
      "propor_alteracao_diretor",
      { p_senha: SENHA, p_alvo_id: candidato.userId, p_acao: "remover" },
    );
    expect(eProporRemocao).toBeNull();

    const { error: eConfirmarRemocao } = await base.b.rpc("confirmar_alteracao_diretor", {
      p_senha: SENHA,
      p_proposta_id: propostaRemocao as string,
      p_aprovar: true,
    });
    expect(eConfirmarRemocao).toBeNull();

    const { data: removidoDeVolta } = await admin
      .from("profiles")
      .select("diretor")
      .eq("id", candidato.userId)
      .single();
    expect(removidoDeVolta?.diretor).toBe(false);
  });

  it("rejeitar não altera profiles nem gera histórico", async () => {
    const candidato = await criarPersonaComEmpresa("matriz", { emailPrefix: uniq("g63-rej") });

    const { data: propostaId, error: ePropor } = await base.a.rpc("propor_alteracao_diretor", {
      p_senha: SENHA,
      p_alvo_id: candidato.userId,
      p_acao: "incluir",
    });
    expect(ePropor).toBeNull();

    const { count: histAntes } = await admin
      .from("historico_alteracoes")
      .select("id", { count: "exact", head: true })
      .eq("o_que", "Diretores");

    const { error: eRejeitar } = await base.b.rpc("confirmar_alteracao_diretor", {
      p_senha: SENHA,
      p_proposta_id: propostaId as string,
      p_aprovar: false,
    });
    expect(eRejeitar).toBeNull();

    const { data: proposta } = await admin
      .from("diretor_propostas")
      .select("status, confirmado_por, resolvido_em")
      .eq("id", propostaId as string)
      .single();
    expect(proposta?.status).toBe("rejeitada");
    expect(proposta?.confirmado_por).toBe(base.bId);
    expect(proposta?.resolvido_em).toBeTruthy();

    const { data: aindaNaoDiretor } = await admin
      .from("profiles")
      .select("diretor")
      .eq("id", candidato.userId)
      .single();
    expect(aindaNaoDiretor?.diretor).toBe(false);

    const { count: histDepois } = await admin
      .from("historico_alteracoes")
      .select("id", { count: "exact", head: true })
      .eq("o_que", "Diretores");
    expect(histDepois).toBe(histAntes);

    // Depois de rejeitada, uma nova proposta para o mesmo alvo pode ser aberta
    // (não é mais "pendente duplicada").
    const { error: eNovaProposta } = await base.a.rpc("propor_alteracao_diretor", {
      p_senha: SENHA,
      p_alvo_id: candidato.userId,
      p_acao: "incluir",
    });
    expect(eNovaProposta).toBeNull();
  });

  it("confirmar proposta que já foi resolvida falha", async () => {
    const candidato = await criarPersonaComEmpresa("matriz", {
      emailPrefix: uniq("g63-resolvida"),
    });

    const { data: propostaId } = await base.a.rpc("propor_alteracao_diretor", {
      p_senha: SENHA,
      p_alvo_id: candidato.userId,
      p_acao: "incluir",
    });
    await base.b.rpc("confirmar_alteracao_diretor", {
      p_senha: SENHA,
      p_proposta_id: propostaId as string,
      p_aprovar: false,
    });

    const { error } = await base.b.rpc("confirmar_alteracao_diretor", {
      p_senha: SENHA,
      p_proposta_id: propostaId as string,
      p_aprovar: true,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("rejeitada");
  });
});
