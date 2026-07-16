import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, uniq } from "../helpers/supabase";

/**
 * D1 (PR 3/3) — limites de char_length em auditoria (presença/leads/login) e
 * no wizard de cotação.
 *
 * 20260716120000_d1_check_tamanho_texto_auditoria_cotacao.sql adiciona CHECK
 * `char_length(<col>) <= <n>` (defesa em profundidade) em colunas de texto
 * livre de user_presence, presence_eventos, lead_eventos, login_audit,
 * leads.destino_perda_final, cotacoes e das seções do wizard
 * (cotacao_segurado/seguro/veiculo/perfil/coberturas/premios).
 * leads.destino_perda_final é irmã de cotacoes.destino_perda_sugerido/
 * destino_perda (não existe destino_perda_final em cotacoes).
 *
 * Colunas puladas (já têm `check in (...)`, redundante adicionar
 * char_length): user_presence.status, presence_eventos.tipo.
 *
 * As tabelas `cotacao_segurado/seguro/veiculo/perfil/coberturas` são 1:1 com
 * `cotacoes` (PK = cotacao_id). Cada assert de uma dessas seções cria uma
 * cotação nova (helper `novaCotacao`) para não colidir com o `primary key`.
 * `cotacao_premios` é 1:N, então reaproveita uma única cotação fixture.
 * Nenhuma coluna testada aqui tem `unique` constraint.
 *
 * Cada assert testa o par limite (aceita) / limite+1 (rejeita, 23514). Usa
 * `admin` (service_role) para inserir direto, sem interferência de RLS.
 */
describe("D1 — CHECK de char_length em auditoria e cotação", () => {
  let empresaId: string;
  let userId: string;

  beforeAll(async () => {
    empresaId = (await criarEmpresa()).id;
    const { data: user, error } = await admin.auth.admin.createUser({
      email: `${uniq("d1-cot-user")}@teste.local`,
      password: "Teste@123!",
      email_confirm: true,
    });
    if (error || !user.user) throw error ?? new Error("falha ao criar usuário de fixture");
    userId = user.user.id;
  });

  async function novaCotacao(): Promise<string> {
    const { data, error } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId, responsavel_id: userId })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("falha ao criar cotação de fixture");
    return data.id;
  }

  it("user_presence: limite de user_agent", async () => {
    const { data: user, error: eUser } = await admin.auth.admin.createUser({
      email: `${uniq("d1-presence")}@teste.local`,
      password: "Teste@123!",
      email_confirm: true,
    });
    if (eUser || !user.user) throw eUser ?? new Error("falha ao criar usuário");

    const { error: eInvalido } = await admin
      .from("user_presence")
      .upsert({ user_id: user.user.id, user_agent: "x".repeat(501) });
    expect(eInvalido?.code, "user_presence.user_agent limite+1").toBe("23514");

    const { error: eValido } = await admin
      .from("user_presence")
      .upsert({ user_id: user.user.id, user_agent: "x".repeat(500) });
    expect(eValido, "user_presence.user_agent no limite").toBeNull();
  });

  it("presence_eventos: limite de user_agent", async () => {
    const { error: eInvalido } = await admin
      .from("presence_eventos")
      .insert({ user_id: userId, tipo: "entrou", user_agent: "x".repeat(501) });
    expect(eInvalido?.code, "presence_eventos.user_agent limite+1").toBe("23514");

    const { error: eValido } = await admin
      .from("presence_eventos")
      .insert({ user_id: userId, tipo: "entrou", user_agent: "x".repeat(500) });
    expect(eValido, "presence_eventos.user_agent no limite").toBeNull();
  });

  it("lead_eventos: limites de texto", async () => {
    const { data: lead, error: eLead } = await admin
      .from("leads")
      .insert({ empresa_id: empresaId, responsavel_id: userId, nome: uniq("d1-lead") })
      .select("id")
      .single();
    if (eLead || !lead) throw eLead ?? new Error("falha ao criar lead");

    const campos: Array<[string, number]> = [
      ["titulo", 150],
      ["descricao", 2000],
      ["tipo", 50],
    ];

    for (const [col, limite] of campos) {
      const base = { lead_id: lead.id, tipo: "nota", titulo: "titulo base" };

      const { error: eInvalido } = await admin
        .from("lead_eventos")
        .insert({ ...base, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `lead_eventos.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin
        .from("lead_eventos")
        .insert({ ...base, [col]: "x".repeat(limite) } as never);
      expect(eValido, `lead_eventos.${col} no limite`).toBeNull();
    }
  });

  it("leads: limite de destino_perda_final", async () => {
    const { data: lead, error: eLead } = await admin
      .from("leads")
      .insert({ empresa_id: empresaId, responsavel_id: userId, nome: uniq("d1-lead-perda") })
      .select("id")
      .single();
    if (eLead || !lead) throw eLead ?? new Error("falha ao criar lead");

    const { error: eInvalido } = await admin
      .from("leads")
      .update({ destino_perda_final: "x".repeat(31) } as never)
      .eq("id", lead.id);
    expect(eInvalido?.code, "leads.destino_perda_final limite+1").toBe("23514");

    const { error: eValido } = await admin
      .from("leads")
      .update({ destino_perda_final: "x".repeat(30) } as never)
      .eq("id", lead.id);
    expect(eValido, "leads.destino_perda_final no limite").toBeNull();
  });

  it("login_audit: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["email", 254],
      ["motivo_falha", 500],
      ["ip", 45],
      ["user_agent", 500],
    ];

    for (const [col, limite] of campos) {
      const base = { email: "base@teste.local", sucesso: false };

      const { error: eInvalido } = await admin
        .from("login_audit")
        .insert({ ...base, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `login_audit.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin
        .from("login_audit")
        .insert({ ...base, [col]: "x".repeat(limite) } as never);
      expect(eValido, `login_audit.${col} no limite`).toBeNull();
    }
  });

  it("cotacoes: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["ramo", 150],
      ["motivo_perda", 150],
      ["submotivo_perda", 150],
      ["observacao_perda", 2000],
      ["destino_perda_sugerido", 30],
      ["destino_perda", 30],
    ];

    for (const [col, limite] of campos) {
      const { error: eInvalido } = await admin.from("cotacoes").insert({
        empresa_id: empresaId,
        responsavel_id: userId,
        [col]: "x".repeat(limite + 1),
      } as never);
      expect(eInvalido?.code, `cotacoes.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin.from("cotacoes").insert({
        empresa_id: empresaId,
        responsavel_id: userId,
        [col]: "x".repeat(limite),
      } as never);
      expect(eValido, `cotacoes.${col} no limite`).toBeNull();
    }
  });

  it("cotacao_segurado: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["cpf_cnpj", 20],
      ["nome", 150],
      ["nome_social", 150],
      ["sexo", 30],
      ["estado_civil", 30],
      ["pessoa", 20],
      ["celular", 20],
      ["tel_res", 20],
      ["email", 254],
      ["cep", 9],
      ["logradouro", 2000],
      ["bairro", 2000],
      ["cidade", 150],
      ["uf", 2],
    ];

    for (const [col, limite] of campos) {
      const cotIdInvalido = await novaCotacao();
      const { error: eInvalido } = await admin
        .from("cotacao_segurado")
        .insert({ cotacao_id: cotIdInvalido, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `cotacao_segurado.${col} limite+1`).toBe("23514");

      const cotIdValido = await novaCotacao();
      const { error: eValido } = await admin
        .from("cotacao_segurado")
        .insert({ cotacao_id: cotIdValido, [col]: "x".repeat(limite) } as never);
      expect(eValido, `cotacao_segurado.${col} no limite`).toBeNull();
    }
  });

  it("cotacao_seguro: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["tipo_seguro", 50],
      ["categoria", 50],
      ["ramo", 150],
      ["cia_atual", 150],
      ["ci_atual", 150],
      ["classe_bonus", 150],
      ["apolice_atual", 50],
    ];

    for (const [col, limite] of campos) {
      const cotIdInvalido = await novaCotacao();
      const { error: eInvalido } = await admin
        .from("cotacao_seguro")
        .insert({ cotacao_id: cotIdInvalido, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `cotacao_seguro.${col} limite+1`).toBe("23514");

      const cotIdValido = await novaCotacao();
      const { error: eValido } = await admin
        .from("cotacao_seguro")
        .insert({ cotacao_id: cotIdValido, [col]: "x".repeat(limite) } as never);
      expect(eValido, `cotacao_seguro.${col} no limite`).toBeNull();
    }
  });

  it("cotacao_veiculo: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["placa", 8],
      ["chassi", 17],
      ["renavam", 11],
      ["marca_codigo", 20],
      ["modelo_codigo", 20],
      ["marca_nome", 150],
      ["modelo_nome", 150],
      ["ano_modelo", 4],
      ["ano_fab", 4],
      ["combustivel", 50],
      ["cor", 50],
      ["banco", 150],
      ["uso_comercial", 50],
      ["km_mensal", 100],
      ["fipe_valor", 100],
    ];

    for (const [col, limite] of campos) {
      const cotIdInvalido = await novaCotacao();
      const { error: eInvalido } = await admin
        .from("cotacao_veiculo")
        .insert({ cotacao_id: cotIdInvalido, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `cotacao_veiculo.${col} limite+1`).toBe("23514");

      const cotIdValido = await novaCotacao();
      const { error: eValido } = await admin
        .from("cotacao_veiculo")
        .insert({ cotacao_id: cotIdValido, [col]: "x".repeat(limite) } as never);
      expect(eValido, `cotacao_veiculo.${col} no limite`).toBeNull();
    }
  });

  it("cotacao_perfil: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["cond_cpf", 20],
      ["cond_nome", 150],
      ["cond_sexo", 30],
      ["cond_estado_civil", 30],
      ["profissao", 150],
      ["cep_pernoite", 9],
    ];

    for (const [col, limite] of campos) {
      const cotIdInvalido = await novaCotacao();
      const { error: eInvalido } = await admin
        .from("cotacao_perfil")
        .insert({ cotacao_id: cotIdInvalido, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `cotacao_perfil.${col} limite+1`).toBe("23514");

      const cotIdValido = await novaCotacao();
      const { error: eValido } = await admin
        .from("cotacao_perfil")
        .insert({ cotacao_id: cotIdValido, [col]: "x".repeat(limite) } as never);
      expect(eValido, `cotacao_perfil.${col} no limite`).toBeNull();
    }
  });

  it("cotacao_coberturas: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["tipo_cobertura", 50],
      ["casco", 100],
      ["casco_valor", 100],
      ["franquia", 100],
      ["app_morte", 100],
      ["app_invalidez", 100],
      ["dmh", 100],
      ["rcf_dm", 100],
      ["rcf_dc", 100],
      ["carro_reserva", 30],
      ["assist_24", 30],
    ];

    for (const [col, limite] of campos) {
      const cotIdInvalido = await novaCotacao();
      const { error: eInvalido } = await admin
        .from("cotacao_coberturas")
        .insert({ cotacao_id: cotIdInvalido, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `cotacao_coberturas.${col} limite+1`).toBe("23514");

      const cotIdValido = await novaCotacao();
      const { error: eValido } = await admin
        .from("cotacao_coberturas")
        .insert({ cotacao_id: cotIdValido, [col]: "x".repeat(limite) } as never);
      expect(eValido, `cotacao_coberturas.${col} no limite`).toBeNull();
    }
  });

  it("cotacao_premios: limites de texto", async () => {
    const cotId = await novaCotacao();
    const campos: Array<[string, number]> = [
      ["seguradora", 150],
      ["cobertura", 2000],
    ];

    for (const [col, limite] of campos) {
      const base = { cotacao_id: cotId, seguradora: "seguradora base" };

      const { error: eInvalido } = await admin
        .from("cotacao_premios")
        .insert({ ...base, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `cotacao_premios.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin
        .from("cotacao_premios")
        .insert({ ...base, [col]: "x".repeat(limite) } as never);
      expect(eValido, `cotacao_premios.${col} no limite`).toBeNull();
    }
  });
});
