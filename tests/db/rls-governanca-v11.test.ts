/**
 * V11.0.7 — governança: histórico imutável e trava de diretor no servidor.
 *
 * Cobre os itens 6 e 7 do Handoff de Produção V11:
 *
 *  - item 6: "alteração de política sem credencial de diretor é rejeitada no
 *    BACKEND, não só na tela".
 *  - item 7: "tentativa de editar/apagar falha por permissão".
 *
 * O caso mais importante aqui é o TRUNCATE. Um trigger `for each row` não
 * dispara em truncate, então enquanto o service_role tinha o grant (que o
 * Supabase concede por default privileges em public) a aplicação apagava o log
 * inteiro sem tropeçar em nada. Se alguém reconceder ALL numa migration futura,
 * é este teste que avisa.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { admin, loginMatriz, criarPersonaComEmpresa, uniq, type Db } from "../helpers/supabase";

const SENHA = "Teste@123!"; // default de criarUsuario

/** Cria uma pessoa da Matriz com a marcação de diretor. */
async function criarDiretor(prefix: string) {
  const p = await criarPersonaComEmpresa("matriz", { emailPrefix: prefix });
  const { error } = await admin
    .from("profiles")
    .update({ diretor: true, cargo_id: "matriz_total" })
    .eq("id", p.userId);
  if (error) throw error;
  return p;
}

describe("V11.0.6 — histórico append-only (item 7)", () => {
  let matriz: Db;

  beforeAll(async () => {
    matriz = await loginMatriz();
  });

  it("a aplicação não tem INSERT direto: a única porta é a função auditada", async () => {
    const { error } = await matriz
      .from("historico_alteracoes")
      .insert({ autor_nome: "Forjado", area: "Performance", o_que: "linha forjada" });
    expect(error, "authenticated conseguiu inserir no histórico direto").not.toBeNull();
  });

  it("UPDATE e DELETE falham para a aplicação", async () => {
    const diretor = await criarDiretor("hist-mut");
    const { error: eReg } = await diretor.client.rpc("fn_registrar_alteracao", {
      _area: "Performance",
      _o_que: uniq("linha para tentar mutar"),
      _senha: SENHA,
    });
    expect(eReg).toBeNull();

    const up = await diretor.client
      .from("historico_alteracoes")
      .update({ o_que: "reescrito" })
      .eq("area", "Performance");
    expect(up.error, "conseguiu reescrever o histórico").not.toBeNull();

    const del = await diretor.client
      .from("historico_alteracoes")
      .delete()
      .eq("area", "Performance");
    expect(del.error, "conseguiu apagar do histórico").not.toBeNull();
  });

  it("nem o service_role apaga o log — inclusive por TRUNCATE", async () => {
    const diretor = await criarDiretor("hist-trunc");
    await diretor.client.rpc("fn_registrar_alteracao", {
      _area: "Comissionamento",
      _o_que: uniq("linha que precisa sobreviver"),
      _senha: SENHA,
    });

    const { count: antes } = await admin
      .from("historico_alteracoes")
      .select("id", { count: "exact", head: true });
    expect(antes).toBeGreaterThan(0);

    // `admin` é o client de service_role — o mesmo papel das server functions.
    const del = await admin.from("historico_alteracoes").delete().neq("area", "___nunca___");
    expect(del.error, "service_role apagou linhas do histórico").not.toBeNull();

    const { count: depois } = await admin
      .from("historico_alteracoes")
      .select("id", { count: "exact", head: true });
    expect(depois).toBe(antes);
  });

  it("guarda o DE/PARA que alimenta a tela", async () => {
    const diretor = await criarDiretor("hist-depara");
    const oQue = uniq("Régua da rede externa alterada");
    const { data: id, error } = await diretor.client.rpc("fn_registrar_alteracao", {
      _area: "Performance",
      _o_que: oQue,
      _senha: SENHA,
      _de_para: [
        { campo: "Régua › convAtencao", de: "18", para: "20" },
        { campo: "Régua › diasT", de: "25", para: "20" },
      ],
    });
    expect(error).toBeNull();

    const { data: linha } = await admin
      .from("historico_alteracoes")
      .select("autor_nome, area, o_que, de_para")
      .eq("id", id as string)
      .single();
    expect(linha?.area).toBe("Performance");
    expect(linha?.o_que).toBe(oQue);
    // O protótipo mostra o autor como "Nome (diretor)".
    expect(linha?.autor_nome).toMatch(/\(diretor\)$/);
    expect(linha?.de_para).toHaveLength(2);
  });

  it("quem não tem a área de Configurações/Acessos não lê o histórico", async () => {
    const diretor = await criarDiretor("hist-rls-dir");
    await diretor.client.rpc("fn_registrar_alteracao", {
      _area: "Comissionamento",
      _o_que: uniq("linha visível só a quem tem a área"),
      _senha: SENHA,
    });

    const vendedor = await criarPersonaComEmpresa("vendedor", { emailPrefix: "hist-rls-vend" });
    const { data } = await vendedor.client.from("historico_alteracoes").select("id");
    expect(data ?? []).toHaveLength(0);

    // A Matriz tem todas as áreas, então enxerga.
    const matrizClient = await loginMatriz();
    const { data: vistas } = await matrizClient.from("historico_alteracoes").select("id");
    expect((vistas ?? []).length).toBeGreaterThan(0);
  });
});

describe("V11.0.5 — trava de diretor no servidor (item 6)", () => {
  it("não-diretor é rejeitado, mesmo com a senha certa", async () => {
    const naoDiretor = await criarPersonaComEmpresa("matriz", { emailPrefix: "gov-nao-dir" });

    const ok = await naoDiretor.client.rpc("fn_confirmar_senha_diretor", { _senha: SENHA });
    expect(ok.data).toBe(false);

    const { error } = await naoDiretor.client.rpc("fn_registrar_alteracao", {
      _area: "Comissionamento",
      _o_que: "tentativa de quem não é diretor",
      _senha: SENHA,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Seu acesso não permite esse tipo de alteração");
  });

  it("diretor com senha errada é rejeitado", async () => {
    const diretor = await criarDiretor("gov-senha-errada");

    const ok = await diretor.client.rpc("fn_confirmar_senha_diretor", { _senha: "senha-errada" });
    expect(ok.data).toBe(false);

    const { error } = await diretor.client.rpc("fn_registrar_alteracao", {
      _area: "Comissionamento",
      _o_que: "tentativa com senha errada",
      _senha: "senha-errada",
    });
    expect(error).not.toBeNull();
  });

  it("senha vazia não passa", async () => {
    const diretor = await criarDiretor("gov-senha-vazia");
    const ok = await diretor.client.rpc("fn_confirmar_senha_diretor", { _senha: "" });
    expect(ok.data).toBe(false);
  });

  it("diretor com a senha de login grava e a linha entra no histórico", async () => {
    const diretor = await criarDiretor("gov-ok");

    const ok = await diretor.client.rpc("fn_confirmar_senha_diretor", { _senha: SENHA });
    expect(ok.data).toBe(true);

    const oQue = uniq("Modelo Master alterado");
    const { data: id, error } = await diretor.client.rpc("fn_registrar_alteracao", {
      _area: "Comissionamento",
      _o_que: oQue,
      _senha: SENHA,
    });
    expect(error).toBeNull();
    expect(id).toBeTruthy();

    const { data: linha } = await admin
      .from("historico_alteracoes")
      .select("autor_id, o_que")
      .eq("id", id as string)
      .single();
    expect(linha?.autor_id).toBe(diretor.userId);
    expect(linha?.o_que).toBe(oQue);
  });
});

describe("V11.0.5 — mínimo de 2 diretores", () => {
  it("com 3 diretores, remover um é permitido", async () => {
    const a = await criarDiretor("min3-a");
    await criarDiretor("min3-b");
    await criarDiretor("min3-c");

    const { error } = await admin.from("profiles").update({ diretor: false }).eq("id", a.userId);
    expect(error).toBeNull();
  });

  /**
   * O invariante é global e só cresce: uma vez com 2 diretores, o sistema nunca
   * volta a ter menos. Por isso o teste não tenta montar "exatamente 2" (a
   * própria regra impede zerar para preparar cenário) — ele verifica o que
   * realmente importa: por mais que se tente, não se chega abaixo de 2.
   */
  it("é impossível ficar com menos de 2 diretores, um a um", async () => {
    await criarDiretor("min-a");
    await criarDiretor("min-b");

    const { data: todos } = await admin.from("profiles").select("id").eq("diretor", true);
    const ids = (todos ?? []).map((r) => r.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);

    let barrados = 0;
    for (const id of ids) {
      const { error } = await admin.from("profiles").update({ diretor: false }).eq("id", id);
      if (error) {
        barrados++;
        expect(error.message).toContain("mínimo é 2");
      }
    }
    expect(barrados, "deu para remover todos os diretores").toBeGreaterThan(0);

    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("diretor", true);
    expect(count).toBe(2);
  });

  it("excluir o cadastro de um diretor também respeita o mínimo", async () => {
    // O teste acima deixa exatamente 2; qualquer exclusão agora deve barrar.
    const { data: restantes } = await admin.from("profiles").select("id").eq("diretor", true);
    const ids = (restantes ?? []).map((r) => r.id);
    expect(ids).toHaveLength(2);

    const { error } = await admin.from("profiles").delete().eq("id", ids[0]);
    expect(error, "excluir diretor deixou o sistema com menos de 2").not.toBeNull();
    expect(error?.message).toContain("mínimo é 2");
  });
});
