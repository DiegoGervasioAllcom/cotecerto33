/**
 * V11 · F1/F2 — roteamento das filas de aprovação e quem pode aprovar.
 *
 * O caso que dá nome à frente é o negativo: **a Matriz não vê nem aprova o
 * pendente de um vendedor de Franquia Full**. Antes desta migration, a
 * `aprovar_empresa` só perguntava "quem chama é matriz?" — e como a RPC é
 * exposta por HTTP, recortar a fila na tela não impediria nada: bastava chamar
 * com outro `empresa_id`. É isso que os testes de recusa travam.
 *
 * O que NÃO é exceção, e também está coberto: a `franquia_full` (a franquia como
 * entidade) é aprovada pela Matriz normalmente. Só o *vendedor* vinculado a uma
 * Full sai das filas dela.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  admin,
  anonClient,
  loginMatriz,
  criarPersonaComEmpresa,
  criarEmpresa,
  uniq,
  uniqDoc,
  type Db,
} from "../helpers/supabase";

type Cenario = {
  /** Empresa pendente (o pedido). */
  pedidoId: string;
  conviteId: string;
};

/** Cria um convite + o pedido pendente ligado a ele, como a Frente 1 faz. */
async function criarPedido(opts: {
  trilha: "interno" | "externo";
  perfil?: string | null;
  cargoId?: string | null;
  vincTipo?: "matriz" | "master" | "full";
  vincEmpresaId?: string | null;
  criadoPor: string;
  semConvite?: boolean;
}): Promise<Cenario> {
  const { data: pedido, error: ePedido } = await admin
    .from("empresas")
    .insert({
      nome: uniq("Pedido"),
      tipo: opts.trilha === "interno" || opts.perfil === "vendedor" ? "pf" : "pj",
      documento: uniqDoc(),
      status: "pendente",
    })
    .select("id")
    .single();
  if (ePedido || !pedido) throw new Error(`criar pedido: ${ePedido?.message}`);

  if (opts.semConvite) {
    return { pedidoId: pedido.id, conviteId: "" };
  }

  const { data: codigo } = await admin.rpc("fn_convite_codigo");
  const { data: convite, error: eConvite } = await admin
    .from("convites")
    .insert({
      codigo: codigo as unknown as string,
      token: `t-${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "").slice(0, 44),
      nome: uniq("Convidado"),
      escopo: opts.trilha === "interno" ? "interno" : "externo",
      trilha: opts.trilha,
      perfil: opts.perfil ?? null,
      cargo_id: opts.cargoId ?? null,
      vinc_tipo: opts.vincTipo ?? "matriz",
      vinc_empresa_id: opts.vincEmpresaId ?? null,
      expira_em: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      criado_por: opts.criadoPor,
    })
    .select("id")
    .single();
  if (eConvite || !convite) throw new Error(`criar convite: ${eConvite?.message}`);

  await admin.from("empresas").update({ convite_id: convite.id }).eq("id", pedido.id);
  return { pedidoId: pedido.id, conviteId: convite.id };
}

/** Franquia Full de verdade (precisa de modelo com modalidade full). */
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

let matrizId: string;

beforeAll(async () => {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("email", "desenvolvimento@suppercerto.com.br")
    .single();
  matrizId = data!.id;
});

describe("F1 — de quem é a fila", () => {
  it("trilha interna vai para a fila do time interno da Matriz", async () => {
    const p = await criarPedido({
      trilha: "interno",
      cargoId: "sup_operacional",
      criadoPor: matrizId,
    });
    const { data } = await admin.rpc("fn_destino_pedido", { _empresa_id: p.pedidoId });
    expect(data).toBe("matriz_interno");
  });

  it("Master, Franquia Individual e Franquia FULL vão para a fila externa da Matriz", async () => {
    // A franquia_full é da Matriz — só o VENDEDOR dela é exceção.
    for (const perfil of ["master", "franquia_indiv", "franquia_full"]) {
      const p = await criarPedido({
        trilha: "externo",
        perfil,
        vincTipo: "matriz",
        criadoPor: matrizId,
      });
      const { data } = await admin.rpc("fn_destino_pedido", { _empresa_id: p.pedidoId });
      expect(data, `perfil ${perfil} deveria ir para a fila da Matriz`).toBe("matriz_rede");
    }
  });

  it("vendedor da operação do Master vai para a fila externa da Matriz", async () => {
    const master = await criarPersonaComEmpresa("master", { emailPrefix: "fila-master" });
    const p = await criarPedido({
      trilha: "externo",
      perfil: "vendedor",
      vincTipo: "master",
      vincEmpresaId: master.empresaId,
      criadoPor: matrizId,
    });
    const { data } = await admin.rpc("fn_destino_pedido", { _empresa_id: p.pedidoId });
    expect(data).toBe("matriz_rede");
  });

  it("vendedor de Franquia Full vai para a fila DA FRANQUIA", async () => {
    const full = await criarFull("fila-full");
    const p = await criarPedido({
      trilha: "externo",
      perfil: "vendedor",
      vincTipo: "full",
      vincEmpresaId: full.empresaId,
      criadoPor: matrizId,
    });
    const { data } = await admin.rpc("fn_destino_pedido", { _empresa_id: p.pedidoId });
    expect(data).toBe("franquia");

    const { data: dona } = await admin.rpc("fn_fila_franquia_id", { _empresa_id: p.pedidoId });
    expect(dona).toBe(full.empresaId);
  });

  it("pedido sem convite (manual · exceção) cai na fila externa da Matriz", async () => {
    // É a "Prime Riscos Corretora ME" do protótipo: chip manual · exceção e
    // "sem tipo declarado — a Matriz define na análise".
    const p = await criarPedido({ trilha: "externo", criadoPor: matrizId, semConvite: true });
    const { data } = await admin.rpc("fn_destino_pedido", { _empresa_id: p.pedidoId });
    expect(data).toBe("matriz_rede");
  });
});

describe("F2 — quem pode aprovar", () => {
  it("a Matriz aprova o que é dela", async () => {
    const p = await criarPedido({
      trilha: "externo",
      perfil: "master",
      criadoPor: matrizId,
    });
    const matriz = await loginMatriz();
    const { error } = await matriz.rpc("aprovar_empresa", { p_empresa_id: p.pedidoId });
    expect(error).toBeNull();

    const { data: emp } = await admin
      .from("empresas")
      .select("status")
      .eq("id", p.pedidoId)
      .single();
    expect(emp?.status).toBe("aprovada");
  });

  it("a Matriz NÃO aprova o vendedor de uma Franquia Full", async () => {
    const full = await criarFull("aprov-full");
    const p = await criarPedido({
      trilha: "externo",
      perfil: "vendedor",
      vincTipo: "full",
      vincEmpresaId: full.empresaId,
      criadoPor: matrizId,
    });

    const matriz = await loginMatriz();
    const { error } = await matriz.rpc("aprovar_empresa", { p_empresa_id: p.pedidoId });
    expect(error, "a Matriz aprovou pedido que é da franquia").not.toBeNull();
    expect(error?.message).toContain("fila da franquia");

    // E o pedido continua pendente.
    const { data: emp } = await admin
      .from("empresas")
      .select("status")
      .eq("id", p.pedidoId)
      .single();
    expect(emp?.status).toBe("pendente");
  });

  it("a Franquia Full aprova o vendedor dela", async () => {
    const full = await criarFull("aprov-full-ok");
    const p = await criarPedido({
      trilha: "externo",
      perfil: "vendedor",
      vincTipo: "full",
      vincEmpresaId: full.empresaId,
      criadoPor: matrizId,
    });

    const { error } = await full.client.rpc("aprovar_empresa", { p_empresa_id: p.pedidoId });
    expect(error, "a franquia não conseguiu aprovar o vendedor dela").toBeNull();

    const { data: emp } = await admin
      .from("empresas")
      .select("status")
      .eq("id", p.pedidoId)
      .single();
    expect(emp?.status).toBe("aprovada");
  });

  it("uma Franquia Full NÃO aprova o vendedor de outra Full", async () => {
    const a = await criarFull("full-a");
    const b = await criarFull("full-b");
    const p = await criarPedido({
      trilha: "externo",
      perfil: "vendedor",
      vincTipo: "full",
      vincEmpresaId: a.empresaId,
      criadoPor: matrizId,
    });

    const { error } = await b.client.rpc("aprovar_empresa", { p_empresa_id: p.pedidoId });
    expect(error, "franquia aprovou vendedor de outra franquia").not.toBeNull();
  });

  it("vendedor não aprova nada", async () => {
    const p = await criarPedido({ trilha: "externo", perfil: "master", criadoPor: matrizId });
    const vend = await criarPersonaComEmpresa("vendedor", { emailPrefix: "aprov-vend" });
    const { error } = await vend.client.rpc("aprovar_empresa", { p_empresa_id: p.pedidoId });
    expect(error).not.toBeNull();
  });
});

describe("F2 — RLS: o pendente da Full sai das filas da Matriz", () => {
  let matriz: Db;

  beforeAll(async () => {
    matriz = await loginMatriz();
  });

  it("a Matriz não enxerga o pendente do vendedor de Full", async () => {
    const full = await criarFull("rls-full");
    const p = await criarPedido({
      trilha: "externo",
      perfil: "vendedor",
      vincTipo: "full",
      vincEmpresaId: full.empresaId,
      criadoPor: matrizId,
    });

    const { data } = await matriz.from("empresas").select("id").eq("id", p.pedidoId);
    expect(data ?? [], "o pendente da Full apareceu para a Matriz").toHaveLength(0);
  });

  it("a Franquia Full enxerga o pendente dela, e não o de outra", async () => {
    const a = await criarFull("rls-full-a");
    const b = await criarFull("rls-full-b");
    const pA = await criarPedido({
      trilha: "externo",
      perfil: "vendedor",
      vincTipo: "full",
      vincEmpresaId: a.empresaId,
      criadoPor: matrizId,
    });

    const vistoPorA = await a.client.from("empresas").select("id").eq("id", pA.pedidoId);
    expect(vistoPorA.data ?? []).toHaveLength(1);

    const vistoPorB = await b.client.from("empresas").select("id").eq("id", pA.pedidoId);
    expect(vistoPorB.data ?? [], "uma Full viu o pendente da outra").toHaveLength(0);
  });

  it("a Matriz continua vendo os pendentes que são dela", async () => {
    const p = await criarPedido({
      trilha: "interno",
      cargoId: "marketing",
      criadoPor: matrizId,
    });
    const { data } = await matriz.from("empresas").select("id").eq("id", p.pedidoId);
    expect(data ?? []).toHaveLength(1);
  });

  it("depois de APROVADO, o vendedor da Full volta a aparecer para a Matriz", async () => {
    // Cadastros Rede lista a rede inteira, inclusive os vendedores das Fulls —
    // o que sai da visão da Matriz é só o pendente.
    const full = await criarFull("rls-full-aprov");
    const p = await criarPedido({
      trilha: "externo",
      perfil: "vendedor",
      vincTipo: "full",
      vincEmpresaId: full.empresaId,
      criadoPor: matrizId,
    });

    const escondido = await matriz.from("empresas").select("id").eq("id", p.pedidoId);
    expect(escondido.data ?? []).toHaveLength(0);

    await full.client.rpc("aprovar_empresa", { p_empresa_id: p.pedidoId });

    const visivel = await matriz.from("empresas").select("id,status").eq("id", p.pedidoId);
    expect(visivel.data ?? [], "aprovado deveria voltar a ser visível à Matriz").toHaveLength(1);
  });

  it("anônimo não enxerga pedido nenhum", async () => {
    const p = await criarPedido({ trilha: "externo", perfil: "master", criadoPor: matrizId });
    const { data } = await anonClient().from("empresas").select("id").eq("id", p.pedidoId);
    expect(data ?? []).toHaveLength(0);
  });
});
