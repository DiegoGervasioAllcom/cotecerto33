import { describe, it, expect, beforeAll } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz, uniq, type Db } from "../helpers/supabase";

/**
 * G3.2 — RPCs do fluxo de desconto adicional multinível.
 *
 * 20260719003943_g3_2_rpcs_desconto.sql entrega:
 * - fn_pode_ver_solicitacao_desconto (aperta a visão lateral do PR1 — só
 *   solicitante, ancestral real via superior_id, ou matriz).
 * - fn_modelo_alcada_desconto / fn_dentro_alcada_desconto (alçada).
 * - 7 RPCs: solicitar/aprovar/contrapropor/aceitar/negar/escalar/cancelar.
 */
describe("G3.2 — RPCs do fluxo de desconto", () => {
  let matriz: Db;
  let seguradoras: { id: string; nome: string }[];

  beforeAll(async () => {
    matriz = await loginMatriz();
    const { data, error } = await admin
      .from("seguradoras")
      .select("id, nome")
      .order("ordem")
      .limit(10);
    if (error) throw error;
    seguradoras = data!;
    expect(seguradoras.length).toBeGreaterThan(4);
  });

  /** Monta uma cotação com um prêmio selecionado (dispara a proposta automática). */
  async function criarCotacaoComPremio(opts: {
    empresaId: string;
    responsavelId: string;
    seguradoraNome: string;
    premio: number;
  }) {
    const cot = await admin
      .from("cotacoes")
      .insert({ empresa_id: opts.empresaId, responsavel_id: opts.responsavelId })
      .select("id")
      .single();
    if (cot.error) throw cot.error;

    const premioRow = await admin
      .from("cotacao_premios")
      .insert({
        cotacao_id: cot.data!.id,
        seguradora: opts.seguradoraNome,
        premio: opts.premio,
        selecionada: true,
      })
      .select("id")
      .single();
    if (premioRow.error) throw premioRow.error;

    const proposta = await admin
      .from("propostas")
      .select("id, premio, comissao_valor")
      .eq("cotacao_id", cot.data!.id)
      .single();
    if (proposta.error) throw proposta.error;

    return { cotacaoId: cot.data!.id as string, propostaId: proposta.data!.id as string };
  }

  async function upsertPolitica(modelo: string, seguradoraId: string, pctMaximo: number) {
    await admin
      .from("desconto_politicas")
      .delete()
      .eq("modelo", modelo)
      .eq("seguradora_id", seguradoraId);
    const { error } = await matriz
      .from("desconto_politicas")
      .insert({ modelo, seguradora_id: seguradoraId, pct_maximo: pctMaximo });
    expect(error).toBeNull();
  }

  describe("cadeia: nivel_atual e escalar", () => {
    it("solicitar resolve nivel_atual = superior do solicitante", async () => {
      const supervisor = await criarPersonaComEmpresa("supervisor", {
        emailPrefix: "g32-cadeia-sup",
      });
      const vendedor = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "g32-cadeia-vend",
        empresaId: supervisor.empresaId,
        superiorId: supervisor.userId,
      });

      const { data: id, error } = await vendedor.client.rpc("solicitar_desconto", {
        p_cotacao_id: (
          await criarCotacaoComPremio({
            empresaId: vendedor.empresaId,
            responsavelId: vendedor.userId,
            seguradoraNome: seguradoras[0].nome,
            premio: 1000,
          })
        ).cotacaoId,
        p_seguradora_id: seguradoras[0].id,
        p_pct_pedido: 5,
      });
      expect(error).toBeNull();
      expect(id).toBeTruthy();

      const { data: sol } = await admin
        .from("desconto_solicitacoes")
        .select("nivel_atual")
        .eq("id", id as string)
        .single();
      expect(sol?.nivel_atual).toBe(supervisor.userId);
    });

    it("escalar sobe corretamente e barra acima da Matriz", async () => {
      // supervisor sem superior_id -> reporta direto à Matriz (nivel_atual vira NULL ao escalar).
      const supervisor = await criarPersonaComEmpresa("supervisor", {
        emailPrefix: "g32-escalar-sup",
      });
      const vendedor = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "g32-escalar-vend",
        empresaId: supervisor.empresaId,
        superiorId: supervisor.userId,
      });
      const cot = await criarCotacaoComPremio({
        empresaId: vendedor.empresaId,
        responsavelId: vendedor.userId,
        seguradoraNome: seguradoras[1].nome,
        premio: 500,
      });

      const { data: id, error } = await vendedor.client.rpc("solicitar_desconto", {
        p_cotacao_id: cot.cotacaoId,
        p_seguradora_id: seguradoras[1].id,
        p_pct_pedido: 20,
      });
      expect(error).toBeNull();

      const { error: eEscalar } = await supervisor.client.rpc("escalar_desconto", {
        p_id: id as string,
      });
      expect(eEscalar).toBeNull();

      const { data: sol1 } = await admin
        .from("desconto_solicitacoes")
        .select("nivel_atual, status")
        .eq("id", id as string)
        .single();
      expect(sol1?.nivel_atual).toBeNull();
      expect(sol1?.status).toBe("pendente");

      // Já está na Matriz (nivel_atual NULL) -> escalar de novo é barrado.
      const { error: eEscalarDeNovo } = await matriz.rpc("escalar_desconto", {
        p_id: id as string,
      });
      expect(eEscalarDeNovo).not.toBeNull();
    });
  });

  describe("alçada", () => {
    it("aprovador com política pct_maximo=10 aprova 8 (ok); 15 -> raise; sem política -> raise; matriz aprova qualquer valor", async () => {
      const supervisor = await criarPersonaComEmpresa("supervisor", {
        emailPrefix: "g32-alcada-sup",
      });
      const vendedor = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "g32-alcada-vend",
        empresaId: supervisor.empresaId,
        superiorId: supervisor.userId,
      });

      await upsertPolitica("supervisor", seguradoras[2].id, 10);

      // 8% -> dentro da alçada, aprova.
      const cot1 = await criarCotacaoComPremio({
        empresaId: vendedor.empresaId,
        responsavelId: vendedor.userId,
        seguradoraNome: seguradoras[2].nome,
        premio: 1000,
      });
      const s1 = await vendedor.client.rpc("solicitar_desconto", {
        p_cotacao_id: cot1.cotacaoId,
        p_seguradora_id: seguradoras[2].id,
        p_pct_pedido: 8,
      });
      expect(s1.error).toBeNull();
      const a1 = await supervisor.client.rpc("aprovar_desconto", {
        p_id: s1.data as string,
        p_pct_concedido: 8,
      });
      expect(a1.error).toBeNull();

      // 15% -> acima da alçada, raise.
      const cot2 = await criarCotacaoComPremio({
        empresaId: vendedor.empresaId,
        responsavelId: vendedor.userId,
        seguradoraNome: seguradoras[2].nome,
        premio: 1000,
      });
      const s2 = await vendedor.client.rpc("solicitar_desconto", {
        p_cotacao_id: cot2.cotacaoId,
        p_seguradora_id: seguradoras[2].id,
        p_pct_pedido: 15,
      });
      expect(s2.error).toBeNull();
      const a2 = await supervisor.client.rpc("aprovar_desconto", {
        p_id: s2.data as string,
        p_pct_concedido: 15,
      });
      expect(a2.error).not.toBeNull();

      // Sem política para essa seguradora -> raise (tem que escalar).
      const cot3 = await criarCotacaoComPremio({
        empresaId: vendedor.empresaId,
        responsavelId: vendedor.userId,
        seguradoraNome: seguradoras[3].nome,
        premio: 1000,
      });
      const s3 = await vendedor.client.rpc("solicitar_desconto", {
        p_cotacao_id: cot3.cotacaoId,
        p_seguradora_id: seguradoras[3].id,
        p_pct_pedido: 5,
      });
      expect(s3.error).toBeNull();
      const a3 = await supervisor.client.rpc("aprovar_desconto", {
        p_id: s3.data as string,
        p_pct_concedido: 5,
      });
      expect(a3.error).not.toBeNull();

      // Matriz aprova qualquer valor, sem política.
      const a3m = await matriz.rpc("aprovar_desconto", {
        p_id: s3.data as string,
        p_pct_concedido: 40,
      });
      expect(a3m.error).toBeNull();
    });
  });

  describe("aprovar aplica no prêmio (e reflete no G4 quando pago)", () => {
    it("reduz cotacao_premios.premio e propostas.premio/comissao_valor; ledger reflete no pagamento", async () => {
      const supervisor = await criarPersonaComEmpresa("supervisor", {
        emailPrefix: "g32-premio-sup",
      });
      const vendedor = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "g32-premio-vend",
        empresaId: supervisor.empresaId,
        superiorId: supervisor.userId,
      });
      await upsertPolitica("supervisor", seguradoras[4].id, 10);

      const cot = await criarCotacaoComPremio({
        empresaId: vendedor.empresaId,
        responsavelId: vendedor.userId,
        seguradoraNome: seguradoras[4].nome,
        premio: 1000,
      });

      await admin.from("propostas").update({ comissao_pct: 16 }).eq("id", cot.propostaId);

      const s = await vendedor.client.rpc("solicitar_desconto", {
        p_cotacao_id: cot.cotacaoId,
        p_seguradora_id: seguradoras[4].id,
        p_pct_pedido: 10,
      });
      expect(s.error).toBeNull();

      const a = await supervisor.client.rpc("aprovar_desconto", {
        p_id: s.data as string,
        p_pct_concedido: 10,
      });
      expect(a.error).toBeNull();

      const { data: premioRow } = await admin
        .from("cotacao_premios")
        .select("premio")
        .eq("cotacao_id", cot.cotacaoId)
        .eq("selecionada", true)
        .single();
      expect(Number(premioRow?.premio)).toBe(900);

      const { data: proposta } = await admin
        .from("propostas")
        .select("premio, comissao_valor")
        .eq("id", cot.propostaId)
        .single();
      expect(Number(proposta?.premio)).toBe(900);
      expect(Number(proposta?.comissao_valor)).toBe(144); // 900 * 16%

      // Marca como paga -> trigger G4.2 gera o crédito no ledger com o valor já descontado.
      await admin
        .from("propostas")
        .update({ pago_em: new Date().toISOString() })
        .eq("id", cot.propostaId);

      const { data: lancamento } = await admin
        .from("comissao_lancamentos")
        .select("valor, tipo, beneficiario_id")
        .eq("proposta_id", cot.propostaId)
        .eq("tipo", "credito")
        .single();
      expect(Number(lancamento?.valor)).toBe(144);
      expect(lancamento?.beneficiario_id).toBe(vendedor.userId);
    });
  });

  describe("contraproposta -> aceitar", () => {
    it("status transita e o prêmio só muda no aceitar", async () => {
      const supervisor = await criarPersonaComEmpresa("supervisor", {
        emailPrefix: "g32-contra-sup",
      });
      const vendedor = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "g32-contra-vend",
        empresaId: supervisor.empresaId,
        superiorId: supervisor.userId,
      });
      await upsertPolitica("supervisor", seguradoras[5].id, 10);

      const cot = await criarCotacaoComPremio({
        empresaId: vendedor.empresaId,
        responsavelId: vendedor.userId,
        seguradoraNome: seguradoras[5].nome,
        premio: 1000,
      });

      const s = await vendedor.client.rpc("solicitar_desconto", {
        p_cotacao_id: cot.cotacaoId,
        p_seguradora_id: seguradoras[5].id,
        p_pct_pedido: 15,
      });
      expect(s.error).toBeNull();

      const c = await supervisor.client.rpc("contrapropor_desconto", {
        p_id: s.data as string,
        p_pct_novo: 8,
        p_obs: "só posso 8%",
      });
      expect(c.error).toBeNull();

      const { data: solAposContra } = await admin
        .from("desconto_solicitacoes")
        .select("status, pct_concedido")
        .eq("id", s.data as string)
        .single();
      expect(solAposContra?.status).toBe("aguardando_aceite");
      expect(Number(solAposContra?.pct_concedido)).toBe(8);

      // Prêmio NÃO muda ainda.
      const { data: premioAntes } = await admin
        .from("cotacao_premios")
        .select("premio")
        .eq("cotacao_id", cot.cotacaoId)
        .eq("selecionada", true)
        .single();
      expect(Number(premioAntes?.premio)).toBe(1000);

      // Solicitante aceita -> aplica no prêmio, status aprovado.
      const acc = await vendedor.client.rpc("aceitar_desconto", { p_id: s.data as string });
      expect(acc.error).toBeNull();

      const { data: solFinal } = await admin
        .from("desconto_solicitacoes")
        .select("status")
        .eq("id", s.data as string)
        .single();
      expect(solFinal?.status).toBe("aprovado");

      const { data: premioDepois } = await admin
        .from("cotacao_premios")
        .select("premio")
        .eq("cotacao_id", cot.cotacaoId)
        .eq("selecionada", true)
        .single();
      expect(Number(premioDepois?.premio)).toBe(920); // 1000 * (1 - 8/100)
    });
  });

  describe("negar encerra; solicitante abre novo", () => {
    it("negar muda status para negado e não impede novo pedido", async () => {
      const supervisor = await criarPersonaComEmpresa("supervisor", {
        emailPrefix: "g32-negar-sup",
      });
      const vendedor = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "g32-negar-vend",
        empresaId: supervisor.empresaId,
        superiorId: supervisor.userId,
      });
      const cot = await criarCotacaoComPremio({
        empresaId: vendedor.empresaId,
        responsavelId: vendedor.userId,
        seguradoraNome: seguradoras[0].nome,
        premio: 700,
      });

      const s = await vendedor.client.rpc("solicitar_desconto", {
        p_cotacao_id: cot.cotacaoId,
        p_seguradora_id: seguradoras[0].id,
        p_pct_pedido: 12,
      });
      expect(s.error).toBeNull();

      const n = await supervisor.client.rpc("negar_desconto", {
        p_id: s.data as string,
        p_obs: "sem margem",
      });
      expect(n.error).toBeNull();

      const { data: solNegada } = await admin
        .from("desconto_solicitacoes")
        .select("status")
        .eq("id", s.data as string)
        .single();
      expect(solNegada?.status).toBe("negado");

      // Novo pedido do mesmo solicitante, mesma cotação.
      const s2 = await vendedor.client.rpc("solicitar_desconto", {
        p_cotacao_id: cot.cotacaoId,
        p_seguradora_id: seguradoras[0].id,
        p_pct_pedido: 5,
      });
      expect(s2.error).toBeNull();
      expect(s2.data).toBeTruthy();
    });
  });

  describe("segurança de ator (quem pode chamar cada RPC)", () => {
    it("quem não é nivel_atual/matriz não aprova; quem não é solicitante não aceita/cancela", async () => {
      const supervisor = await criarPersonaComEmpresa("supervisor", {
        emailPrefix: "g32-ator-sup",
      });
      const vendedor = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "g32-ator-vend",
        empresaId: supervisor.empresaId,
        superiorId: supervisor.userId,
      });
      const foraDaCadeia = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "g32-ator-fora",
      });
      await upsertPolitica("supervisor", seguradoras[1].id, 10);
      const cot = await criarCotacaoComPremio({
        empresaId: vendedor.empresaId,
        responsavelId: vendedor.userId,
        seguradoraNome: seguradoras[1].nome,
        premio: 800,
      });

      const s = await vendedor.client.rpc("solicitar_desconto", {
        p_cotacao_id: cot.cotacaoId,
        p_seguradora_id: seguradoras[1].id,
        p_pct_pedido: 5,
      });
      expect(s.error).toBeNull();

      // Fora da cadeia não aprova.
      const aproveFora = await foraDaCadeia.client.rpc("aprovar_desconto", {
        p_id: s.data as string,
        p_pct_concedido: 5,
      });
      expect(aproveFora.error).not.toBeNull();

      // O próprio solicitante não aprova o próprio pedido (não é nivel_atual nem matriz).
      const aproveSolicitante = await vendedor.client.rpc("aprovar_desconto", {
        p_id: s.data as string,
        p_pct_concedido: 5,
      });
      expect(aproveSolicitante.error).not.toBeNull();

      // Fora da cadeia não cancela.
      const cancelaFora = await foraDaCadeia.client.rpc("cancelar_desconto", {
        p_id: s.data as string,
      });
      expect(cancelaFora.error).not.toBeNull();

      // O aprovador (nivel_atual) não aceita (só o solicitante aceita).
      const contra = await supervisor.client.rpc("contrapropor_desconto", {
        p_id: s.data as string,
        p_pct_novo: 3,
      });
      expect(contra.error).toBeNull();
      const aceitaAprovador = await supervisor.client.rpc("aceitar_desconto", {
        p_id: s.data as string,
      });
      expect(aceitaAprovador.error).not.toBeNull();

      // Solicitante cancela normalmente (fluxo válido).
      const cancelaSolicitante = await vendedor.client.rpc("cancelar_desconto", {
        p_id: s.data as string,
      });
      expect(cancelaSolicitante.error).toBeNull();
    });
  });

  describe("RLS reforçada (fn_pode_ver_solicitacao_desconto)", () => {
    it("solicitante, cadeia-acima e matriz veem; colega lateral (mesma empresa, sem hierarquia) e outra rede NÃO veem", async () => {
      const supervisor = await criarPersonaComEmpresa("supervisor", {
        emailPrefix: "g32-rls-sup",
      });
      const vendedor = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "g32-rls-vend",
        empresaId: supervisor.empresaId,
        superiorId: supervisor.userId,
      });
      // Colega na MESMA empresa, mas SEM vínculo de hierarquia (superior_id nulo,
      // não é ancestral do vendedor) — o caso lateral que o PR1 deixava vazar.
      const colegaLateral = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "g32-rls-colega",
        empresaId: supervisor.empresaId,
      });
      const outraRede = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "g32-rls-outra-rede",
      });

      const cot = await criarCotacaoComPremio({
        empresaId: vendedor.empresaId,
        responsavelId: vendedor.userId,
        seguradoraNome: seguradoras[2].nome,
        premio: 600,
      });
      const s = await vendedor.client.rpc("solicitar_desconto", {
        p_cotacao_id: cot.cotacaoId,
        p_seguradora_id: seguradoras[2].id,
        p_pct_pedido: 5,
      });
      expect(s.error).toBeNull();
      const id = s.data as string;

      const bySolicitante = await vendedor.client
        .from("desconto_solicitacoes")
        .select("id")
        .eq("id", id);
      expect(bySolicitante.data?.length).toBe(1);

      const byCadeiaAcima = await supervisor.client
        .from("desconto_solicitacoes")
        .select("id")
        .eq("id", id);
      expect(byCadeiaAcima.data?.length).toBe(1);

      const byMatriz = await matriz.from("desconto_solicitacoes").select("id").eq("id", id);
      expect(byMatriz.data?.length).toBe(1);

      const byColegaLateral = await colegaLateral.client
        .from("desconto_solicitacoes")
        .select("id")
        .eq("id", id);
      expect(byColegaLateral.data?.length).toBe(0);

      const byOutraRede = await outraRede.client
        .from("desconto_solicitacoes")
        .select("id")
        .eq("id", id);
      expect(byOutraRede.data?.length).toBe(0);

      // Trilha segue a mesma regra.
      const trilhaColegaLateral = await colegaLateral.client
        .from("desconto_trilha")
        .select("id")
        .eq("solicitacao_id", id);
      expect(trilhaColegaLateral.data?.length).toBe(0);
    });

    it("escrita direta (insert) em desconto_solicitacoes continua barrada — só via RPC", async () => {
      const vendedor = await criarPersonaComEmpresa("vendedor", { emailPrefix: "g32-rls-insert" });
      const { error } = await vendedor.client.from("desconto_solicitacoes").insert({
        cotacao_id: "00000000-0000-0000-0000-000000000000",
        solicitante_id: vendedor.userId,
        seguradora_id: seguradoras[0].id,
        pct_pedido: 5,
      });
      expect(error).not.toBeNull();
    });
  });

  describe("franqueado (individual/full) — alçada via modelo derivado", () => {
    it("master aprova dentro da alçada do modelo master; franqueado individual não aprova (não é nivel_atual)", async () => {
      const master = await criarPersonaComEmpresa("master", { emailPrefix: "g32-franq-master" });
      const franqueado = await criarPersonaComEmpresa("franqueado", {
        emailPrefix: "g32-franq-individual",
        parentId: master.empresaId,
        superiorId: master.userId,
      });

      await upsertPolitica("master", seguradoras[3].id, 12);

      const cot = await criarCotacaoComPremio({
        empresaId: franqueado.empresaId,
        responsavelId: franqueado.userId,
        seguradoraNome: seguradoras[3].nome,
        premio: 2000,
      });
      const s = await franqueado.client.rpc("solicitar_desconto", {
        p_cotacao_id: cot.cotacaoId,
        p_seguradora_id: seguradoras[3].id,
        p_pct_pedido: 10,
      });
      expect(s.error).toBeNull();

      const { data: sol } = await admin
        .from("desconto_solicitacoes")
        .select("nivel_atual")
        .eq("id", s.data as string)
        .single();
      expect(sol?.nivel_atual).toBe(master.userId);

      // Franqueado (solicitante) não é nivel_atual -> não aprova o próprio pedido.
      const aproveFranq = await franqueado.client.rpc("aprovar_desconto", {
        p_id: s.data as string,
        p_pct_concedido: 10,
      });
      expect(aproveFranq.error).not.toBeNull();

      const aproveMaster = await master.client.rpc("aprovar_desconto", {
        p_id: s.data as string,
        p_pct_concedido: 10,
      });
      expect(aproveMaster.error).toBeNull();
    });
  });

  describe("guarda: seguradora sem prêmio selecionado", () => {
    it("aprovar falha ALTO (não silencioso) quando nenhum prêmio selecionado casa com a seguradora do pedido", async () => {
      const supervisor = await criarPersonaComEmpresa("supervisor", {
        emailPrefix: uniq("sup-guard"),
      });
      const vendedor = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: uniq("vend-guard"),
        superiorId: supervisor.userId,
      });
      // Cotação tem prêmio selecionado para a seguradora [0]...
      const cot = await criarCotacaoComPremio({
        empresaId: vendedor.empresaId,
        responsavelId: vendedor.userId,
        seguradoraNome: seguradoras[0].nome,
        premio: 1000,
      });
      // ...mas o pedido é para a seguradora [1] (sem prêmio selecionado casando).
      const s = await vendedor.client.rpc("solicitar_desconto", {
        p_cotacao_id: cot.cotacaoId,
        p_seguradora_id: seguradoras[1].id,
        p_pct_pedido: 5,
      });
      expect(s.error).toBeNull();
      const solId = s.data as string;
      // A Matriz aprova (alçada ilimitada), mas o desconto não casa nenhum prêmio
      // → deve levantar exceção em vez de gravar 'aprovado' sem efeito no dinheiro.
      const aprov = await matriz.rpc("aprovar_desconto", {
        p_id: solId,
        p_pct_concedido: 5,
      });
      expect(aprov.error).not.toBeNull();
      expect(aprov.error?.message).toMatch(/sem prêmio selecionado/i);
      // E a solicitação NÃO ficou 'aprovado' (a exceção reverte a transação).
      const { data: sol } = await admin
        .from("desconto_solicitacoes")
        .select("status")
        .eq("id", solId)
        .single();
      expect(sol?.status).toBe("pendente");
    });
  });
});
