import { describe, it, expect, beforeAll } from "vitest";
import { admin, uniq } from "../helpers/supabase";

/** String de exatamente `tamanho` chars, com prefixo único (para colunas com unique constraint). */
function strUnica(tamanho: number): string {
  const prefixo = uniq("u");
  return (prefixo + "x".repeat(tamanho)).slice(0, tamanho);
}

/**
 * D1 (PR 2/3) — limites de char_length em catálogos e operação.
 *
 * 20260715183530_d1_check_tamanho_texto_catalogos.sql adiciona CHECK
 * `char_length(<col>) <= <n>` (defesa em profundidade) em colunas de texto
 * livre de modelos_franquia, mensagens_prontas, perda_motivos,
 * perda_submotivos, seguradoras, planos, integracoes e comissao_lancamentos.
 * Colunas enum-like que já têm `check in (...)` (ex.:
 * perda_submotivos.destino_sugerido, integracoes.status,
 * comissao_lancamentos.tipo/origem) não recebem char_length — seria
 * redundante — e não são cobertas aqui.
 *
 * Cada assert testa o par limite (aceita) / limite+1 (rejeita, 23514).
 * Usa `admin` (service_role) para inserir direto, sem interferência de RLS.
 */
describe("D1 — CHECK de char_length em catálogos e operação", () => {
  let vendedorId: string;

  beforeAll(async () => {
    const { data: user, error: eUser } = await admin.auth.admin.createUser({
      email: `${uniq("d1-cat-vend")}@teste.local`,
      password: "Teste@123!",
      email_confirm: true,
    });
    if (eUser || !user.user) throw eUser ?? new Error("falha ao criar vendedor de fixture");
    vendedorId = user.user.id;
  });

  it("modelos_franquia: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["nome", 150],
      ["descricao", 2000],
    ];

    for (const [col, limite] of campos) {
      const { error: eInvalido } = await admin
        .from("modelos_franquia")
        .insert({ nome: uniq("d1-modelo"), [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `modelos_franquia.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin
        .from("modelos_franquia")
        .insert({ nome: uniq("d1-modelo"), [col]: "x".repeat(limite) } as never);
      expect(eValido, `modelos_franquia.${col} no limite`).toBeNull();
    }
  });

  it("mensagens_prontas: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["titulo", 150],
      ["conteudo", 5000],
    ];

    for (const [col, limite] of campos) {
      const base = { titulo: uniq("d1-msg"), conteudo: "conteudo base" };

      const { error: eInvalido } = await admin
        .from("mensagens_prontas")
        .insert({ ...base, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `mensagens_prontas.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin
        .from("mensagens_prontas")
        .insert({ ...base, titulo: uniq("d1-msg"), [col]: "x".repeat(limite) } as never);
      expect(eValido, `mensagens_prontas.${col} no limite`).toBeNull();
    }
  });

  it("perda_motivos: limite de nome", async () => {
    const { error: eInvalido } = await admin.from("perda_motivos").insert({ nome: strUnica(151) });
    expect(eInvalido?.code, "perda_motivos.nome limite+1").toBe("23514");

    const { error: eValido } = await admin.from("perda_motivos").insert({ nome: strUnica(150) });
    expect(eValido, "perda_motivos.nome no limite").toBeNull();
  });

  it("perda_submotivos: limite de nome", async () => {
    const { data: motivo, error: eMotivo } = await admin
      .from("perda_motivos")
      .insert({ nome: uniq("d1-motivo") })
      .select("id")
      .single();
    if (eMotivo) throw eMotivo;

    const { error: eInvalido } = await admin.from("perda_submotivos").insert({
      motivo_id: motivo.id,
      nome: "x".repeat(151),
      destino_sugerido: "Remalho",
    });
    expect(eInvalido?.code, "perda_submotivos.nome limite+1").toBe("23514");

    const { error: eValido } = await admin.from("perda_submotivos").insert({
      motivo_id: motivo.id,
      nome: "x".repeat(150),
      destino_sugerido: "Remalho",
    });
    expect(eValido, "perda_submotivos.nome no limite").toBeNull();
  });

  it("seguradoras: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["nome", 150],
      ["codigo", 30],
    ];

    for (const [col, limite] of campos) {
      const valorInvalido = strUnica(limite + 1);
      const valorValido = strUnica(limite);

      const { error: eInvalido } = await admin
        .from("seguradoras")
        .insert({ nome: uniq("d1-seg"), [col]: valorInvalido } as never);
      expect(eInvalido?.code, `seguradoras.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin
        .from("seguradoras")
        .insert({ nome: uniq("d1-seg"), [col]: valorValido } as never);
      expect(eValido, `seguradoras.${col} no limite`).toBeNull();
    }
  });

  it("planos: limites de texto", async () => {
    const { data: seg, error: eSeg } = await admin
      .from("seguradoras")
      .insert({ nome: uniq("d1-seg-plano") })
      .select("id")
      .single();
    if (eSeg) throw eSeg;

    const campos: Array<[string, number]> = [
      ["nome", 150],
      ["codigo", 30],
      ["descricao", 2000],
    ];

    for (const [col, limite] of campos) {
      const { error: eInvalido } = await admin.from("planos").insert({
        seguradora_id: seg.id,
        nome: uniq("d1-plano"),
        [col]: "x".repeat(limite + 1),
      } as never);
      expect(eInvalido?.code, `planos.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin.from("planos").insert({
        seguradora_id: seg.id,
        nome: uniq("d1-plano"),
        [col]: "x".repeat(limite),
      } as never);
      expect(eValido, `planos.${col} no limite`).toBeNull();
    }
  });

  it("integracoes: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["nome", 150],
      ["descricao", 2000],
    ];

    for (const [col, limite] of campos) {
      const { error: eInvalido } = await admin
        .from("integracoes")
        .insert({ nome: uniq("d1-integ"), [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `integracoes.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin
        .from("integracoes")
        .insert({ nome: uniq("d1-integ"), [col]: "x".repeat(limite) } as never);
      expect(eValido, `integracoes.${col} no limite`).toBeNull();
    }
  });

  it("comissao_lancamentos: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["descricao", 2000],
      ["referencia", 150],
      ["seguradora", 150],
    ];

    for (const [col, limite] of campos) {
      const base = {
        vendedor_id: vendedorId,
        tipo: "credito" as const,
        valor: 10,
        descricao: uniq("d1-cclanc"),
      };

      const { error: eInvalido } = await admin
        .from("comissao_lancamentos")
        .insert({ ...base, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `comissao_lancamentos.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin
        .from("comissao_lancamentos")
        .insert({ ...base, descricao: uniq("d1-cclanc"), [col]: "x".repeat(limite) } as never);
      expect(eValido, `comissao_lancamentos.${col} no limite`).toBeNull();
    }
  });
});
