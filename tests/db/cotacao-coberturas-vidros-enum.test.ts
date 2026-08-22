import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa } from "../helpers/supabase";
import type { Db } from "../helpers/supabase";

/**
 * "Vidros, faróis e retrovisores" — 20260821010000_vidros_farois_retrovisores_enum.sql
 *
 * A coluna `cotacao_coberturas.vidros` deixou de ser boolean e virou texto
 * restrito aos 4 níveis do select do front (que bate com o enum que o robô
 * Playwright da Quiver espera): 'Não contratada' / 'Básico' /
 * 'Intermediário' / 'Superior'. A RPC `salvar_cotacao_rascunho` normaliza o
 * valor recebido (via `_normalizar_vidros`) em vez de fazer `::boolean`.
 */
describe("cotacao_coberturas.vidros — enum de 4 níveis", () => {
  let client: Db;
  let empresaId: string;
  let userId: string;

  beforeAll(async () => {
    const persona = await criarPersonaComEmpresa("vendedor");
    client = persona.client;
    empresaId = persona.empresaId;
    userId = persona.userId;
  });

  function payload(vidros: string | null) {
    return {
      step_atual: 5,
      segurado: { nome: "Fixture Vidros" },
      seguro: {},
      veiculo: {},
      perfil: {},
      coberturas: { vidros },
    } as never;
  }

  it("persiste cada um dos 4 valores válidos", async () => {
    for (const nivel of ["Não contratada", "Básico", "Intermediário", "Superior"]) {
      const { data: cotId, error } = await client.rpc("salvar_cotacao_rascunho", {
        p_cotacao_id: null as unknown as string,
        p_payload: payload(nivel),
      });
      expect(error, `salvar nível ${nivel}`).toBeNull();

      const { data: cob, error: eSelect } = await admin
        .from("cotacao_coberturas")
        .select("vidros")
        .eq("cotacao_id", cotId as string)
        .single();
      expect(eSelect).toBeNull();
      expect(cob?.vidros).toBe(nivel);
    }
  });

  it("normaliza o formato boolean legado ('true'/'false') vindo de rascunhos antigos", async () => {
    const { data: cotIdTrue, error: e1 } = await client.rpc("salvar_cotacao_rascunho", {
      p_cotacao_id: null as unknown as string,
      p_payload: payload("true"),
    });
    expect(e1).toBeNull();
    const { data: cobTrue } = await admin
      .from("cotacao_coberturas")
      .select("vidros")
      .eq("cotacao_id", cotIdTrue as string)
      .single();
    expect(cobTrue?.vidros).toBe("Superior");

    const { data: cotIdFalse, error: e2 } = await client.rpc("salvar_cotacao_rascunho", {
      p_cotacao_id: null as unknown as string,
      p_payload: payload("false"),
    });
    expect(e2).toBeNull();
    const { data: cobFalse } = await admin
      .from("cotacao_coberturas")
      .select("vidros")
      .eq("cotacao_id", cotIdFalse as string)
      .single();
    expect(cobFalse?.vidros).toBe("Não contratada");
  });

  it("valor ausente/vazio vira 'Não contratada'", async () => {
    const { data: cotId, error } = await client.rpc("salvar_cotacao_rascunho", {
      p_cotacao_id: null as unknown as string,
      p_payload: payload(null),
    });
    expect(error).toBeNull();
    const { data: cob } = await admin
      .from("cotacao_coberturas")
      .select("vidros")
      .eq("cotacao_id", cotId as string)
      .single();
    expect(cob?.vidros).toBe("Não contratada");
  });

  it("rejeita valor fora do enum via insert direto (CHECK constraint)", async () => {
    const { data: cotacao, error: eCot } = await admin
      .from("cotacoes")
      .insert({ empresa_id: empresaId, responsavel_id: userId })
      .select("id")
      .single();
    expect(eCot).toBeNull();

    const { error } = await admin
      .from("cotacao_coberturas")
      .insert({ cotacao_id: cotacao!.id, vidros: "Nível Inexistente" } as never);
    expect(error?.code).toBe("23514");
  });
});
