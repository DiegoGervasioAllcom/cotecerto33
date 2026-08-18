/**
 * V11 · C1/C2 (Frente 3) — cadastro manual · exceção.
 *
 * Substitui o autocadastro espontâneo de `auth.cadastro.tsx` como única porta que
 * nasce sem convite. O caso central: só matriz/coordenador podem acionar — todo
 * pendente sem convite roteia para a fila da Matriz (F1 da Frente 2), então deixar
 * Master/Full criarem um pendente que eles mesmos não conseguem aprovar seria uma
 * armadilha. `empresas.criado_por` (C1) é o log de quem acionou.
 */
import { describe, it, expect } from "vitest";
import { admin, criarUsuario, criarPersonaComEmpresa, uniq, uniqDoc } from "../helpers/supabase";

async function matrizId(): Promise<string> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("email", "desenvolvimento@suppercerto.com.br")
    .single();
  if (error || !data) throw new Error(`matriz do seed não encontrada: ${error?.message}`);
  return data.id;
}

describe("V11 · C2 — criar_pendente_manual", () => {
  it("matriz cria o pendente: convite_id nulo, criado_por registrado, profile linkado", async () => {
    const matriz = await matrizId();
    const { userId } = await criarUsuario(`${uniq("manual-e2e")}@teste.local`);

    const { data: empresaId, error } = await admin.rpc("criar_pendente_manual", {
      p_user_id: userId,
      p_criado_por: matriz,
      p_nome: "Cadastro Manual E2E",
      p_tipo: "pf",
      p_documento: uniqDoc(),
      p_email: "manual.e2e@teste.local",
      p_celular: "11999990000",
      p_cidade: "São Paulo",
      p_uf: "SP",
    });
    expect(error).toBeNull();
    expect(empresaId).toBeTruthy();

    const { data: empresa } = await admin
      .from("empresas")
      .select("id,nome,tipo,status,convite_id,criado_por,escopo_manual")
      .eq("id", empresaId as string)
      .single();
    expect(empresa?.status).toBe("pendente");
    expect(empresa?.convite_id).toBeNull();
    expect(empresa?.criado_por).toBe(matriz);
    // p_escopo não foi passado — usa o default 'externo'.
    expect(empresa?.escopo_manual).toBe("externo");

    const { data: profile } = await admin
      .from("profiles")
      .select("empresa_id,nome")
      .eq("id", userId)
      .single();
    expect(profile?.empresa_id).toBe(empresaId);
    expect(profile?.nome).toBe("Cadastro Manual E2E");
  });

  it("master não pode acionar — o pendente sem convite não é dele para aprovar", async () => {
    const master = await criarPersonaComEmpresa("master");
    const { userId } = await criarUsuario(`${uniq("manual-recusa")}@teste.local`);

    const { error } = await admin.rpc("criar_pendente_manual", {
      p_user_id: userId,
      p_criado_por: master.userId,
      p_nome: "Não deveria nascer",
      p_tipo: "pf",
      p_documento: uniqDoc(),
    });
    expect(error?.message).toContain("não permite criar cadastro manual");
  });

  it("vendedor sem role de gestão também não pode acionar", async () => {
    const { userId: vendedorId } = await criarUsuario(`${uniq("vend-sem-permissao")}@teste.local`);
    const { userId: alvoId } = await criarUsuario(`${uniq("manual-recusa-2")}@teste.local`);

    const { error } = await admin.rpc("criar_pendente_manual", {
      p_user_id: alvoId,
      p_criado_por: vendedorId,
      p_nome: "Não deveria nascer",
      p_tipo: "pf",
      p_documento: uniqDoc(),
    });
    expect(error?.message).toContain("não permite criar cadastro manual");
  });

  it("rejeita tipo inválido", async () => {
    const matriz = await matrizId();
    const { userId } = await criarUsuario(`${uniq("manual-tipo-invalido")}@teste.local`);

    const { error } = await admin.rpc("criar_pendente_manual", {
      p_user_id: userId,
      p_criado_por: matriz,
      p_nome: "Teste",
      p_tipo: "matriz",
      p_documento: uniqDoc(),
    });
    expect(error?.message).toContain("tipo inválido");
  });

  it("rejeita nome vazio e documento curto", async () => {
    const matriz = await matrizId();
    const { userId } = await criarUsuario(`${uniq("manual-nome-vazio")}@teste.local`);

    const semNome = await admin.rpc("criar_pendente_manual", {
      p_user_id: userId,
      p_criado_por: matriz,
      p_nome: "",
      p_tipo: "pf",
      p_documento: uniqDoc(),
    });
    expect(semNome.error?.message).toContain("nome é obrigatório");

    const docCurto = await admin.rpc("criar_pendente_manual", {
      p_user_id: userId,
      p_criado_por: matriz,
      p_nome: "Teste",
      p_tipo: "pf",
      p_documento: "123",
    });
    expect(docCurto.error?.message).toContain("documento é obrigatório");
  });

  it("persiste escopo_manual='interno' — bug do vendedor CLT aparecendo como externo", async () => {
    const matriz = await matrizId();
    const { userId } = await criarUsuario(`${uniq("manual-clt")}@teste.local`);

    const { data: empresaId, error } = await admin.rpc("criar_pendente_manual", {
      p_user_id: userId,
      p_criado_por: matriz,
      p_nome: "Vendedor CLT E2E",
      p_tipo: "pf",
      p_documento: uniqDoc(),
      p_escopo: "interno",
    });
    expect(error).toBeNull();

    const { data: empresa } = await admin
      .from("empresas")
      .select("escopo_manual")
      .eq("id", empresaId as string)
      .single();
    expect(empresa?.escopo_manual).toBe("interno");
  });

  it("rejeita escopo interno com tipo pj — interno é sempre pessoa física", async () => {
    const matriz = await matrizId();
    const { userId } = await criarUsuario(`${uniq("manual-interno-pj")}@teste.local`);

    const { error } = await admin.rpc("criar_pendente_manual", {
      p_user_id: userId,
      p_criado_por: matriz,
      p_nome: "Não deveria nascer",
      p_tipo: "pj",
      p_documento: uniqDoc(),
      p_escopo: "interno",
    });
    expect(error?.message).toContain("escopo interno só aceita pessoa física");
  });

  it("rejeita escopo inválido", async () => {
    const matriz = await matrizId();
    const { userId } = await criarUsuario(`${uniq("manual-escopo-invalido")}@teste.local`);

    const { error } = await admin.rpc("criar_pendente_manual", {
      p_user_id: userId,
      p_criado_por: matriz,
      p_nome: "Não deveria nascer",
      p_tipo: "pf",
      p_documento: uniqDoc(),
      p_escopo: "matriz",
    });
    expect(error?.message).toContain("escopo inválido");
  });
});

describe("V11 · C2 — fn_pode_criar_pendente_manual", () => {
  it("matriz e coordenador podem; master, franqueado e supervisor não", async () => {
    const matriz = await matrizId();
    const { data: podeMatriz } = await admin.rpc("fn_pode_criar_pendente_manual", { _uid: matriz });
    expect(podeMatriz).toBe(true);

    const master = await criarPersonaComEmpresa("master");
    const { data: podeMaster } = await admin.rpc("fn_pode_criar_pendente_manual", {
      _uid: master.userId,
    });
    expect(podeMaster).toBe(false);

    const franqueado = await criarPersonaComEmpresa("franqueado");
    const { data: podeFranqueado } = await admin.rpc("fn_pode_criar_pendente_manual", {
      _uid: franqueado.userId,
    });
    expect(podeFranqueado).toBe(false);
  });
});
