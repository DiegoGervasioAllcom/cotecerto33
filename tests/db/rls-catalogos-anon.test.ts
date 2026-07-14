import { describe, it, expect } from "vitest";
import { anonClient, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/**
 * S6: `seguradoras`, `planos` e `pipeline_stages` liberavam SELECT para `anon` (grant
 * de tabela + policy `to anon, authenticated using(true)`). `planos` carrega % de
 * comissão e os três são catálogos internos — nenhuma tela pré-login precisa deles.
 *
 * 20260714211602_s6_revogar_anon_catalogos.sql revoga o grant de `anon` e recria as
 * policies só `to authenticated`.
 *
 * Como o bloqueio é por `revoke` de grant de tabela (não só RLS), o PostgREST devolve
 * erro `permission denied for table ...` (code 42501) em vez de lista vazia — validado
 * manualmente contra o local antes de escrever o teste.
 */
describe("RLS/grants — catálogos (seguradoras, planos, pipeline_stages) sem acesso anon", () => {
  const anon: Db = anonClient();

  it.each(["seguradoras", "planos", "pipeline_stages"] as const)(
    "NEGATIVO: anon não lê %s (permission denied)",
    async (tabela) => {
      const { data, error } = await anon.from(tabela).select("*");
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
      expect(data).toBeNull();
    },
  );

  it("POSITIVO: usuário autenticado comum continua lendo os 3 catálogos", async () => {
    const { client } = await criarPersonaComEmpresa("vendedor", { emailPrefix: "s6-vendedor" });

    const seguradoras = await client.from("seguradoras").select("id");
    expect(seguradoras.error).toBeNull();
    expect((seguradoras.data ?? []).length).toBeGreaterThan(0);

    const planos = await client.from("planos").select("id");
    expect(planos.error).toBeNull();
    // planos não tem seed garantido; só assegura que a leitura não é bloqueada.
    expect(planos.data).not.toBeNull();

    const pipelineStages = await client.from("pipeline_stages").select("id");
    expect(pipelineStages.error).toBeNull();
    expect((pipelineStages.data ?? []).length).toBeGreaterThan(0);
  });
});
