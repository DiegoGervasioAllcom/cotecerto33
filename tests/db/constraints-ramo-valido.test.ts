import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, uniq } from "../helpers/supabase";

/**
 * V12.3.8 — CHECK de valores válidos na coluna `ramo`.
 *
 * 20260925190208_v12_ramo_valido.sql restringe `cotacoes.ramo` e
 * `cotacao_seguro.ramo` ao catálogo de produtos do protótipo V12
 * (`PRODUTOS`/`produtosAtivos`): 'Automóvel', 'Moto', 'Vida', 'Residencial',
 * 'Celular'. `cotacoes.ramo` é `not null default 'Automóvel'` (nunca chega
 * null); `cotacao_seguro.ramo` só é preenchido quando o wizard salva a etapa
 * "Seguro", então o CHECK permite null nessa tabela.
 */
describe("V12.3.8 — CHECK de ramo válido", () => {
  let empresaId: string;
  let userId: string;

  beforeAll(async () => {
    empresaId = (await criarEmpresa()).id;
    const { data: user, error } = await admin.auth.admin.createUser({
      email: `${uniq("ramo-valido-user")}@teste.local`,
      password: "Teste@123!",
      email_confirm: true,
    });
    if (error || !user.user) throw error ?? new Error("falha ao criar usuário de fixture");
    userId = user.user.id;
  });

  async function novaCotacao(ramo?: string): Promise<string> {
    const payload = {
      empresa_id: empresaId,
      responsavel_id: userId,
      ...(ramo !== undefined ? { ramo } : {}),
    };
    const { data, error } = await admin.from("cotacoes").insert(payload).select("id").single();
    if (error || !data) throw error ?? new Error("falha ao criar cotação de fixture");
    return data.id;
  }

  const validos = ["Automóvel", "Moto", "Vida", "Residencial", "Celular"];

  it("cotacoes.ramo: aceita os 5 rótulos do catálogo", async () => {
    for (const ramo of validos) {
      const { error } = await admin
        .from("cotacoes")
        .insert({ empresa_id: empresaId, responsavel_id: userId, ramo });
      expect(error, `cotacoes.ramo='${ramo}'`).toBeNull();
    }
  });

  it("cotacoes.ramo: default (sem informar) continua 'Automóvel'", async () => {
    const { data, error } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId, responsavel_id: userId })
      .select("ramo")
      .single();
    expect(error).toBeNull();
    expect(data?.ramo).toBe("Automóvel");
  });

  it("cotacoes.ramo: rejeita valor fora do catálogo (insert)", async () => {
    const { error } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId, responsavel_id: userId, ramo: "Não existe" });
    expect(error?.code, "cotacoes.ramo inválido").toBe("23514");
  });

  it("cotacoes.ramo: rejeita valor fora do catálogo (update)", async () => {
    const cotId = await novaCotacao();
    const { error } = await admin
      .from("cotacoes")
      .update({ ramo: "auto" } as never)
      .eq("id", cotId);
    expect(error?.code, "cotacoes.ramo inválido no update").toBe("23514");
  });

  it("cotacao_seguro.ramo: aceita null (etapa Seguro ainda não salva)", async () => {
    const cotId = await novaCotacao();
    const { error } = await admin.from("cotacao_seguro").insert({ cotacao_id: cotId });
    expect(error, "cotacao_seguro.ramo=null").toBeNull();
  });

  it("cotacao_seguro.ramo: aceita os 5 rótulos do catálogo", async () => {
    for (const ramo of validos) {
      const cotId = await novaCotacao();
      const { error } = await admin.from("cotacao_seguro").insert({ cotacao_id: cotId, ramo });
      expect(error, `cotacao_seguro.ramo='${ramo}'`).toBeNull();
    }
  });

  it("cotacao_seguro.ramo: rejeita valor fora do catálogo", async () => {
    const cotId = await novaCotacao();
    const { error } = await admin
      .from("cotacao_seguro")
      .insert({ cotacao_id: cotId, ramo: "Empresarial" });
    expect(error?.code, "cotacao_seguro.ramo inválido").toBe("23514");
  });
});
