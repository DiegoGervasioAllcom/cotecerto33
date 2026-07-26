import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, type Db } from "../helpers/supabase";

/**
 * Segurança da integração com a Quiver (Fase 6): `registrar_premios_quiver`
 * (20260722205124_g1_5b_quiver_integracao.sql) é a RPC que o webhook receiver
 * (`/api/webhooks/quiver`, fora da sessão de usuário) usa pra gravar o
 * resultado do cálculo assim que a automação termina.
 *
 * `revoke all ... from public, anon, authenticated` + `grant ... to service_role`
 * (linhas 84-85 da migration): nenhum usuário autenticado — nem o próprio
 * responsável pela cotação — deve conseguir "forjar" um resultado chamando a
 * RPC direto via `supabase.rpc(...)` do client. A única camada de autorização
 * real é o segredo compartilhado (`x-client-key`/`x-client-secret`) validado
 * no endpoint HTTP, que então usa o client de `service_role` (mesmo cliente do
 * `admin` destes testes) pra chamar a função.
 */
describe("RLS registrar_premios_quiver — só service_role, nunca authenticated", () => {
  let vendedorA: Db;
  let vendedorAId: string;
  let cotacaoId: string;

  beforeAll(async () => {
    const emp = await criarEmpresa({ nome: "Empresa Quiver RLS" });
    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: emp.id,
      emailPrefix: "vend-quiver-rls",
    });
    vendedorA = v1.client;
    vendedorAId = v1.userId;

    const { data: cot, error } = await admin
      .from("cotacoes")
      .insert({ empresa_id: emp.id, responsavel_id: vendedorAId, status: "enviada_quiver" })
      .select("id")
      .single();
    if (error) throw error;
    cotacaoId = cot.id;
  });

  it("NEGATIVO: o próprio responsável pela cotação não consegue chamar a RPC (forjar resultado)", async () => {
    const { error } = await vendedorA.rpc("registrar_premios_quiver", {
      p_cotacao_id: cotacaoId,
      p_payload: {
        temPremios: true,
        cards: [{ seguradora: "Forjado", opcoes: [{ tipo: "Compreensiva", avista: "1,00" }] }],
      } as never,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/permission denied/i);

    const { data: real } = await admin
      .from("cotacoes")
      .select("status")
      .eq("id", cotacaoId)
      .single();
    expect(real?.status).toBe("enviada_quiver");

    const { data: premios } = await admin
      .from("cotacao_premios")
      .select("seguradora")
      .eq("cotacao_id", cotacaoId);
    expect(premios ?? []).toHaveLength(0);
  });

  it("POSITIVO: service_role grava o resultado corretamente (caminho real do webhook)", async () => {
    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: cotacaoId,
      p_payload: {
        temPremios: true,
        cards: [
          {
            seguradora: "Porto",
            opcoes: [{ tipo: "Compreensiva", avista: "1.234,56" }],
          },
        ],
      } as never,
    });
    expect(error).toBeNull();

    const { data: cot } = await admin
      .from("cotacoes")
      .select("status")
      .eq("id", cotacaoId)
      .single();
    expect(cot?.status).toBe("calculada");

    const { data: premios } = await admin
      .from("cotacao_premios")
      .select("seguradora,cobertura,premio")
      .eq("cotacao_id", cotacaoId);
    expect(premios).toHaveLength(1);
    expect(premios?.[0].seguradora).toBe("Porto");
    expect(premios?.[0].cobertura).toBe("Compreensiva");
    expect(Number(premios?.[0].premio)).toBe(1234.56);
  });

  it("POSITIVO: service_role grava erro_quiver quando temPremios=false (placa não encontrada)", async () => {
    const { data: cot2, error: eCot } = await admin
      .from("cotacoes")
      .insert({
        empresa_id: (await criarEmpresa({ nome: "Empresa Quiver RLS 2" })).id,
        responsavel_id: vendedorAId,
        status: "enviada_quiver",
      })
      .select("id")
      .single();
    if (eCot) throw eCot;

    const { error } = await admin.rpc("registrar_premios_quiver", {
      p_cotacao_id: cot2.id,
      p_payload: { temPremios: false, placaNaoEncontrada: true } as never,
    });
    expect(error).toBeNull();

    const { data: real } = await admin
      .from("cotacoes")
      .select("status,quiver_mensagem")
      .eq("id", cot2.id)
      .single();
    expect(real?.status).toBe("erro_quiver");
    expect(real?.quiver_mensagem).toMatch(/placa/i);
  });
});
