/**
 * V11.5.8 (Frente 5 — Franquia Full) — comissão por origem do lead.
 *
 * Regra 9 das "Regras Decididas": lead captado pelo canal próprio da Full tem
 * regra de comissionamento diferente do lead repassado pela Matriz, definida
 * pela Matriz nas configurações (não pela franquia). Esta migration entrega
 * a configuração (`comissao_origem_config`) + a função de resolução isolada
 * (`fn_pct_comissao_por_origem`) — SEM integrar ainda com
 * `_sync_comissao_lancamento`/`marcar_apolice_emitida` (ver cabeçalho da
 * migration 20260803160000).
 *
 * Cobre:
 * - `fn_pct_comissao_por_origem`: canal próprio × repassado dão parâmetros
 *   diferentes quando a Matriz ativa a regra; sem override ativo, comporta-se
 *   como hoje (fn_pct_comissao_efetivo); fora do contexto Full, ignora
 *   comissao_origem_config por completo (blast radius contido); execução
 *   revogada de authenticated (mesmo tratamento de fn_pct_comissao_efetivo).
 * - `fn_salvar_comissao_origem` (RLS de quem pode configurar): só Matriz;
 *   franqueado/vendedor/coordenador/anon não podem; validações de faixa;
 *   escrita direta na tabela é bloqueada a nível de grant.
 */
import { describe, expect, it } from "vitest";
import { admin, anonClient, criarUsuario, loginMatriz, uniq, uniqDoc } from "../helpers/supabase";

type OrigemRpcClient = {
  rpc: (
    nome:
      | "fn_pct_comissao_efetivo"
      | "fn_pct_comissao_por_origem"
      | "fn_salvar_comissao_origem"
      | "fn_origem_lead",
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

const adminRpc = admin as unknown as OrigemRpcClient;

async function criarEmpresaComModalidade(modalidade: "individual" | "full" | undefined) {
  const { data: modelo, error: eModelo } = await admin
    .from("modelos_franquia")
    .insert({ nome: uniq(`modelo-origem-${modalidade ?? "sem"}`), tipo: "franqueada", modalidade })
    .select("id")
    .single();
  if (eModelo) throw eModelo;

  const { data: emp, error: eEmp } = await admin
    .from("empresas")
    .insert({
      nome: uniq("Empresa Origem"),
      tipo: "pj",
      documento: uniqDoc(),
      status: "aprovada",
      modelo_id: modelo.id,
    })
    .select("id")
    .single();
  if (eEmp) throw eEmp;
  return emp.id as string;
}

async function criarCanal(empresaId: string | null) {
  const { data, error } = await admin
    .from("canais")
    .insert({
      nome: uniq("Canal Origem"),
      tipo: empresaId ? "manual" : "supper",
      empresa_id: empresaId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function criarPersona(role: "franqueado" | "vendedor" | "coordenador", empresaId: string) {
  const { userId, client } = await criarUsuario(`${uniq(`origem-${role}`)}@teste.local`);
  await admin
    .from("profiles")
    .update({ empresa_id: empresaId, status: "aprovada" })
    .eq("id", userId);
  await admin.from("user_roles").insert({ user_id: userId, role });
  return { userId, client: client as unknown as OrigemRpcClient };
}

async function limparConfigOrigem() {
  await admin.from("comissao_origem_config").delete().in("origem", ["proprio", "repassado"]);
}

/**
 * `fn_pct_comissao_efetivo` tem EXECUTE revogado até de service_role (só
 * chamável de DENTRO de outra function security definer, que herda o OWNER —
 * não dá pra chamá-la via RPC nem com a service key). Pra comparar contra o
 * "% normal" sem depender de uma function que o próprio teste não pode
 * invocar, replicamos aqui a MESMA fórmula de fallback (empresas.perc_comissao
 * -> modelos_franquia.perc_comissao_padrao -> 16), lendo as tabelas direto
 * (service_role bypassa RLS pra select).
 */
async function pctEfetivoEsperado(empresaId: string): Promise<number> {
  const { data: emp, error } = await admin
    .from("empresas")
    .select("perc_comissao, modelo_id")
    .eq("id", empresaId)
    .single();
  if (error) throw error;
  if (emp.perc_comissao !== null) return emp.perc_comissao;

  if (emp.modelo_id) {
    const { data: modelo, error: eMod } = await admin
      .from("modelos_franquia")
      .select("perc_comissao_padrao")
      .eq("id", emp.modelo_id)
      .single();
    if (eMod) throw eMod;
    if (modelo.perc_comissao_padrao !== null) return modelo.perc_comissao_padrao;
  }

  return 16;
}

async function pctPorOrigem(empresaId: string, canalId: string | null) {
  const { data, error } = await adminRpc.rpc("fn_pct_comissao_por_origem", {
    p_empresa_id: empresaId,
    p_canal_id: canalId,
  });
  if (error) throw error;
  return (data as { pct: number; fonte: string }[])[0];
}

describe("V11.5.8 — comissão por origem do lead", () => {
  describe("fn_pct_comissao_por_origem", () => {
    it("sem override ativo: comporta-se igual a fn_pct_comissao_efetivo (sem regressão)", async () => {
      await limparConfigOrigem();
      const empresaFull = await criarEmpresaComModalidade("full");
      const canalProprio = await criarCanal(empresaFull);

      const base = await pctEfetivoEsperado(empresaFull);
      const resultado = await pctPorOrigem(empresaFull, canalProprio);

      expect(resultado.pct).toBe(base);
    });

    it("canal próprio × repassado dão parâmetros diferentes quando a Matriz ativa a regra", async () => {
      await limparConfigOrigem();
      const empresaFull = await criarEmpresaComModalidade("full");
      const canalProprio = await criarCanal(empresaFull);
      const canalRepassado = await criarCanal(null);

      await admin.from("comissao_origem_config").insert([
        { origem: "proprio", pct: 25, ativo: true },
        { origem: "repassado", pct: 10, ativo: true },
      ]);

      const proprio = await pctPorOrigem(empresaFull, canalProprio);
      expect(proprio.pct).toBe(25);
      expect(proprio.fonte).toBe("origem_proprio");

      const repassado = await pctPorOrigem(empresaFull, canalRepassado);
      expect(repassado.pct).toBe(10);
      expect(repassado.fonte).toBe("origem_repassado");
    });

    it("origem indeterminada (sem canal) cai no % normal, mesmo com override ativo", async () => {
      await limparConfigOrigem();
      const empresaFull = await criarEmpresaComModalidade("full");
      await admin
        .from("comissao_origem_config")
        .insert({ origem: "proprio", pct: 25, ativo: true });

      const base = await pctEfetivoEsperado(empresaFull);
      const resultado = await pctPorOrigem(empresaFull, null);
      expect(resultado.pct).toBe(base);
    });

    it("linha configurada mas inativa (ativo=false) não tem efeito", async () => {
      await limparConfigOrigem();
      const empresaFull = await criarEmpresaComModalidade("full");
      const canalProprio = await criarCanal(empresaFull);
      await admin
        .from("comissao_origem_config")
        .insert({ origem: "proprio", pct: 25, ativo: false });

      const base = await pctEfetivoEsperado(empresaFull);
      const resultado = await pctPorOrigem(empresaFull, canalProprio);
      expect(resultado.pct).toBe(base);
    });

    it("BLAST RADIUS: fora do contexto Full, ignora comissao_origem_config mesmo ativo", async () => {
      await limparConfigOrigem();
      const empresaIndividual = await criarEmpresaComModalidade("individual");
      // Canal "próprio" tecnicamente pertence à empresa individual (empresa_id
      // preenchido); mas a distinção só é aplicável dentro do contexto Full.
      const canalProprio = await criarCanal(empresaIndividual);
      await admin
        .from("comissao_origem_config")
        .insert({ origem: "proprio", pct: 25, ativo: true });

      const base = await pctEfetivoEsperado(empresaIndividual);
      const resultado = await pctPorOrigem(empresaIndividual, canalProprio);
      expect(resultado.pct).toBe(base);
      expect(resultado.pct).not.toBe(25);
    });

    it("EXECUTE revogado de authenticated (mesmo tratamento de fn_pct_comissao_efetivo)", async () => {
      const matriz = (await loginMatriz()) as unknown as OrigemRpcClient;
      const empresaFull = await criarEmpresaComModalidade("full");
      const { error } = await matriz.rpc("fn_pct_comissao_por_origem", {
        p_empresa_id: empresaFull,
        p_canal_id: null,
      });
      expect(error?.message).toMatch(/permission denied/i);
    });
  });

  describe("fn_salvar_comissao_origem — quem pode configurar", () => {
    it("POSITIVO: matriz configura (upsert por origem)", async () => {
      const matriz = (await loginMatriz()) as unknown as OrigemRpcClient;
      const { data, error } = await matriz.rpc("fn_salvar_comissao_origem", {
        p_origem: "proprio",
        p_pct: 30,
        p_ativo: true,
      });
      expect(error).toBeNull();
      expect((data as { pct: number; ativo: boolean }).pct).toBe(30);
      expect((data as { pct: number; ativo: boolean }).ativo).toBe(true);

      // upsert: chamar de novo pra mesma origem atualiza a mesma linha.
      const { data: data2, error: error2 } = await matriz.rpc("fn_salvar_comissao_origem", {
        p_origem: "proprio",
        p_pct: 40,
        p_ativo: false,
      });
      expect(error2).toBeNull();
      expect((data2 as { pct: number }).pct).toBe(40);

      const { count } = await admin
        .from("comissao_origem_config")
        .select("*", { count: "exact", head: true })
        .eq("origem", "proprio");
      expect(count).toBe(1);
    });

    it("NEGATIVO: franqueado (mesmo sendo Full) não pode configurar — regra 9 é só da Matriz", async () => {
      const empresaFull = await criarEmpresaComModalidade("full");
      const { client } = await criarPersona("franqueado", empresaFull);
      const { error } = await client.rpc("fn_salvar_comissao_origem", {
        p_origem: "proprio",
        p_pct: 30,
      });
      expect(error?.message).toContain("forbidden");
    });

    it("NEGATIVO: coordenador não pode configurar (diferente de outras configs da frente — regra 9 nomeia só a Matriz)", async () => {
      const empresa = await criarEmpresaComModalidade("individual");
      const { client } = await criarPersona("coordenador", empresa);
      const { error } = await client.rpc("fn_salvar_comissao_origem", {
        p_origem: "proprio",
        p_pct: 30,
      });
      expect(error?.message).toContain("forbidden");
    });

    it("NEGATIVO: vendedor não pode configurar", async () => {
      const empresa = await criarEmpresaComModalidade("individual");
      const { client } = await criarPersona("vendedor", empresa);
      const { error } = await client.rpc("fn_salvar_comissao_origem", {
        p_origem: "proprio",
        p_pct: 30,
      });
      expect(error?.message).toContain("forbidden");
    });

    it("NEGATIVO: anon não executa a RPC", async () => {
      const anon = anonClient() as unknown as OrigemRpcClient;
      const { error } = await anon.rpc("fn_salvar_comissao_origem", {
        p_origem: "proprio",
        p_pct: 30,
      });
      expect(error?.message).toMatch(/permission denied/i);
    });

    it("NEGATIVO: origem inválida e pct fora da faixa são rejeitados (mesmo pra matriz)", async () => {
      const matriz = (await loginMatriz()) as unknown as OrigemRpcClient;

      const origemInvalida = await matriz.rpc("fn_salvar_comissao_origem", {
        p_origem: "outra_coisa",
        p_pct: 30,
      });
      expect(origemInvalida.error?.message).toContain("origem_invalida");

      const pctInvalido = await matriz.rpc("fn_salvar_comissao_origem", {
        p_origem: "proprio",
        p_pct: 150,
      });
      expect(pctInvalido.error?.message).toContain("pct_fora_da_faixa");
    });

    it("NEGATIVO: escrita direta na tabela (sem RPC) é bloqueada a nível de grant, mesmo pra matriz", async () => {
      const matriz = await loginMatriz();
      const { error } = await matriz
        .from("comissao_origem_config")
        .insert({ origem: "proprio", pct: 30 });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    });
  });
});
