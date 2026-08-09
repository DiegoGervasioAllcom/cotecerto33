/**
 * V11.5b (Frente 5b — Franquia Full como matrizinha) — Personalização geral e
 * Performance da Full, sem senha de diretor.
 *
 * Cobre as 3 RPCs novas (r41: `perfSaveGate('full')`/`fullComSave()` salvam
 * direto, sem `dirGate`):
 *
 * - `fn_registrar_alteracao_franquia` (V11.5b.1): porta de escrita do
 *   histórico da FRANQUIA. Gate por identidade — franqueado dono da própria
 *   empresa + modalidade Full — nunca senha de diretor.
 * - `fn_salvar_regua_performance_full` (V11.5b.2): a Full salva a própria
 *   régua de performance, SEM p_notifica_supervisor. Bloco 'full' continua
 *   UMA LINHA COMPARTILHADA (não uma cópia por empresa).
 * - `fn_salvar_complementos_full` (V11.5b.3): complementos de comissão do
 *   time (1 linha por empresa, PK empresa_id).
 *
 * Em todos os casos: só a própria Full (nunca outra Full, nunca Individual,
 * nunca Master/vendedor, nunca Matriz se passando por ela) pode ESCREVER —
 * mas Matriz continua podendo LER (select normal) régua/complementos de
 * qualquer empresa.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admin,
  anonClient,
  criarPersonaComEmpresa,
  criarUsuario,
  loginMatriz,
  uniq,
  uniqDoc,
  type Db,
} from "../helpers/supabase";

type RpcNome =
  | "fn_registrar_alteracao_franquia"
  | "fn_salvar_regua_performance_full"
  | "fn_salvar_complementos_full";

type RpcClient = {
  rpc: (
    nome: RpcNome,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

async function criarEmpresaComModalidade(modalidade: "individual" | "full" | undefined) {
  const { data: modelo, error: eModelo } = await admin
    .from("modelos_franquia")
    .insert({ nome: uniq(`modelo-5b-${modalidade ?? "sem"}`), tipo: "franqueada", modalidade })
    .select("id")
    .single();
  if (eModelo) throw eModelo;

  const { data: emp, error: eEmp } = await admin
    .from("empresas")
    .insert({
      nome: uniq("Empresa 5b"),
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

async function criarFranqueado(empresaId: string) {
  const { userId, client } = await criarUsuario(`${uniq("franq-5b")}@teste.local`);
  const { data: empresa } = await admin
    .from("empresas")
    .select("modelos_franquia(modalidade)")
    .eq("id", empresaId)
    .single();
  const modalidade = (empresa?.modelos_franquia as { modalidade?: string } | null)?.modalidade;
  const master =
    modalidade === "full"
      ? await criarPersonaComEmpresa("master", { emailPrefix: "master-5b-full" })
      : null;
  await admin
    .from("profiles")
    .update({
      empresa_id: empresaId,
      status: "aprovada",
      ...(master ? { superior_id: master.userId } : {}),
    })
    .eq("id", userId);
  await admin.from("user_roles").insert({ user_id: userId, role: "franqueado" });
  return { userId, client: client as unknown as RpcClient };
}

const REGUA_FULL_VALIDA = {
  p_janela_dias: 30,
  p_conv_atencao_pct: 22,
  p_conv_travado_pct: 12,
  p_dias_atencao: 12,
  p_dias_travado: 18,
  p_cancelamentos_limite: 3,
  p_pausa_leads_ativa: true,
};

const COMPLEMENTOS_VALIDOS = {
  p_comissao_venda_pct: 40,
  p_comissao_renovacao_pct: 15,
  p_bonus_campanha: "+5% acima da meta",
  p_meta_padrao_equipe: "12 vendas/mês",
};

describe("V11.5b — Franquia Full: personalização/performance sem senha de diretor", () => {
  let matriz: RpcClient;

  beforeAll(async () => {
    matriz = (await loginMatriz()) as unknown as RpcClient;
  });

  describe("fn_registrar_alteracao_franquia — gate por identidade", () => {
    it("POSITIVO: a própria Full grava histórico da própria empresa (empresa_id preenchido, autor '(franqueado)')", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { userId, client } = await criarFranqueado(empresaId);

      const { data, error } = await client.rpc("fn_registrar_alteracao_franquia", {
        p_empresa_id: empresaId,
        p_area: "Comissionamento",
        p_o_que: "Teste V11.5b — grava direto",
        p_de_para: null,
      });
      expect(error).toBeNull();
      expect(data).toBeTruthy();

      const { data: hist } = await admin
        .from("historico_alteracoes")
        .select("empresa_id,autor_id,autor_nome,area,o_que")
        .eq("id", data as string)
        .single();
      expect(hist?.empresa_id).toBe(empresaId);
      expect(hist?.autor_id).toBe(userId);
      expect(hist?.autor_nome).toContain("(franqueado)");
      expect(hist?.area).toBe("Comissionamento");
    });

    it("NEGATIVO: franquia Individual não tem essa autonomia (regra 8 é só da Full)", async () => {
      const empresaId = await criarEmpresaComModalidade("individual");
      const { client } = await criarFranqueado(empresaId);

      const { error } = await client.rpc("fn_registrar_alteracao_franquia", {
        p_empresa_id: empresaId,
        p_area: "Comissionamento",
        p_o_que: "Não devia gravar",
        p_de_para: null,
      });
      expect(error).not.toBeNull();
    });

    it("NEGATIVO: uma Full não grava histórico de OUTRA Full", async () => {
      const empresaA = await criarEmpresaComModalidade("full");
      const empresaB = await criarEmpresaComModalidade("full");
      const { client } = await criarFranqueado(empresaA);

      const { error } = await client.rpc("fn_registrar_alteracao_franquia", {
        p_empresa_id: empresaB,
        p_area: "Comissionamento",
        p_o_que: "Não devia gravar",
        p_de_para: null,
      });
      expect(error).not.toBeNull();
    });

    it("NEGATIVO: Matriz não pode chamar essa RPC se passando por uma Full (gate exige role franqueado)", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { error } = await matriz.rpc("fn_registrar_alteracao_franquia", {
        p_empresa_id: empresaId,
        p_area: "Comissionamento",
        p_o_que: "Matriz não devia gravar como franqueado",
        p_de_para: null,
      });
      expect(error).not.toBeNull();
    });

    it("NEGATIVO: vendedor da própria Full não tem a autonomia (autonomia é do franqueado)", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const vend = await criarPersonaComEmpresa("vendedor", {
        empresaId,
        emailPrefix: uniq("vend-5b"),
      });

      const { error } = await (vend.client as unknown as RpcClient).rpc(
        "fn_registrar_alteracao_franquia",
        { p_empresa_id: empresaId, p_area: "Comissionamento", p_o_que: "x", p_de_para: null },
      );
      expect(error).not.toBeNull();
    });

    it("NEGATIVO: anon não executa a RPC", async () => {
      const anon = anonClient() as unknown as RpcClient;
      const { error } = await anon.rpc("fn_registrar_alteracao_franquia", {
        p_empresa_id: null,
        p_area: "Comissionamento",
        p_o_que: "x",
        p_de_para: null,
      });
      expect(error?.message).toMatch(/permission denied/i);
    });

    it("NEGATIVO: empresa_id nulo é rejeitado com mensagem clara", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { client } = await criarFranqueado(empresaId);
      const { error } = await client.rpc("fn_registrar_alteracao_franquia", {
        p_empresa_id: null,
        p_area: "Comissionamento",
        p_o_que: "x",
        p_de_para: null,
      });
      expect(error?.message).toContain("obrigatório");
    });
  });

  describe("fn_salvar_regua_performance_full — régua compartilhada, sem senha", () => {
    let slaOriginal: {
      janela_dias: number;
      conv_atencao_pct: number;
      conv_travado_pct: number;
      dias_atencao: number;
      dias_travado: number;
      cancelamentos_limite: number;
      pausa_leads_ativa: boolean;
      notifica_supervisor: boolean;
    };

    beforeAll(async () => {
      const { data } = await admin
        .from("regua_performance_config")
        .select(
          "janela_dias,conv_atencao_pct,conv_travado_pct,dias_atencao,dias_travado,cancelamentos_limite,pausa_leads_ativa,notifica_supervisor",
        )
        .eq("bloco", "full")
        .single();
      slaOriginal = data!;
    });

    afterAll(async () => {
      await admin.from("regua_performance_config").update(slaOriginal).eq("bloco", "full");
    });

    it("POSITIVO: a própria Full salva a régua direto (sem senha), grava histórico da franquia com empresa_id", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { userId, client } = await criarFranqueado(empresaId);

      const { data: antes } = await admin
        .from("regua_performance_config")
        .select("cancelamentos_limite")
        .eq("bloco", "full")
        .single();
      const novoLimite = (antes?.cancelamentos_limite ?? 0) + 1;

      const { error } = await client.rpc("fn_salvar_regua_performance_full", {
        p_empresa_id: empresaId,
        ...REGUA_FULL_VALIDA,
        p_cancelamentos_limite: novoLimite,
      });
      expect(error).toBeNull();

      const { data: regua } = await admin
        .from("regua_performance_config")
        .select("cancelamentos_limite,atualizado_por,notifica_supervisor")
        .eq("bloco", "full")
        .single();
      expect(regua?.cancelamentos_limite).toBe(novoLimite);
      expect(regua?.atualizado_por).toBe(userId);
      // notifica_supervisor não é editável pro scope full (r41) — não muda.
      expect(regua?.notifica_supervisor).toBe(slaOriginal.notifica_supervisor);

      const { data: hist } = await admin
        .from("historico_alteracoes")
        .select("empresa_id,autor_id,autor_nome,area,o_que,de_para")
        .eq("autor_id", userId)
        .eq("area", "Performance")
        .single();
      expect(hist?.empresa_id).toBe(empresaId);
      expect(hist?.autor_nome).toContain("(franqueado)");
      expect(hist?.o_que).toContain("Régua própria do time alterada");
      expect(hist?.de_para).toBeTruthy();
    });

    it("a régua do bloco full é UMA LINHA COMPARTILHADA — outra Full lê o mesmo valor que a primeira salvou", async () => {
      const empresaA = await criarEmpresaComModalidade("full");
      const empresaB = await criarEmpresaComModalidade("full");
      const { client: clientA } = await criarFranqueado(empresaA);
      const { client: clientB } = await criarFranqueado(empresaB);

      const { data: antes } = await admin
        .from("regua_performance_config")
        .select("cancelamentos_limite")
        .eq("bloco", "full")
        .single();
      const novoLimite = (antes?.cancelamentos_limite ?? 0) + 1;

      const { error } = await clientA.rpc("fn_salvar_regua_performance_full", {
        p_empresa_id: empresaA,
        ...REGUA_FULL_VALIDA,
        p_cancelamentos_limite: novoLimite,
      });
      expect(error).toBeNull();

      // Full B (nunca chamou a RPC) lê a MESMA linha compartilhada via select normal.
      const { data: leituraB } = await (clientB as unknown as Db)
        .from("regua_performance_config")
        .select("cancelamentos_limite")
        .eq("bloco", "full")
        .single();
      expect(leituraB?.cancelamentos_limite).toBe(novoLimite);

      // Confirma que não existe linha por empresa — só a linha do bloco 'full'.
      const { count } = await admin
        .from("regua_performance_config")
        .select("bloco", { count: "exact", head: true })
        .eq("bloco", "full");
      expect(count).toBe(1);
    });

    it("NEGATIVO: franquia Individual não pode salvar a régua full sem senha (autonomia é só da Full)", async () => {
      const empresaId = await criarEmpresaComModalidade("individual");
      const { client } = await criarFranqueado(empresaId);

      const { data: antes } = await admin
        .from("regua_performance_config")
        .select("cancelamentos_limite")
        .eq("bloco", "full")
        .single();

      const { error } = await client.rpc("fn_salvar_regua_performance_full", {
        p_empresa_id: empresaId,
        ...REGUA_FULL_VALIDA,
      });
      expect(error).not.toBeNull();

      const { data: depois } = await admin
        .from("regua_performance_config")
        .select("cancelamentos_limite")
        .eq("bloco", "full")
        .single();
      expect(depois?.cancelamentos_limite).toBe(antes?.cancelamentos_limite);
    });

    it("NEGATIVO: uma Full não pode salvar a régua se passando por OUTRA Full", async () => {
      const empresaA = await criarEmpresaComModalidade("full");
      const empresaB = await criarEmpresaComModalidade("full");
      const { client } = await criarFranqueado(empresaA);

      const { error } = await client.rpc("fn_salvar_regua_performance_full", {
        p_empresa_id: empresaB,
        ...REGUA_FULL_VALIDA,
      });
      expect(error).not.toBeNull();
    });

    it("NEGATIVO: Matriz não pode chamar essa RPC se passando pela Full — mas CONTINUA lendo a régua via select normal", async () => {
      const empresaId = await criarEmpresaComModalidade("full");

      const { error } = await matriz.rpc("fn_salvar_regua_performance_full", {
        p_empresa_id: empresaId,
        ...REGUA_FULL_VALIDA,
      });
      expect(error).not.toBeNull();

      const { data: leitura, error: eSelect } = await (matriz as unknown as Db)
        .from("regua_performance_config")
        .select("bloco,conv_atencao_pct")
        .eq("bloco", "full")
        .single();
      expect(eSelect).toBeNull();
      expect(leitura?.bloco).toBe("full");
    });

    it("NEGATIVO: rejeita conversão de travado maior que a de atenção (mesma validação de D2)", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { client } = await criarFranqueado(empresaId);

      const { error } = await client.rpc("fn_salvar_regua_performance_full", {
        p_empresa_id: empresaId,
        ...REGUA_FULL_VALIDA,
        p_conv_atencao_pct: 10,
        p_conv_travado_pct: 20,
      });
      expect(error?.message).toContain("não pode ser maior");
    });

    it("NEGATIVO: rejeita dias_travado menor que dias_atencao (mesma validação de D2)", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { client } = await criarFranqueado(empresaId);

      const { error } = await client.rpc("fn_salvar_regua_performance_full", {
        p_empresa_id: empresaId,
        ...REGUA_FULL_VALIDA,
        p_dias_atencao: 20,
        p_dias_travado: 10,
      });
      expect(error?.message).toContain("não podem ser menores");
    });

    it("NEGATIVO: anon não executa a RPC", async () => {
      const anon = anonClient() as unknown as RpcClient;
      const { error } = await anon.rpc("fn_salvar_regua_performance_full", {
        p_empresa_id: null,
        ...REGUA_FULL_VALIDA,
      });
      expect(error?.message).toMatch(/permission denied/i);
    });
  });

  describe("fn_salvar_complementos_full / full_comissao_complementos — 1 linha por empresa", () => {
    it("POSITIVO: a própria Full salva os complementos do time, grava histórico via V11.5b.1", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { userId, client } = await criarFranqueado(empresaId);

      const { data, error } = await client.rpc("fn_salvar_complementos_full", {
        p_empresa_id: empresaId,
        ...COMPLEMENTOS_VALIDOS,
      });
      expect(error).toBeNull();
      expect((data as { comissao_venda_pct: number }).comissao_venda_pct).toBe(40);
      expect((data as { bonus_campanha: string }).bonus_campanha).toBe("+5% acima da meta");

      const { data: linha } = await admin
        .from("full_comissao_complementos")
        .select("*")
        .eq("empresa_id", empresaId)
        .single();
      expect(linha?.comissao_venda_pct).toBe(40);
      expect(linha?.comissao_renovacao_pct).toBe(15);
      expect(linha?.meta_padrao_equipe).toBe("12 vendas/mês");
      expect(linha?.atualizado_por).toBe(userId);

      const { data: hist } = await admin
        .from("historico_alteracoes")
        .select("empresa_id,area,o_que,autor_nome")
        .eq("autor_id", userId)
        .eq("area", "Comissionamento")
        .single();
      expect(hist?.empresa_id).toBe(empresaId);
      expect(hist?.o_que).toContain("Complementos do time alterados");
      expect(hist?.autor_nome).toContain("(franqueado)");
    });

    it("1 linha por empresa: duas Fulls diferentes têm complementos independentes", async () => {
      const empresaA = await criarEmpresaComModalidade("full");
      const empresaB = await criarEmpresaComModalidade("full");
      const { client: clientA } = await criarFranqueado(empresaA);
      const { client: clientB } = await criarFranqueado(empresaB);

      await clientA.rpc("fn_salvar_complementos_full", {
        p_empresa_id: empresaA,
        p_comissao_venda_pct: 40,
        p_comissao_renovacao_pct: 15,
        p_bonus_campanha: "+5% acima da meta",
        p_meta_padrao_equipe: "12 vendas/mês",
      });
      await clientB.rpc("fn_salvar_complementos_full", {
        p_empresa_id: empresaB,
        p_comissao_venda_pct: 35,
        p_comissao_renovacao_pct: 10,
        p_bonus_campanha: "+3% acima da meta",
        p_meta_padrao_equipe: "8 vendas/mês",
      });

      const { data: linhaA } = await admin
        .from("full_comissao_complementos")
        .select("comissao_venda_pct")
        .eq("empresa_id", empresaA)
        .single();
      const { data: linhaB } = await admin
        .from("full_comissao_complementos")
        .select("comissao_venda_pct")
        .eq("empresa_id", empresaB)
        .single();
      expect(linhaA?.comissao_venda_pct).toBe(40);
      expect(linhaB?.comissao_venda_pct).toBe(35);
    });

    it("Matriz LÊ os complementos de qualquer Full via select normal", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { client } = await criarFranqueado(empresaId);
      await client.rpc("fn_salvar_complementos_full", {
        p_empresa_id: empresaId,
        ...COMPLEMENTOS_VALIDOS,
      });

      const { data, error } = await (matriz as unknown as Db)
        .from("full_comissao_complementos")
        .select("empresa_id,comissao_venda_pct")
        .eq("empresa_id", empresaId)
        .single();
      expect(error).toBeNull();
      expect(data?.comissao_venda_pct).toBe(40);
    });

    it("NEGATIVO: Matriz não pode chamar fn_salvar_complementos_full no lugar da Full", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { error } = await matriz.rpc("fn_salvar_complementos_full", {
        p_empresa_id: empresaId,
        ...COMPLEMENTOS_VALIDOS,
      });
      expect(error).not.toBeNull();
    });

    it("NEGATIVO: franquia Individual não tem essa autonomia", async () => {
      const empresaId = await criarEmpresaComModalidade("individual");
      const { client } = await criarFranqueado(empresaId);
      const { error } = await client.rpc("fn_salvar_complementos_full", {
        p_empresa_id: empresaId,
        ...COMPLEMENTOS_VALIDOS,
      });
      expect(error).not.toBeNull();
    });

    it("NEGATIVO: uma Full não salva complementos de OUTRA Full", async () => {
      const empresaA = await criarEmpresaComModalidade("full");
      const empresaB = await criarEmpresaComModalidade("full");
      const { client } = await criarFranqueado(empresaA);

      const { error } = await client.rpc("fn_salvar_complementos_full", {
        p_empresa_id: empresaB,
        ...COMPLEMENTOS_VALIDOS,
      });
      expect(error).not.toBeNull();
    });

    it("NEGATIVO: vendedor da própria Full não pode salvar os complementos do time", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const vend = await criarPersonaComEmpresa("vendedor", {
        empresaId,
        emailPrefix: uniq("vend-5b-com"),
      });

      const { error } = await (vend.client as unknown as RpcClient).rpc(
        "fn_salvar_complementos_full",
        { p_empresa_id: empresaId, ...COMPLEMENTOS_VALIDOS },
      );
      expect(error).not.toBeNull();
    });

    it("NEGATIVO: anon não executa a RPC", async () => {
      const anon = anonClient() as unknown as RpcClient;
      const { error } = await anon.rpc("fn_salvar_complementos_full", {
        p_empresa_id: null,
        ...COMPLEMENTOS_VALIDOS,
      });
      expect(error?.message).toMatch(/permission denied/i);
    });

    it("NEGATIVO: percentuais fora da faixa 0-100 são rejeitados", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const { client } = await criarFranqueado(empresaId);

      const alto = await client.rpc("fn_salvar_complementos_full", {
        p_empresa_id: empresaId,
        ...COMPLEMENTOS_VALIDOS,
        p_comissao_venda_pct: 150,
      });
      expect(alto.error).not.toBeNull();

      const baixo = await client.rpc("fn_salvar_complementos_full", {
        p_empresa_id: empresaId,
        ...COMPLEMENTOS_VALIDOS,
        p_comissao_renovacao_pct: -5,
      });
      expect(baixo.error).not.toBeNull();
    });

    it("NEGATIVO: escrita direta na tabela (sem RPC) é bloqueada a nível de grant, mesmo pra matriz", async () => {
      const empresaId = await criarEmpresaComModalidade("full");
      const matrizDb = matriz as unknown as Db;

      const { error } = await matrizDb.from("full_comissao_complementos").insert({
        empresa_id: empresaId,
        comissao_venda_pct: 40,
        comissao_renovacao_pct: 15,
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    });
  });
});
