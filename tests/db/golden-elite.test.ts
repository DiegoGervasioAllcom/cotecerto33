import { describe, it, expect } from "vitest";
import {
  admin,
  criarPersonaComEmpresa,
  loginMatriz,
  criarUsuario,
  uniq,
  type Db,
} from "../helpers/supabase";

/**
 * G4.5 (051) — RPC de fechamento das campanhas Elite trimestrais
 * (`fechar_campanha_elite`).
 *
 * Faixas seedadas em campanhas_elite (G4.1):
 *   elite_franqueado: 50k->5% | 75k->10% | 100k->20% | 150k->30%
 *   elite_master:     200k->5% | 300k->15% | 400k->30% | 500k->50%
 *
 * Bônus = STEP SIMPLES: bonus_pct da faixa mais alta atingida (minimo <=
 * produção do trimestre) incide sobre a COMISSÃO INTEIRA do trimestre
 * (créditos - débitos do próprio beneficiário, competências do trimestre,
 * excluindo origem='campanha_elite').
 *
 * Cada cenário usa um trimestre (ano, Q) próprio para não colidir com a
 * trava de idempotência (permanente, sem reabertura). O ano é sorteado por
 * execução da suíte (mesmo padrão de golden-fechamento.test.ts) para rodar
 * 2x seguidas sem `db:reset`.
 */
const ANO = 2200 + (Date.now() % 700);

async function inserirLancamento(opts: {
  beneficiarioId: string;
  tipo: "credito" | "debito";
  valor: number;
  competencia: string;
  empresaId?: string | null;
  origem?: string;
}) {
  const { error } = await admin.from("comissao_lancamentos").insert({
    vendedor_id: opts.beneficiarioId,
    beneficiario_id: opts.beneficiarioId,
    empresa_id: opts.empresaId ?? null,
    tipo: opts.tipo,
    valor: opts.valor,
    descricao: "fixture golden-elite",
    origem: opts.origem ?? "auto",
    competencia: opts.competencia,
  });
  if (error) throw error;
}

async function inserirProposta(opts: {
  empresaId: string;
  premio: number;
  competencia: string; // usa dia 10 (< 26) para cair na própria competência
  cancelada?: boolean;
}) {
  const pagoEm = `${opts.competencia}-10T12:00:00-03:00`;
  const { error } = await admin.from("propostas").insert({
    empresa_id: opts.empresaId,
    status: "gerada",
    premio: opts.premio,
    pago_em: pagoEm,
    cancelada_em: opts.cancelada ? `${opts.competencia}-12T12:00:00-03:00` : null,
  });
  if (error) throw error;
}

// competências do trimestre 1 (jan/fev/mar) do ano da suíte.
function compsQ1(ano: number) {
  return [`${ano}-01`, `${ano}-02`, `${ano}-03`];
}

async function saldoBeneficiario(beneficiarioId: string, competencias: string[]) {
  const { data, error } = await admin
    .from("comissao_lancamentos")
    .select("tipo, valor, origem, papel, competencia")
    .eq("beneficiario_id", beneficiarioId)
    .in("competencia", competencias);
  if (error) throw error;
  return data ?? [];
}

describe("G4.5 — fechar_campanha_elite (golden tests)", () => {
  it("franqueado individual: produção 120k -> faixa 100k (20%); comissão 3000 -> bônus 600", async () => {
    const ano = ANO;
    const [c1, c2, c3] = compsQ1(ano);
    const matriz = await loginMatriz();

    const franq = await criarPersonaComEmpresa("franqueado", { emailPrefix: "elite-f1" });
    // produção 120.000 no trimestre (40k em cada competência).
    await inserirProposta({ empresaId: franq.empresaId, premio: 40000, competencia: c1 });
    await inserirProposta({ empresaId: franq.empresaId, premio: 40000, competencia: c2 });
    await inserirProposta({ empresaId: franq.empresaId, premio: 40000, competencia: c3 });
    // comissão do trimestre (excluindo campanha_elite) = 1000 + 1000 + 1000 = 3000.
    await inserirLancamento({
      beneficiarioId: franq.userId,
      tipo: "credito",
      valor: 1000,
      competencia: c1,
    });
    await inserirLancamento({
      beneficiarioId: franq.userId,
      tipo: "credito",
      valor: 1000,
      competencia: c2,
    });
    await inserirLancamento({
      beneficiarioId: franq.userId,
      tipo: "credito",
      valor: 1000,
      competencia: c3,
    });

    const { data: resumo, error } = await matriz.rpc("fechar_campanha_elite", {
      p_ano: ano,
      p_trimestre: 1,
    });
    expect(error).toBeNull();
    expect(resumo).toMatchObject({ elite_franqueado: { qtd: 1, soma: 600 } });

    const linhas = await saldoBeneficiario(franq.userId, [c1, c2, c3]);
    const linhaElite = linhas.find((l) => l.origem === "campanha_elite");
    expect(linhaElite).toMatchObject({
      tipo: "credito",
      valor: 600,
      papel: "elite_franqueado",
      competencia: c3, // última competência do trimestre
    });
  });

  it("franqueado com produção 40k (< faixa mínima 50k) -> sem bônus", async () => {
    const ano = ANO + 1;
    const [c1, c2, c3] = compsQ1(ano);
    const matriz = await loginMatriz();

    const franq = await criarPersonaComEmpresa("franqueado", { emailPrefix: "elite-f2" });
    await inserirProposta({ empresaId: franq.empresaId, premio: 40000, competencia: c1 });
    await inserirLancamento({
      beneficiarioId: franq.userId,
      tipo: "credito",
      valor: 1000,
      competencia: c1,
    });

    const { error } = await matriz.rpc("fechar_campanha_elite", { p_ano: ano, p_trimestre: 1 });
    expect(error).toBeNull();

    const linhas = await saldoBeneficiario(franq.userId, [c1, c2, c3]);
    expect(linhas.some((l) => l.origem === "campanha_elite")).toBe(false);
  });

  it("franqueado FULL também participa (mesmo cálculo)", async () => {
    const ano = ANO + 2;
    const [c1, c2, c3] = compsQ1(ano);
    const matriz = await loginMatriz();

    const { data: modeloFull, error: eModelo } = await admin
      .from("modelos_franquia")
      .insert({ nome: uniq("Modelo Full Elite"), tipo: "franqueada", modalidade: "full" })
      .select("id")
      .single();
    if (eModelo) throw eModelo;

    const franqFull = await criarPersonaComEmpresa("franqueado", { emailPrefix: "elite-full" });
    await admin.from("empresas").update({ modelo_id: modeloFull.id }).eq("id", franqFull.empresaId);

    await inserirProposta({ empresaId: franqFull.empresaId, premio: 60000, competencia: c1 }); // faixa 50k (5%)
    await inserirLancamento({
      beneficiarioId: franqFull.userId,
      tipo: "credito",
      valor: 2000,
      competencia: c1,
    });

    const { data: resumo, error } = await matriz.rpc("fechar_campanha_elite", {
      p_ano: ano,
      p_trimestre: 1,
    });
    expect(error).toBeNull();
    expect(resumo).toMatchObject({ elite_franqueado: { qtd: 1, soma: 100 } }); // 5% de 2000

    const linhas = await saldoBeneficiario(franqFull.userId, [c1, c2, c3]);
    expect(linhas.find((l) => l.origem === "campanha_elite")).toMatchObject({
      valor: 100,
      papel: "elite_franqueado",
    });
  });

  it("master com rede produzindo 350k -> faixa 300k (15%); bônus = 15% da comissão do trimestre", async () => {
    const ano = ANO + 3;
    const [c1, c2, c3] = compsQ1(ano);
    const matriz = await loginMatriz();

    const master = await criarPersonaComEmpresa("master", { emailPrefix: "elite-master" });
    const franq1 = await criarPersonaComEmpresa("franqueado", {
      emailPrefix: "elite-master-franq1",
      superiorId: master.userId,
    });
    const franq2 = await criarPersonaComEmpresa("franqueado", {
      emailPrefix: "elite-master-franq2",
      superiorId: master.userId,
    });

    // produção da rede (subordinados, exclui o próprio master): 200k + 150k = 350k.
    await inserirProposta({ empresaId: franq1.empresaId, premio: 200000, competencia: c1 });
    await inserirProposta({ empresaId: franq2.empresaId, premio: 150000, competencia: c1 });

    // comissão do trimestre do MASTER (ex.: overrides somados) = 1500 + 500 - 200 (débito) = 1800.
    await inserirLancamento({
      beneficiarioId: master.userId,
      tipo: "credito",
      valor: 1500,
      competencia: c1,
    });
    await inserirLancamento({
      beneficiarioId: master.userId,
      tipo: "credito",
      valor: 500,
      competencia: c2,
    });
    await inserirLancamento({
      beneficiarioId: master.userId,
      tipo: "debito",
      valor: 200,
      competencia: c3,
    });

    const { data: resumo, error } = await matriz.rpc("fechar_campanha_elite", {
      p_ano: ano,
      p_trimestre: 1,
    });
    expect(error).toBeNull();
    // 15% de 1800 = 270.
    expect(resumo).toMatchObject({ elite_master: { qtd: 1, soma: 270 } });

    const linhas = await saldoBeneficiario(master.userId, [c1, c2, c3]);
    expect(linhas.find((l) => l.origem === "campanha_elite")).toMatchObject({
      tipo: "credito",
      valor: 270,
      papel: "elite_master",
      competencia: c3,
    });
  });

  it("supervisor NÃO recebe elite, mesmo com produção alta na própria rede", async () => {
    const ano = ANO + 4;
    const [c1, c2, c3] = compsQ1(ano);
    const matriz = await loginMatriz();

    const supervisor = await criarPersonaComEmpresa("supervisor", {
      emailPrefix: "elite-supervisor",
    });
    const franq = await criarPersonaComEmpresa("franqueado", {
      emailPrefix: "elite-supervisor-franq",
      superiorId: supervisor.userId,
    });

    await inserirProposta({ empresaId: franq.empresaId, premio: 500000, competencia: c1 });
    await inserirLancamento({
      beneficiarioId: supervisor.userId,
      tipo: "credito",
      valor: 5000,
      competencia: c1,
    });

    const { error } = await matriz.rpc("fechar_campanha_elite", { p_ano: ano, p_trimestre: 1 });
    expect(error).toBeNull();

    const linhas = await saldoBeneficiario(supervisor.userId, [c1, c2, c3]);
    expect(linhas.some((l) => l.origem === "campanha_elite")).toBe(false);
  });

  it("bônus não compõe: campanha_elite de trimestre ANTERIOR não entra na base do bônus do trimestre atual", async () => {
    // Nota de design: dentro do MESMO trimestre, um lançamento origem='campanha_elite'
    // pré-existente nas 3 competências sempre dispara a trava de idempotência primeiro
    // (ver teste de idempotência, abaixo) — ou seja, o filtro `origem <> 'campanha_elite'`
    // na soma da comissão-base nunca chega a ser exercido DENTRO do mesmo trimestre; ele
    // é defesa em profundidade. O que este teste comprova é o cenário real de "não compor
    // bônus sobre bônus": o bônus creditado no TRIMESTRE ANTERIOR (Q4 do ano-1, competência
    // diferente) não é somado na comissão-base do trimestre atual (Q1) — nem pelo filtro de
    // competência (já não pertence às 3 competências do trimestre), nem pelo filtro de
    // origem (redundante aqui, mas documentado).
    const ano = ANO + 5;
    const [c1, c2, c3] = compsQ1(ano);
    const matriz = await loginMatriz();

    const franq = await criarPersonaComEmpresa("franqueado", { emailPrefix: "elite-nao-compoe" });
    // bônus do trimestre ANTERIOR (Q4 do ano-1) — não deve entrar na base do Q1 atual.
    await inserirLancamento({
      beneficiarioId: franq.userId,
      tipo: "credito",
      valor: 999999,
      competencia: `${ano - 1}-12`,
      origem: "campanha_elite",
    });

    await inserirProposta({ empresaId: franq.empresaId, premio: 60000, competencia: c1 }); // faixa 50k (5%)
    await inserirLancamento({
      beneficiarioId: franq.userId,
      tipo: "credito",
      valor: 1000,
      competencia: c1,
    });

    const { data: resumo, error } = await matriz.rpc("fechar_campanha_elite", {
      p_ano: ano,
      p_trimestre: 1,
    });
    expect(error).toBeNull();
    // 5% de 1000 = 50 (NÃO 5% de 1.000.999 — o bônus antigo não compôs a base).
    expect(resumo).toMatchObject({ elite_franqueado: { qtd: 1, soma: 50 } });

    const linhas = await saldoBeneficiario(franq.userId, [c1, c2, c3]);
    expect(linhas.find((l) => l.origem === "campanha_elite" && l.competencia === c3)).toMatchObject(
      {
        valor: 50,
      },
    );
  });

  it("idempotência: 2ª chamada do mesmo (ano,trimestre) -> exceção 'já paga'", async () => {
    const ano = ANO + 6;
    const [c1] = compsQ1(ano);
    const matriz = await loginMatriz();

    const franq = await criarPersonaComEmpresa("franqueado", { emailPrefix: "elite-idemp" });
    await inserirProposta({ empresaId: franq.empresaId, premio: 60000, competencia: c1 });
    await inserirLancamento({
      beneficiarioId: franq.userId,
      tipo: "credito",
      valor: 1000,
      competencia: c1,
    });

    const { error: e1 } = await matriz.rpc("fechar_campanha_elite", { p_ano: ano, p_trimestre: 1 });
    expect(e1).toBeNull();

    const { error: e2 } = await matriz.rpc("fechar_campanha_elite", { p_ano: ano, p_trimestre: 1 });
    expect(e2).not.toBeNull();
    expect(e2!.message).toMatch(/já paga/);
  });

  it("segurança: vendedor chama a RPC -> forbidden", async () => {
    const ano = ANO + 7;
    const vendedor = await criarUsuario(`${uniq("elite-vend")}@teste.local`);
    const { error } = await (vendedor.client as Db).rpc("fechar_campanha_elite", {
      p_ano: ano,
      p_trimestre: 1,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/forbidden/);
  });
});
