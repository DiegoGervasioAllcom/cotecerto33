/**
 * V11 · C10 — escopo do Convite Supper, validado no servidor.
 *
 * Este é o teste que mais importa da Frente 1. Se `criar_convite` não conferir o
 * perfil de quem chama, um Master forja um convite de Direção, o pedido cai na
 * fila da Matriz **já classificado como interno**, e a aprovação confirma o que
 * foi declarado — ou seja, a tela de aprovação não pegaria a fraude. A guarda tem
 * de estar no banco, e é isso que os casos negativos aqui travam.
 *
 * Regras (fluxo "Autocadastro" + Etapa 1 do DE/PARA):
 *   interno  — Matriz/Coordenador: 7 cargos + Vendedor Matriz, vínculo Matriz
 *   externo  — Matriz/Coordenador: só Master e Franquia Individual direta
 *   master   — Master: franquias e vendedores DELE; nunca outro Master, nunca interno
 *   full     — Franquia Full: só Vendedor da própria franquia
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  admin,
  anonClient,
  loginMatriz,
  criarPersonaComEmpresa,
  criarEmpresa,
  uniq,
  type Db,
} from "../helpers/supabase";

type ConviteArgs = {
  p_nome: string;
  p_escopo: string;
  p_trilha: string;
  p_perfil?: string | null;
  p_cargo_id?: string | null;
  p_vinc_tipo?: string;
  p_vinc_empresa_id?: string | null;
  p_validade_dias?: number;
};

async function convidar(client: Db, args: ConviteArgs) {
  return client.rpc("criar_convite", args as never);
}

/** Cria uma Franquia Full de verdade (precisa de modelo com modalidade full). */
async function criarFull(prefix: string) {
  const { data: modelo, error } = await admin
    .from("modelos_franquia")
    .select("id")
    .eq("modalidade", "full")
    .limit(1)
    .single();
  if (error) throw error;
  const emp = await criarEmpresa();
  await admin.from("empresas").update({ modelo_id: modelo.id }).eq("id", emp.id);
  return criarPersonaComEmpresa("franqueado", { empresaId: emp.id, emailPrefix: prefix });
}

describe("C2 — escopo interno (Matriz/Coordenador)", () => {
  let matriz: Db;

  beforeAll(async () => {
    matriz = await loginMatriz();
  });

  it("emite convite de cargo, com código e token no formato esperado", async () => {
    const { data, error } = await convidar(matriz, {
      p_nome: uniq("Ana"),
      p_escopo: "interno",
      p_trilha: "interno",
      p_cargo_id: "sup_vendas",
    });
    expect(error).toBeNull();
    const c = (data as unknown as Array<{ codigo: string; token: string }>)[0];
    expect(c.codigo).toMatch(/^SC-[0-9A-Z]{6}$/);
    // O token é o segredo que vai na URL — o código curto não serve para isso.
    expect(c.token.length).toBeGreaterThanOrEqual(32);
    expect(c.token).not.toContain("/");
    expect(c.token).not.toContain("+");
  });

  it("emite Vendedor Matriz (perfil vendedor, sem cargo)", async () => {
    const { error } = await convidar(matriz, {
      p_nome: uniq("Vend CLT"),
      p_escopo: "interno",
      p_trilha: "interno",
      p_perfil: "vendedor",
    });
    expect(error).toBeNull();
  });

  it("recusa convite interno sem cargo e sem ser Vendedor Matriz", async () => {
    const { error } = await convidar(matriz, {
      p_nome: uniq("Sem nada"),
      p_escopo: "interno",
      p_trilha: "interno",
    });
    expect(error).not.toBeNull();
  });

  it("força o vínculo em Matriz, mesmo se a tela mandar outro", async () => {
    const alheia = await criarEmpresa();
    const { data, error } = await convidar(matriz, {
      p_nome: uniq("Forcado"),
      p_escopo: "interno",
      p_trilha: "interno",
      p_cargo_id: "marketing",
      p_vinc_tipo: "master",
      p_vinc_empresa_id: alheia.id,
    });
    expect(error).toBeNull();
    const id = (data as unknown as Array<{ id: string }>)[0].id;
    const { data: linha } = await admin
      .from("convites")
      .select("vinc_tipo, vinc_empresa_id")
      .eq("id", id)
      .single();
    expect(linha?.vinc_tipo).toBe("matriz");
    expect(linha?.vinc_empresa_id).toBeNull();
  });
});

describe("C2 — escopo externo da Matriz: só Master e Individual direta", () => {
  let matriz: Db;

  beforeAll(async () => {
    matriz = await loginMatriz();
  });

  it("aceita Master e Franquia Individual", async () => {
    for (const perfil of ["master", "franquia_indiv"]) {
      const { error } = await convidar(matriz, {
        p_nome: uniq(perfil),
        p_escopo: "externo",
        p_trilha: "externo",
        p_perfil: perfil,
      });
      expect(error, `perfil ${perfil} deveria ser aceito`).toBeNull();
    }
  });

  it("recusa Franquia Full e vendedor — esses vêm do Master, não da Matriz", async () => {
    for (const perfil of ["franquia_full", "vendedor"]) {
      const { error } = await convidar(matriz, {
        p_nome: uniq(perfil),
        p_escopo: "externo",
        p_trilha: "externo",
        p_perfil: perfil,
      });
      expect(error, `perfil ${perfil} deveria ser recusado`).not.toBeNull();
    }
  });

  it("Matriz não usa os escopos de Master nem de Full", async () => {
    for (const escopo of ["master", "full"]) {
      const { error } = await convidar(matriz, {
        p_nome: uniq("x"),
        p_escopo: escopo,
        p_trilha: "externo",
        p_perfil: "vendedor",
      });
      expect(error, `escopo ${escopo} não é da Matriz`).not.toBeNull();
    }
  });
});

describe("C2 — escopo do Master", () => {
  it("convida franquia e o vínculo fica travado nele, não no que a tela mandar", async () => {
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "cv-master" });
    const alheia = await criarEmpresa();

    const { data, error } = await convidar(master.client, {
      p_nome: uniq("Franquia dele"),
      p_escopo: "master",
      p_trilha: "externo",
      p_perfil: "franquia_full",
      p_vinc_tipo: "master",
      p_vinc_empresa_id: alheia.id, // tentativa de apontar para fora
    });
    expect(error).toBeNull();

    const id = (data as unknown as Array<{ id: string }>)[0].id;
    const { data: linha } = await admin
      .from("convites")
      .select("vinc_tipo, vinc_empresa_id")
      .eq("id", id)
      .single();
    expect(linha?.vinc_tipo).toBe("master");
    expect(linha?.vinc_empresa_id, "vínculo vazou para empresa de fora").toBe(master.empresaId);
  });

  it("NÃO convida outro Master", async () => {
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "cv-master-m" });
    const { error } = await convidar(master.client, {
      p_nome: uniq("Outro master"),
      p_escopo: "master",
      p_trilha: "externo",
      p_perfil: "master",
    });
    expect(error, "Master conseguiu convidar outro Master").not.toBeNull();
  });

  it("NÃO convida ninguém do time interno — nem forjando a trilha", async () => {
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "cv-master-i" });

    // Pelo escopo dele, forjando trilha interna e cargo de Direção.
    const forjado = await convidar(master.client, {
      p_nome: uniq("Diretor forjado"),
      p_escopo: "master",
      p_trilha: "interno",
      p_cargo_id: "matriz_total",
    });
    expect(forjado.error, "Master forjou convite de trilha interna").not.toBeNull();

    // E tentando usar o escopo interno direto.
    const escopoErrado = await convidar(master.client, {
      p_nome: uniq("Diretor forjado 2"),
      p_escopo: "interno",
      p_trilha: "interno",
      p_cargo_id: "matriz_total",
    });
    expect(escopoErrado.error, "Master usou o escopo interno").not.toBeNull();
  });

  it("convida vendedor de Franquia Full da rede dele, e não de fora", async () => {
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "cv-master-v" });
    // Full pendurada na rede do master.
    const fullNaRede = await criarEmpresa();
    await criarPersonaComEmpresa("franqueado", {
      empresaId: fullNaRede.id,
      emailPrefix: "cv-full-rede",
      superiorId: master.userId,
    });

    const ok = await convidar(master.client, {
      p_nome: uniq("Vend da Full"),
      p_escopo: "master",
      p_trilha: "externo",
      p_perfil: "vendedor",
      p_vinc_tipo: "full",
      p_vinc_empresa_id: fullNaRede.id,
    });
    expect(ok.error).toBeNull();

    const foraDaRede = await criarEmpresa();
    const nao = await convidar(master.client, {
      p_nome: uniq("Vend de fora"),
      p_escopo: "master",
      p_trilha: "externo",
      p_perfil: "vendedor",
      p_vinc_tipo: "full",
      p_vinc_empresa_id: foraDaRede.id,
    });
    expect(nao.error, "Master convidou vendedor de Full fora da rede dele").not.toBeNull();
  });
});

describe("C2 — escopo da Franquia Full", () => {
  it("convida só Vendedor, com a franquia dela travada", async () => {
    const full = await criarFull("cv-full");

    const { data, error } = await convidar(full.client, {
      p_nome: uniq("Vend dela"),
      p_escopo: "full",
      p_trilha: "externo",
      p_perfil: "vendedor",
    });
    expect(error).toBeNull();

    const id = (data as unknown as Array<{ id: string }>)[0].id;
    const { data: linha } = await admin
      .from("convites")
      .select("vinc_tipo, vinc_empresa_id")
      .eq("id", id)
      .single();
    expect(linha?.vinc_tipo).toBe("full");
    expect(linha?.vinc_empresa_id).toBe(full.empresaId);
  });

  it("não convida franquia nem Master", async () => {
    const full = await criarFull("cv-full-2");
    for (const perfil of ["franquia_full", "franquia_indiv", "master"]) {
      const { error } = await convidar(full.client, {
        p_nome: uniq(perfil),
        p_escopo: "full",
        p_trilha: "externo",
        p_perfil: perfil,
      });
      expect(error, `Full convidou ${perfil}`).not.toBeNull();
    }
  });

  it("franquia Individual não usa o escopo da Full", async () => {
    // Individual não tem equipe — o escopo `full` não é dela.
    const indiv = await criarPersonaComEmpresa("franqueado", { emailPrefix: "cv-indiv" });
    const { error } = await convidar(indiv.client, {
      p_nome: uniq("Vend"),
      p_escopo: "full",
      p_trilha: "externo",
      p_perfil: "vendedor",
    });
    expect(error, "Individual convidou vendedor").not.toBeNull();
  });

  it("vendedor não convida ninguém", async () => {
    const vend = await criarPersonaComEmpresa("vendedor", { emailPrefix: "cv-vend" });
    for (const escopo of ["interno", "externo", "master", "full"]) {
      const { error } = await convidar(vend.client, {
        p_nome: uniq("x"),
        p_escopo: escopo,
        p_trilha: "externo",
        p_perfil: "vendedor",
      });
      expect(error, `vendedor usou o escopo ${escopo}`).not.toBeNull();
    }
  });
});

describe("C1 — a única porta de escrita é a RPC", () => {
  it("authenticated não insere convite direto", async () => {
    const matriz = await loginMatriz();
    const { error } = await matriz.from("convites").insert({
      codigo: "SC-ABC123",
      token: "x".repeat(40),
      nome: "Forjado",
      escopo: "interno",
      trilha: "interno",
      cargo_id: "matriz_total",
      vinc_tipo: "matriz",
      expira_em: new Date(Date.now() + 86_400_000).toISOString(),
      criado_por: (await matriz.auth.getUser()).data.user!.id,
    });
    expect(error, "inseriu convite sem passar pela RPC").not.toBeNull();
  });

  it("um Master não vê os convites de outro", async () => {
    const a = await criarPersonaComEmpresa("master", { emailPrefix: "cv-vis-a" });
    const b = await criarPersonaComEmpresa("master", { emailPrefix: "cv-vis-b" });

    const { data } = await convidar(a.client, {
      p_nome: uniq("Da rede de A"),
      p_escopo: "master",
      p_trilha: "externo",
      p_perfil: "franquia_indiv",
    });
    const id = (data as unknown as Array<{ id: string }>)[0].id;

    const visaoB = await b.client.from("convites").select("id").eq("id", id);
    expect(visaoB.data ?? []).toHaveLength(0);

    // A Matriz acompanha todos (a tela de Acessos lista os emitidos).
    const matriz = await loginMatriz();
    const visaoMatriz = await matriz.from("convites").select("id").eq("id", id);
    expect(visaoMatriz.data ?? []).toHaveLength(1);
  });
});

describe("C3 — abrir_convite", () => {
  it("devolve o payload para pré-preencher, e o nome de quem convidou", async () => {
    const matriz = await loginMatriz();
    const nome = uniq("Convidada");
    const { data } = await convidar(matriz, {
      p_nome: nome,
      p_escopo: "interno",
      p_trilha: "interno",
      p_cargo_id: "sup_operacional",
    });
    const token = (data as unknown as Array<{ token: string }>)[0].token;

    // Anônimo: o convidado ainda não tem login.
    const { data: aberto, error } = await anonClient().rpc("abrir_convite", { p_token: token });
    expect(error).toBeNull();
    const p = aberto as Record<string, unknown>;
    expect(p.ok).toBe(true);
    expect(p.nome).toBe(nome);
    expect(p.trilha).toBe("interno");
    expect(p.cargo_id).toBe("sup_operacional");
    expect(p.cargo_nome).toBe("Supervisor Operacional");
    expect(p.vinc_nome).toBe("Matriz");
    expect(p.convidado_por).toBeTruthy();
  });

  it("token inexistente, expirado e já usado têm motivos distintos", async () => {
    const matriz = await loginMatriz();
    const anon = anonClient();

    const inexistente = await anon.rpc("abrir_convite", { p_token: "z".repeat(43) });
    expect((inexistente.data as Record<string, unknown>).motivo).toBe("inexistente");

    // Expirado: emite e recua a validade pelo admin.
    const exp = await convidar(matriz, {
      p_nome: uniq("Expirado"),
      p_escopo: "interno",
      p_trilha: "interno",
      p_cargo_id: "marketing",
    });
    const tokExp = (exp.data as unknown as Array<{ token: string }>)[0].token;
    await admin
      .from("convites")
      .update({ expira_em: new Date(Date.now() - 1000).toISOString() })
      .eq("token", tokExp);
    const expirado = await anon.rpc("abrir_convite", { p_token: tokExp });
    expect((expirado.data as Record<string, unknown>).motivo).toBe("expirado");

    // Usado: marca o consumo.
    const usado = await convidar(matriz, {
      p_nome: uniq("Usado"),
      p_escopo: "interno",
      p_trilha: "interno",
      p_cargo_id: "marketing",
    });
    const tokUsado = (usado.data as unknown as Array<{ token: string }>)[0].token;
    await admin
      .from("convites")
      .update({ usado_em: new Date().toISOString() })
      .eq("token", tokUsado);
    const jaUsado = await anon.rpc("abrir_convite", { p_token: tokUsado });
    expect((jaUsado.data as Record<string, unknown>).motivo).toBe("usado");
  });

  it("não vaza a tabela para anônimo", async () => {
    const { data, error } = await anonClient().from("convites").select("token");
    // Ou erro de permissão, ou zero linhas — nunca a lista de tokens.
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});
