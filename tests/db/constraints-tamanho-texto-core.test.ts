import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarUsuario, uniq, uniqDoc } from "../helpers/supabase";

/**
 * D1 (PR 1/3) — limites de char_length no CRM core.
 *
 * 20260715183042_d1_check_tamanho_texto_core.sql adiciona CHECK
 * `char_length(<col>) <= <n>` (defesa em profundidade) em colunas de texto
 * de empresas, profiles, pipeline_stages, clientes, leads, oportunidades e
 * propostas. Colunas nullable seguem nullable — o CHECK passa em NULL.
 *
 * Cada assert testa o par limite (aceita) / limite+1 (rejeita, 23514).
 * Usa `admin` (service_role) para inserir direto, sem interferência de RLS.
 */
describe("D1 — CHECK de char_length no CRM core", () => {
  let empresaId: string;
  let userId: string;
  let ordemSeq: number;

  beforeAll(async () => {
    const emp = await criarEmpresa({ nome: uniq("Empresa D1") });
    empresaId = emp.id;

    const { userId: uid } = await criarUsuario(`${uniq("d1-profile")}@teste.local`);
    userId = uid;

    ordemSeq = Math.floor(Date.now() / 1000);
  });

  // documento/celular/telefone/telefone_recado/socio_cpf/email migraram para
  // constraints-normalizacao-documentos.test.ts (D3.1: normalização + formato).
  it("empresas: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["nome", 150],
      ["endereco", 2000],
      ["socio_nome", 150],
      ["socio_rg", 20],
      ["rg", 20],
      ["contato_emergencia", 2000],
      ["pix_chave", 150],
      ["dados_bancarios", 2000],
      ["cidade", 150],
      ["uf", 2],
      ["recusa_motivo", 2000],
    ];

    for (const [col, limite] of campos) {
      const base = {
        nome: uniq(`d1-emp-${col}`),
        tipo: "pj" as const,
        documento: uniqDoc(),
      };

      const { error: eInvalido } = await admin
        .from("empresas")
        .insert({ ...base, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `empresas.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin
        .from("empresas")
        .insert({ ...base, documento: uniqDoc(), [col]: "x".repeat(limite) } as never);
      expect(eValido, `empresas.${col} no limite`).toBeNull();
    }
  });

  // email migrou para constraints-normalizacao-documentos.test.ts (D3.1: formato).
  it("profiles: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["nome", 150],
      ["avatar_url", 2000],
      ["desligado_motivo", 2000],
    ];

    for (const [col, limite] of campos) {
      const { error: eInvalido } = await admin
        .from("profiles")
        .update({ [col]: "x".repeat(limite + 1) } as never)
        .eq("id", userId);
      expect(eInvalido?.code, `profiles.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin
        .from("profiles")
        .update({ [col]: "x".repeat(limite) } as never)
        .eq("id", userId);
      expect(eValido, `profiles.${col} no limite`).toBeNull();
    }
  });

  it("pipeline_stages: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["nome", 150],
      ["cor", 20],
    ];

    for (const [col, limite] of campos) {
      const { error: eInvalido } = await admin.from("pipeline_stages").insert({
        ordem: ordemSeq++,
        nome: uniq("d1-stage"),
        [col]: "x".repeat(limite + 1),
      } as never);
      expect(eInvalido?.code, `pipeline_stages.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin.from("pipeline_stages").insert({
        ordem: ordemSeq++,
        nome: uniq("d1-stage"),
        [col]: "x".repeat(limite),
      } as never);
      expect(eValido, `pipeline_stages.${col} no limite`).toBeNull();
    }
  });

  // documento/telefone/email migraram para constraints-normalizacao-documentos.test.ts
  // (D3.1: normalização + formato).
  it("clientes: limites de texto", async () => {
    const campos: Array<[string, number]> = [["nome", 150]];

    for (const [col, limite] of campos) {
      const { error: eInvalido } = await admin.from("clientes").insert({
        empresa_id: empresaId,
        nome: uniq("d1-cliente"),
        [col]: "x".repeat(limite + 1),
      } as never);
      expect(eInvalido?.code, `clientes.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin.from("clientes").insert({
        empresa_id: empresaId,
        nome: uniq("d1-cliente"),
        [col]: "x".repeat(limite),
      } as never);
      expect(eValido, `clientes.${col} no limite`).toBeNull();
    }
  });

  it("leads: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["origem", 150],
      ["nome", 150],
      ["contato", 150],
      ["motivo_bloqueio", 2000],
    ];

    for (const [col, limite] of campos) {
      const { error: eInvalido } = await admin
        .from("leads")
        .insert({ empresa_id: empresaId, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `leads.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin
        .from("leads")
        .insert({ empresa_id: empresaId, [col]: "x".repeat(limite) } as never);
      expect(eValido, `leads.${col} no limite`).toBeNull();
    }
  });

  it("oportunidades: limites de texto", async () => {
    const { error: eInvalido } = await admin
      .from("oportunidades")
      .insert({ empresa_id: empresaId, observacao: "x".repeat(2001) });
    expect(eInvalido?.code, "oportunidades.observacao limite+1").toBe("23514");

    const { error: eValido } = await admin
      .from("oportunidades")
      .insert({ empresa_id: empresaId, observacao: "x".repeat(2000) });
    expect(eValido, "oportunidades.observacao no limite").toBeNull();
  });

  it("propostas: limites de texto", async () => {
    const campos: Array<[string, number]> = [
      ["numero", 50],
      ["status", 30],
      ["apolice_numero", 50],
      ["tipo_venda", 30],
      ["forma_pagamento", 50],
      ["cancelamento_motivo", 2000],
      ["seguradora", 150],
      ["transmissao_obs", 2000],
    ];

    for (const [col, limite] of campos) {
      const { error: eInvalido } = await admin
        .from("propostas")
        .insert({ empresa_id: empresaId, [col]: "x".repeat(limite + 1) } as never);
      expect(eInvalido?.code, `propostas.${col} limite+1`).toBe("23514");

      const { error: eValido } = await admin
        .from("propostas")
        .insert({ empresa_id: empresaId, [col]: "x".repeat(limite) } as never);
      expect(eValido, `propostas.${col} no limite`).toBeNull();
    }
  });
});
