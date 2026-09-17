import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarEmpresa, criarPersonaComEmpresa, uniqDoc, type Db } from "../helpers/supabase";

/**
 * RLS da Etapa 7 (Transmissão) — migration
 * 20260908152312_etapa7_transmissao_dados_complementares.sql.
 *
 *  - proposta_dados_complementares (1:1 com propostas):
 *    - select: dono da proposta (responsavel_id) OU mesma empresa OU matriz/master.
 *    - write (insert/update, policy "for all"): dono da proposta OU matriz OU
 *      supervisor (via profiles.superior_id do responsável apontando pro supervisor).
 *      Master NÃO entra na policy de write — só na de select.
 *  - proposta_boletos: select mesmo padrão de proposta_dados_complementares;
 *    escrita só service_role (authenticated não tem grant de insert/update).
 *  - constraints de faixa: parcelas 1-12, dia_vencimento 1-31, valor_parcela>0,
 *    renda_mensal>0 (em proposta_dados_complementares).
 *  - profiles.pode_transmitir: trigger bloqueia auto-alteração por quem não é
 *    matriz/supervisor; matriz/supervisor da cadeia conseguem alterar de terceiros
 *    somente via RPC `definir_pode_transmitir` (migration
 *    20260908160000_fix_etapa7_gaps_rls_supervisor.sql) — UPDATE direto de
 *    `profiles` por supervisor continua barrado pela RLS (por desenho: a RPC
 *    é o único caminho, para não abrir UPDATE geral de profiles a supervisor).
 *
 * Correção 20260908160000 (gaps reportados pelo agente `testes`):
 *  - a policy de write de `proposta_dados_complementares` não depende mais de
 *    `propostas` estar visível via `prop_select` para o chamador — usa a
 *    function `security definer` `pode_editar_dados_complementares`, que
 *    bypassa RLS internamente. Por isso supervisor de OUTRA empresa (cadeia
 *    cross-empresa) agora consegue editar, mesmo sem enxergar a proposta pela
 *    RLS normal de `propostas`.
 */
describe("RLS Etapa 7 — proposta_dados_complementares / proposta_boletos / pode_transmitir", () => {
  let empresaA: string;
  let vendedorA: Db;
  let vendedorAId: string;

  let vendedorB: Db; // mesma empresa que A, sem relação de posse
  let vendedorBId: string;

  let matriz: Db;
  let master: Db;

  let supervisorA: Db; // superior direto do vendedorA
  let supervisorAId: string;
  let supervisorOutro: Db; // supervisor sem relação com vendedorA

  let propostaAId: string;

  beforeAll(async () => {
    const emp = await criarEmpresa({ nome: "Empresa Etapa7 A" });
    empresaA = emp.id;

    const mst = await criarPersonaComEmpresa("master", { emailPrefix: "master-etapa7" });
    master = mst.client;
    const masterAId = mst.userId;

    // supervisorA fica em EMPRESA DIFERENTE do vendedor que supervisiona —
    // cenário real de cadeia multinível (supervisor acima de vendedores de
    // franquias diferentes). Antes da correção 20260908160000 isso não
    // funcionava (gap real, ver histórico); agora a policy de write não
    // depende mais de `propostas` estar visível via `prop_select`.
    const empOutra = await criarEmpresa({ nome: "Empresa Etapa7 Supervisor" });
    const sup = await criarPersonaComEmpresa("supervisor", {
      empresaId: empOutra.id,
      emailPrefix: "sup-etapa7-a",
      superiorId: masterAId,
    });
    supervisorA = sup.client;
    supervisorAId = sup.userId;

    const v1 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaA,
      emailPrefix: "vend-etapa7-a",
      superiorId: supervisorAId,
    });
    vendedorA = v1.client;
    vendedorAId = v1.userId;

    const v2 = await criarPersonaComEmpresa("vendedor", {
      empresaId: empresaA,
      emailPrefix: "vend-etapa7-b",
    });
    vendedorB = v2.client;
    vendedorBId = v2.userId;

    const m = await criarPersonaComEmpresa("matriz", { emailPrefix: "matriz-etapa7" });
    matriz = m.client;

    const supOutro = await criarPersonaComEmpresa("supervisor", {
      emailPrefix: "sup-etapa7-outro",
    });
    supervisorOutro = supOutro.client;

    const { data: prop, error: eProp } = await admin
      .from("propostas")
      .insert({ empresa_id: empresaA, responsavel_id: vendedorAId, numero: uniqDoc() })
      .select("id")
      .single();
    if (eProp) throw eProp;
    propostaAId = prop.id;
  });

  describe("proposta_dados_complementares — select", () => {
    it("POSITIVO: dono da proposta lê seus dados complementares", async () => {
      await admin
        .from("proposta_dados_complementares")
        .upsert({ proposta_id: propostaAId, rg: "1234567" });

      const { data, error } = await vendedorA
        .from("proposta_dados_complementares")
        .select("proposta_id")
        .eq("proposta_id", propostaAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("POSITIVO: matriz lê dados complementares de qualquer proposta", async () => {
      const { data, error } = await matriz
        .from("proposta_dados_complementares")
        .select("proposta_id")
        .eq("proposta_id", propostaAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("POSITIVO: master lê dados complementares de qualquer proposta", async () => {
      const { data, error } = await master
        .from("proposta_dados_complementares")
        .select("proposta_id")
        .eq("proposta_id", propostaAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("POSITIVO: colega de empresa (sem cargo especial) LÊ, pois a policy de select inclui mesma empresa", async () => {
      const { data, error } = await vendedorB
        .from("proposta_dados_complementares")
        .select("proposta_id")
        .eq("proposta_id", propostaAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });

  describe("proposta_dados_complementares — write (insert/update)", () => {
    it("POSITIVO: dono da proposta insere/atualiza seus dados complementares", async () => {
      const { data, error } = await vendedorA
        .from("proposta_dados_complementares")
        .upsert({ proposta_id: propostaAId, rg: "7654321" })
        .select("rg")
        .single();
      expect(error).toBeNull();
      expect(data?.rg).toBe("7654321");
    });

    it("NEGATIVO: vendedor B (mesma empresa, sem cargo especial, não é o dono) NÃO escreve", async () => {
      const { data, error } = await vendedorB
        .from("proposta_dados_complementares")
        .update({ rg: "FORJADO" })
        .eq("proposta_id", propostaAId)
        .select("rg");
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);

      const { data: real } = await admin
        .from("proposta_dados_complementares")
        .select("rg")
        .eq("proposta_id", propostaAId)
        .single();
      expect(real?.rg).not.toBe("FORJADO");
    });

    it("POSITIVO: matriz escreve em dados complementares de qualquer proposta", async () => {
      const { data, error } = await matriz
        .from("proposta_dados_complementares")
        .update({ rg: "MATRIZ-OK" })
        .eq("proposta_id", propostaAId)
        .select("rg")
        .single();
      expect(error).toBeNull();
      expect(data?.rg).toBe("MATRIZ-OK");
    });

    it("NEGATIVO: master NÃO escreve em dados complementares (policy de write não inclui master)", async () => {
      const { data, error } = await master
        .from("proposta_dados_complementares")
        .update({ rg: "MASTER-FORJADO" })
        .eq("proposta_id", propostaAId)
        .select("rg");
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);

      const { data: real } = await admin
        .from("proposta_dados_complementares")
        .select("rg")
        .eq("proposta_id", propostaAId)
        .single();
      expect(real?.rg).not.toBe("MASTER-FORJADO");
    });

    it("POSITIVO: supervisor direto do responsável, mesmo de OUTRA empresa (via profiles.superior_id), escreve", async () => {
      const { data, error } = await supervisorA
        .from("proposta_dados_complementares")
        .update({ rg: "SUPERVISOR-OK" })
        .eq("proposta_id", propostaAId)
        .select("rg")
        .single();
      expect(error).toBeNull();
      expect(data?.rg).toBe("SUPERVISOR-OK");
    });

    it("NEGATIVO: supervisor de OUTRA cadeia (não é superior do responsável) NÃO escreve", async () => {
      const { data, error } = await supervisorOutro
        .from("proposta_dados_complementares")
        .update({ rg: "SUP-OUTRO-FORJADO" })
        .eq("proposta_id", propostaAId)
        .select("rg");
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);

      const { data: real } = await admin
        .from("proposta_dados_complementares")
        .select("rg")
        .eq("proposta_id", propostaAId)
        .single();
      expect(real?.rg).not.toBe("SUP-OUTRO-FORJADO");
    });
  });

  describe("proposta_boletos — select amplo, escrita só service_role", () => {
    let boletoId: string;

    beforeAll(async () => {
      const { data, error } = await admin
        .from("proposta_boletos")
        .insert({
          proposta_id: propostaAId,
          parcela_numero: 1,
          vencimento: "2026-10-10",
          valor: 199.9,
        })
        .select("id")
        .single();
      if (error) throw error;
      boletoId = data.id;
    });

    it("POSITIVO: service_role insere/atualiza boleto (simula webhook da seguradora)", async () => {
      const { data, error } = await admin
        .from("proposta_boletos")
        .update({ status: "gerado" })
        .eq("id", boletoId)
        .select("status")
        .single();
      expect(error).toBeNull();
      expect(data?.status).toBe("gerado");
    });

    it("POSITIVO: dono da proposta LÊ o boleto", async () => {
      const { data, error } = await vendedorA
        .from("proposta_boletos")
        .select("id")
        .eq("id", boletoId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("NEGATIVO: authenticated comum (mesmo dono da proposta) NÃO insere boleto", async () => {
      const { error } = await vendedorA.from("proposta_boletos").insert({
        proposta_id: propostaAId,
        parcela_numero: 2,
        vencimento: "2026-11-10",
        valor: 199.9,
      });
      expect(error).not.toBeNull();
    });

    it("NEGATIVO: authenticated comum (mesmo dono da proposta) NÃO atualiza boleto", async () => {
      const { data, error } = await vendedorA
        .from("proposta_boletos")
        .update({ status: "pago" })
        .eq("id", boletoId)
        .select("status");
      // Sem grant de update, o Postgres já barra por permissão de coluna/tabela
      // (não chega nem a filtrar por RLS) — ou filtra e devolve 0 linhas.
      if (error) {
        expect(error).not.toBeNull();
      } else {
        expect(data ?? []).toHaveLength(0);
      }
      const { data: real } = await admin
        .from("proposta_boletos")
        .select("status")
        .eq("id", boletoId)
        .single();
      expect(real?.status).not.toBe("pago");
    });
  });

  describe("checks de faixa em proposta_dados_complementares", () => {
    it("NEGATIVO: renda_mensal <= 0 é rejeitada", async () => {
      const { error } = await admin
        .from("proposta_dados_complementares")
        .update({ renda_mensal: 0 })
        .eq("proposta_id", propostaAId);
      expect(error).not.toBeNull();
    });
  });

  describe("checks de faixa em propostas (parcelas/dia_vencimento/valor_parcela)", () => {
    it("NEGATIVO: parcelas fora de 1-12 é rejeitado", async () => {
      const { error } = await admin
        .from("propostas")
        .update({ parcelas: 13 })
        .eq("id", propostaAId);
      expect(error).not.toBeNull();
    });

    it("NEGATIVO: dia_vencimento fora de 1-31 é rejeitado", async () => {
      const { error } = await admin
        .from("propostas")
        .update({ dia_vencimento: 32 })
        .eq("id", propostaAId);
      expect(error).not.toBeNull();
    });

    it("NEGATIVO: valor_parcela <= 0 é rejeitado", async () => {
      const { error } = await admin
        .from("propostas")
        .update({ valor_parcela: 0 })
        .eq("id", propostaAId);
      expect(error).not.toBeNull();
    });
  });

  describe("profiles.pode_transmitir — trigger de auto-alteração", () => {
    it("NEGATIVO: vendedor comum não consegue desligar a própria flag", async () => {
      const { error } = await vendedorB
        .from("profiles")
        .update({ pode_transmitir: false })
        .eq("id", vendedorBId);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/própria permissão de transmissão/i);

      const { data: real } = await admin
        .from("profiles")
        .select("pode_transmitir")
        .eq("id", vendedorBId)
        .single();
      expect(real?.pode_transmitir).toBe(true);
    });

    it("POSITIVO: matriz consegue atualizar a flag de qualquer perfil", async () => {
      const { data, error } = await matriz
        .from("profiles")
        .update({ pode_transmitir: false })
        .eq("id", vendedorBId)
        .select("pode_transmitir")
        .single();
      expect(error).toBeNull();
      expect(data?.pode_transmitir).toBe(false);

      // restaura
      await admin.from("profiles").update({ pode_transmitir: true }).eq("id", vendedorBId);
    });

    it("NEGATIVO: supervisor NÃO consegue atualizar profiles.pode_transmitir via UPDATE direto (RLS de profiles não contempla supervisor por desenho — o caminho suportado é a RPC)", async () => {
      const { data, error } = await supervisorA
        .from("profiles")
        .update({ pode_transmitir: false })
        .eq("id", vendedorAId)
        .select("pode_transmitir");
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);

      const { data: real } = await admin
        .from("profiles")
        .select("pode_transmitir")
        .eq("id", vendedorAId)
        .single();
      expect(real?.pode_transmitir).toBe(true);
    });

    it("POSITIVO (correção 20260908160000): supervisor consegue desligar/religar a flag de subordinado direto via RPC definir_pode_transmitir", async () => {
      const { error: eOff } = await supervisorA.rpc("definir_pode_transmitir", {
        p_profile_id: vendedorAId,
        p_valor: false,
      });
      expect(eOff).toBeNull();

      const { data: off } = await admin
        .from("profiles")
        .select("pode_transmitir")
        .eq("id", vendedorAId)
        .single();
      expect(off?.pode_transmitir).toBe(false);

      const { error: eOn } = await supervisorA.rpc("definir_pode_transmitir", {
        p_profile_id: vendedorAId,
        p_valor: true,
      });
      expect(eOn).toBeNull();

      const { data: on } = await admin
        .from("profiles")
        .select("pode_transmitir")
        .eq("id", vendedorAId)
        .single();
      expect(on?.pode_transmitir).toBe(true);
    });

    it("NEGATIVO: supervisor de OUTRA cadeia NÃO consegue alterar a flag via RPC (não é superior direto)", async () => {
      const { error } = await supervisorOutro.rpc("definir_pode_transmitir", {
        p_profile_id: vendedorAId,
        p_valor: false,
      });
      expect(error).not.toBeNull();

      const { data: real } = await admin
        .from("profiles")
        .select("pode_transmitir")
        .eq("id", vendedorAId)
        .single();
      expect(real?.pode_transmitir).toBe(true);
    });

    it("NEGATIVO: vendedor comum NÃO consegue alterar a própria flag via RPC (bloqueio replicado dentro da function)", async () => {
      const { error } = await vendedorB.rpc("definir_pode_transmitir", {
        p_profile_id: vendedorBId,
        p_valor: false,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/própria permissão de transmissão/i);
    });
  });
});
