import { describe, it, expect } from "vitest";
import { admin, criarPersonaComEmpresa, loginMatriz, uniq, type Db } from "../helpers/supabase";

/**
 * G4.4 (050) — RPC de fechamento de competência (`fechar_comissao_competencia`):
 * overrides master/supervisor sobre a comissão líquida da rede, ajuste CLT
 * (fn_comissao_clt vs. créditos automáticos do trigger 048) e royalties como
 * débito automático (empresas.royalties_fpp / profiles.royalties).
 *
 * Os lançamentos de "produção" da rede (créditos/débitos que o trigger 048
 * normalmente geraria a partir de propostas pagas/estornadas) são inseridos
 * DIRETAMENTE via admin nestes testes — mesmo padrão já usado em
 * ledger-competencia.test.ts (G4.2) para fixar valores exatos e isolar o
 * cálculo do fechamento da mecânica do trigger.
 *
 * Cada cenário usa uma competência (YYYY-MM) própria para não colidir com a
 * trava de idempotência ("competência já fechada"). Como a trava é permanente
 * (sem reabertura nesta fatia) e o ano/mês tem formato fixo, o ANO é sorteado
 * a cada execução da suíte (a trava só olha para a STRING competencia, não
 * para datas reais — o range do ano é irrelevante para o cálculo) para a
 * suíte rodar 2x seguidas sem colidir, sem precisar de `db:reset` entre elas.
 */
const ANO = String(2200 + (Date.now() % 700));
const COMP = (mes: string) => `${ANO}-${mes}`;

async function inserirLancamento(opts: {
  beneficiarioId: string;
  tipo: "credito" | "debito";
  valor: number;
  competencia: string;
  origem?: string;
  empresaId?: string | null;
  papel?: string | null;
}) {
  const { error } = await admin.from("comissao_lancamentos").insert({
    vendedor_id: opts.beneficiarioId,
    beneficiario_id: opts.beneficiarioId,
    empresa_id: opts.empresaId ?? null,
    tipo: opts.tipo,
    valor: opts.valor,
    descricao: "fixture golden-fechamento",
    origem: opts.origem ?? "auto",
    competencia: opts.competencia,
    papel: opts.papel ?? null,
  });
  if (error) throw error;
}

async function saldoBeneficiario(beneficiarioId: string, competencia: string) {
  const { data, error } = await admin
    .from("comissao_lancamentos")
    .select("tipo, valor, origem, papel")
    .eq("beneficiario_id", beneficiarioId)
    .eq("competencia", competencia);
  if (error) throw error;
  const saldo = (data ?? []).reduce(
    (acc, l) => acc + (l.tipo === "credito" ? Number(l.valor) : -Number(l.valor)),
    0,
  );
  return { linhas: data ?? [], saldo };
}

describe("G4.4 — fechar_comissao_competencia (golden tests)", () => {
  describe("rede completa: master (perc_equipe=20, royalties_fpp=500) com 2 franquias", () => {
    it("base = 1000 + 600 - 200 (estorno) = 1400 -> override 280; royalties débito 500", async () => {
      const competencia = COMP("01");
      const matriz = await loginMatriz();

      const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-rede" });
      await admin
        .from("empresas")
        .update({ perc_equipe: 20, royalties_fpp: 500 })
        .eq("id", master.empresaId);

      const franquia1 = await criarPersonaComEmpresa("franqueado", {
        emailPrefix: "franq1-rede",
        superiorId: master.userId,
      });
      const franquia2 = await criarPersonaComEmpresa("franqueado", {
        emailPrefix: "franq2-rede",
        superiorId: master.userId,
      });

      await inserirLancamento({
        beneficiarioId: franquia1.userId,
        tipo: "credito",
        valor: 1000,
        competencia,
        empresaId: franquia1.empresaId,
      });
      await inserirLancamento({
        beneficiarioId: franquia1.userId,
        tipo: "debito",
        valor: 200,
        competencia,
        empresaId: franquia1.empresaId,
      });
      await inserirLancamento({
        beneficiarioId: franquia2.userId,
        tipo: "credito",
        valor: 600,
        competencia,
        empresaId: franquia2.empresaId,
      });

      // Nota: o resumo global de "royalties" soma TODOS os masters/supervisores
      // com royalties configurado (custo fixo recorrente, cobrado a cada
      // fechamento independente de produção) — ver nota equivalente no
      // cenário do supervisor, abaixo. A asserção específica deste cenário é
      // feita pelas linhas do PRÓPRIO beneficiário.
      const { data: resumo, error } = await matriz.rpc("fechar_comissao_competencia", {
        p_competencia: competencia,
      });
      expect(error).toBeNull();
      expect(resumo).toMatchObject({
        override_master: { qtd: 1, soma: 280 },
      });

      const { linhas, saldo } = await saldoBeneficiario(master.userId, competencia);
      const royaltiesLinha = linhas.find((l) => l.origem === "fechamento_royalties");
      const overrideLinha = linhas.find((l) => l.origem === "fechamento_override");
      expect(royaltiesLinha).toMatchObject({ tipo: "debito", valor: 500, papel: "master" });
      expect(overrideLinha).toMatchObject({ tipo: "credito", valor: 280, papel: "master" });
      // saldo do master na competência = -500 (royalties) + 280 (override) = -220
      expect(saldo).toBeCloseTo(-220, 6);
    });
  });

  describe("supervisor comissao_modelo=15 com 1 franquia reportando (líquido 1000)", () => {
    it("override 150; royalties (profiles.royalties=300) débito", async () => {
      const competencia = COMP("02");
      const matriz = await loginMatriz();

      const supervisor = await criarPersonaComEmpresa("supervisor", {
        emailPrefix: "supervisor-rede",
      });
      await admin
        .from("profiles")
        .update({ comissao_modelo: 15, royalties: 300 })
        .eq("id", supervisor.userId);

      const franquia = await criarPersonaComEmpresa("franqueado", {
        emailPrefix: "franq-supervisor",
        superiorId: supervisor.userId,
      });

      await inserirLancamento({
        beneficiarioId: franquia.userId,
        tipo: "credito",
        valor: 1000,
        competencia,
        empresaId: franquia.empresaId,
      });

      // Nota: o resumo global de "royalties" soma TODOS os masters/supervisores
      // com royalties configurado, não só os desta rede — é um custo fixo
      // mensal recorrente, cobrado a cada fechamento independente de produção
      // (ex.: um master de outro teste com royalties_fpp já configurado
      // também entra na soma se ainda existir). Por isso a asserção específica
      // deste cenário é feita pelas linhas do PRÓPRIO beneficiário, abaixo,
      // não pelo resumo agregado.
      const { data: resumo, error } = await matriz.rpc("fechar_comissao_competencia", {
        p_competencia: competencia,
      });
      expect(error).toBeNull();
      expect(resumo).toMatchObject({
        override_supervisor: { qtd: 1, soma: 150 },
      });

      const { linhas, saldo } = await saldoBeneficiario(supervisor.userId, competencia);
      const royaltiesLinha = linhas.find((l) => l.origem === "fechamento_royalties");
      const overrideLinha = linhas.find((l) => l.origem === "fechamento_override");
      expect(royaltiesLinha).toMatchObject({ tipo: "debito", valor: 300, papel: "supervisor" });
      expect(overrideLinha).toMatchObject({ tipo: "credito", valor: 150, papel: "supervisor" });
      // saldo = -300 + 150 = -150
      expect(saldo).toBeCloseTo(-150, 6);
    });
  });

  describe("franquia full na rede: gera base pro master, mas NÃO recebe override próprio", () => {
    it("franquia full não recebe lançamento de override (só role master/supervisor recebem)", async () => {
      const competencia = COMP("03");
      const matriz = await loginMatriz();

      const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-full" });
      await admin.from("empresas").update({ perc_equipe: 20 }).eq("id", master.empresaId);

      const { data: modeloFull, error: eModelo } = await admin
        .from("modelos_franquia")
        .insert({ nome: uniq("Modelo Full"), tipo: "franqueada", modalidade: "full" })
        .select("id")
        .single();
      if (eModelo) throw eModelo;

      const franquiaFull = await criarPersonaComEmpresa("franqueado", {
        emailPrefix: "franq-full",
        superiorId: master.userId,
      });
      await admin
        .from("empresas")
        .update({ modelo_id: modeloFull.id })
        .eq("id", franquiaFull.empresaId);

      await inserirLancamento({
        beneficiarioId: franquiaFull.userId,
        tipo: "credito",
        valor: 1000,
        competencia,
        empresaId: franquiaFull.empresaId,
      });

      const { error } = await matriz.rpc("fechar_comissao_competencia", {
        p_competencia: competencia,
      });
      expect(error).toBeNull();

      const { linhas: linhasFranquia } = await saldoBeneficiario(franquiaFull.userId, competencia);
      expect(linhasFranquia.some((l) => l.origem === "fechamento_override")).toBe(false);

      const { linhas: linhasMaster } = await saldoBeneficiario(master.userId, competencia);
      const overrideMaster = linhasMaster.find((l) => l.origem === "fechamento_override");
      // base = 1000 (franquia full) -> override = 1000 * 20% = 200
      expect(overrideMaster).toMatchObject({ tipo: "credito", valor: 200, papel: "master" });
    });
  });

  describe("ajuste CLT: vendedor CLT com 2 propostas pagas vs fn_comissao_clt progressiva", () => {
    it("trigger creditou 2x 1.600 (16% de 10.000) = 3.200; fn_comissao_clt = 400,00 -> ajuste débito de 2.800,00", async () => {
      const competencia = COMP("04");
      const matriz = await loginMatriz();

      const { data: modeloClt, error: eModelo } = await admin
        .from("modelos_franquia")
        .insert({ nome: uniq("Modelo CLT golden"), tipo: "clt", perc_comissao_padrao: 16 })
        .select("id")
        .single();
      if (eModelo) throw eModelo;

      const vendedor = await criarPersonaComEmpresa("vendedor", { emailPrefix: "vend-clt-fecha" });
      await admin.from("empresas").update({ modelo_id: modeloClt.id }).eq("id", vendedor.empresaId);

      // pago_em na competência 2026-04 (dia < 26).
      const pagoEm = `${ANO}-04-10T12:00:00-03:00`;
      for (let i = 0; i < 2; i++) {
        const { data: proposta, error: eProp } = await admin
          .from("propostas")
          .insert({
            empresa_id: vendedor.empresaId,
            responsavel_id: vendedor.userId,
            status: "gerada",
            premio: 10000,
            tipo_venda: "novo",
            comissao_pct: 25, // média 25% -> fator_novas = 100 (acima de 20%)
          })
          .select("id")
          .single();
        if (eProp) throw eProp;
        const { error: ePago } = await admin
          .from("propostas")
          .update({ pago_em: pagoEm })
          .eq("id", proposta.id);
        if (ePago) throw ePago;
      }

      // Confere o crédito automático do trigger: 10.000 * 16% = 1.600 cada,
      // total 3.200 (origem 'auto').
      const { linhas: linhasAntes } = await saldoBeneficiario(vendedor.userId, competencia);
      const creditosAuto = linhasAntes.filter((l) => l.origem === "auto" && l.tipo === "credito");
      expect(creditosAuto).toHaveLength(2);
      const somaAuto = creditosAuto.reduce((acc, l) => acc + Number(l.valor), 0);
      expect(somaAuto).toBeCloseTo(3200, 6);

      // fn_comissao_clt: produção total 20.000 (faixa até 40.000 -> 2,00%),
      // fator_novas 100 (pct médio 25% > 20%) -> valor_final = 20000*0,02*1 = 400,00
      const { data: calc } = await admin.rpc("fn_comissao_clt", {
        p_vendedor: vendedor.userId,
        p_competencia: competencia,
      });
      expect(calc![0].valor_final).toBeCloseTo(400, 6);

      const { data: resumo, error } = await matriz.rpc("fechar_comissao_competencia", {
        p_competencia: competencia,
      });
      expect(error).toBeNull();
      // ajuste = 400,00 - 3.200,00 = -2.800,00 (débito)
      expect(resumo).toMatchObject({
        ajuste_clt: { qtd_debito: 1, soma_debito: 2800 },
      });

      const { linhas } = await saldoBeneficiario(vendedor.userId, competencia);
      const ajuste = linhas.find((l) => l.origem === "fechamento_clt");
      expect(ajuste).toMatchObject({ tipo: "debito", valor: 2800, papel: "vendedor_clt" });
    });
  });

  describe("idempotência", () => {
    it("2º fechamento da mesma competência -> exception 'já fechada'", async () => {
      const competencia = COMP("05");
      const matriz = await loginMatriz();

      const { error: e1 } = await matriz.rpc("fechar_comissao_competencia", {
        p_competencia: competencia,
      });
      expect(e1).toBeNull();

      const { error: e2 } = await matriz.rpc("fechar_comissao_competencia", {
        p_competencia: competencia,
      });
      expect(e2).not.toBeNull();
      expect(e2!.message).toMatch(/já fechada/);
    });
  });

  describe("base líquida negativa não gera override", () => {
    it("franquia com estorno maior que crédito (líquido -200) -> master não recebe override", async () => {
      const competencia = COMP("09");
      const matriz = await loginMatriz();

      const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-negativo" });
      await admin.from("empresas").update({ perc_equipe: 20 }).eq("id", master.empresaId);

      const franquia = await criarPersonaComEmpresa("franqueado", {
        emailPrefix: "franq-negativo",
        superiorId: master.userId,
      });

      await inserirLancamento({
        beneficiarioId: franquia.userId,
        tipo: "credito",
        valor: 300,
        competencia,
        empresaId: franquia.empresaId,
      });
      await inserirLancamento({
        beneficiarioId: franquia.userId,
        tipo: "debito",
        valor: 500,
        competencia,
        empresaId: franquia.empresaId,
      });

      // base líquida da rede = 300 (crédito) - 500 (débito/estorno) = -200
      // -> a RPC só gera override se _valor > 0, então nenhum lançamento
      // de origem 'fechamento_override' deve ser criado para o master.
      const { error } = await matriz.rpc("fechar_comissao_competencia", {
        p_competencia: competencia,
      });
      expect(error).toBeNull();

      const { linhas } = await saldoBeneficiario(master.userId, competencia);
      expect(linhas.some((l) => l.origem === "fechamento_override")).toBe(false);
    });
  });

  describe("segurança", () => {
    it("vendedor chama a RPC -> forbidden", async () => {
      const vendedor = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "vend-fecha-sonda",
      });
      const { data, error } = await vendedor.client.rpc("fechar_comissao_competencia", {
        p_competencia: COMP("06"),
      });
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });

    it("beneficiário (master) vê os próprios lançamentos de override; vendedor de outra rede não vê", async () => {
      const competencia = COMP("07");
      const matriz = await loginMatriz();

      const master = await criarPersonaComEmpresa("master", { emailPrefix: "master-seg" });
      await admin.from("empresas").update({ perc_equipe: 20 }).eq("id", master.empresaId);
      const franquia = await criarPersonaComEmpresa("franqueado", {
        emailPrefix: "franq-seg",
        superiorId: master.userId,
      });
      await inserirLancamento({
        beneficiarioId: franquia.userId,
        tipo: "credito",
        valor: 1000,
        competencia,
        empresaId: franquia.empresaId,
      });

      const { error: eFechar } = await matriz.rpc("fechar_comissao_competencia", {
        p_competencia: competencia,
      });
      expect(eFechar).toBeNull();

      // master vê o próprio override (policy nova: beneficiario_id = auth.uid()).
      const { data: comoMaster, error: eMaster } = await master.client
        .from("comissao_lancamentos")
        .select("id, origem")
        .eq("beneficiario_id", master.userId)
        .eq("competencia", competencia);
      expect(eMaster).toBeNull();
      expect(comoMaster!.some((l) => l.origem === "fechamento_override")).toBe(true);

      // vendedor de outra rede (sem relação nenhuma) não vê os lançamentos do master.
      const outroVendedor = await criarPersonaComEmpresa("vendedor", {
        emailPrefix: "vend-outra-rede",
      });
      const { data: comoOutro, error: eOutro } = await outroVendedor.client
        .from("comissao_lancamentos")
        .select("id")
        .eq("beneficiario_id", master.userId)
        .eq("competencia", competencia);
      expect(eOutro).toBeNull();
      expect(comoOutro ?? []).toHaveLength(0);
    });
  });
});
