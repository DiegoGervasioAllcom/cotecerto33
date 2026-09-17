import { describe, it, expect } from "vitest";
import {
  classificarUrgencia,
  diasParados,
  lembreteParaItem,
  limiteRiscoISO,
  montarAgenda,
  ordenarAgenda,
  retornoParaItem,
  riscoParaItem,
  RISCO_DIAS_PARADO,
  type AgendaItem,
  type LembreteRow,
  type RetornoRow,
  type RiscoRow,
} from "@/lib/agenda";

// Data de referência fixa para os testes não dependerem do dia em que rodam.
const AGORA = new Date(2026, 8, 17, 10, 0, 0); // 17/09/2026 (mês 0-based)

describe("classificarUrgencia (unitário puro — agrupamento da agenda)", () => {
  it("data no passado é 'atrasado'", () => {
    expect(classificarUrgencia("2026-09-16", AGORA)).toMatchObject({
      label: "atrasado",
      chipClass: "chip-alert",
      ord: 0,
    });
  });

  it("data de hoje é 'hoje'", () => {
    expect(classificarUrgencia("2026-09-17", AGORA)).toMatchObject({
      label: "hoje",
      chipClass: "chip-yellow",
      ord: 1,
    });
  });

  it("data de amanhã é 'amanhã'", () => {
    expect(classificarUrgencia("2026-09-18", AGORA)).toMatchObject({
      label: "amanhã",
      chipClass: "chip-slate",
      ord: 2,
    });
  });

  it("data mais distante cai no grupo 'depois', com a data formatada", () => {
    const r = classificarUrgencia("2026-09-25", AGORA);
    expect(r.ord).toBe(3);
    expect(r.chipClass).toBe("chip-slate");
    expect(r.label).toBe("25/09");
  });

  it("não sofre o bug de fuso: yyyy-mm-dd de hoje nunca cai no dia anterior", () => {
    // new Date("2026-09-17") ingenuamente interpretaria como UTC e poderia
    // "voltar" um dia em fusos negativos — por isso o parse é manual.
    expect(classificarUrgencia("2026-09-17", AGORA).ord).toBe(1);
  });
});

describe("ordenarAgenda (unitário puro)", () => {
  function item(data: string, hora: string | null, id: string): AgendaItem {
    return {
      id,
      fonte: "lembrete",
      data,
      hora,
      titulo: id,
      texto: "",
      leadId: null,
      statusPipeline: null,
      cotacaoId: null,
      tipoLembrete: "tarefa",
    };
  }

  it("ordena atrasado > hoje > amanhã > depois", () => {
    const itens = [
      item("2026-09-25", null, "depois"),
      item("2026-09-18", null, "amanha"),
      item("2026-09-16", null, "atrasado"),
      item("2026-09-17", null, "hoje"),
    ];
    expect(ordenarAgenda(itens, AGORA).map((i) => i.id)).toEqual([
      "atrasado",
      "hoje",
      "amanha",
      "depois",
    ]);
  });

  it("dentro do mesmo grupo de urgência, desempata por hora", () => {
    const itens = [
      item("2026-09-17", "18:00", "tarde"),
      item("2026-09-17", "08:00", "manha"),
      item("2026-09-17", null, "sem-hora"),
    ];
    expect(ordenarAgenda(itens, AGORA).map((i) => i.id)).toEqual(["sem-hora", "manha", "tarde"]);
  });
});

describe("limiteRiscoISO / diasParados (unitário puro)", () => {
  it("o limite de risco é RISCO_DIAS_PARADO dias antes de 'agora'", () => {
    const limite = new Date(limiteRiscoISO(AGORA));
    const esperado = AGORA.getTime() - RISCO_DIAS_PARADO * 24 * 60 * 60 * 1000;
    expect(limite.getTime()).toBe(esperado);
  });

  it("diasParados nunca é negativo mesmo com atualizado_em no futuro", () => {
    const futuro = new Date(AGORA.getTime() + 60 * 60 * 1000).toISOString();
    expect(diasParados(futuro, AGORA)).toBe(0);
  });

  it("diasParados arredonda para baixo dias parciais", () => {
    const tresDiasEMeio = new Date(AGORA.getTime() - 3.5 * 24 * 60 * 60 * 1000).toISOString();
    expect(diasParados(tresDiasEMeio, AGORA)).toBe(3);
  });
});

describe("montarAgenda (unitário puro — junta as 3 fontes já ordenadas)", () => {
  const retorno: RetornoRow = {
    id: "r1",
    data: "2026-09-16", // atrasado
    hora: "09:00",
    nota: "Ligar de novo",
    lead: { id: "lead-1", nome: "Ana", dados: null, status_pipeline: "contato" },
  };
  const risco: RiscoRow = {
    id: "cot-1",
    numero: 42,
    atualizado_em: new Date(AGORA.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    segurado: { nome: "Bruno" },
    veiculo: { marca_nome: "FIAT", modelo_nome: "UNO", ano_modelo: "2020" },
  };
  const lembrete: LembreteRow = {
    id: "lb1",
    tipo: "tarefa",
    titulo: "Enviar relatório",
    nota: null,
    data: "2026-09-17", // hoje
    hora: "17:00",
    lead: null,
  };

  it("mapeia cada linha de origem para o AgendaItem com fonte e ids corretos", () => {
    expect(retornoParaItem(retorno)).toMatchObject({
      id: "retorno:r1",
      fonte: "retorno",
      leadId: "lead-1",
      statusPipeline: "contato",
      cotacaoId: null,
    });
    expect(riscoParaItem(risco, AGORA)).toMatchObject({
      id: "risco:cot-1",
      fonte: "risco",
      leadId: null,
      cotacaoId: "cot-1",
    });
    expect(lembreteParaItem(lembrete)).toMatchObject({
      id: "lembrete:lb1",
      fonte: "lembrete",
      leadId: null,
      tipoLembrete: "tarefa",
    });
  });

  it("junta as 3 fontes e ordena por urgência (atrasado > hoje > depois)", () => {
    // retorno e risco caem no mesmo grupo "atrasado" (ord 0); dentro do grupo
    // o desempate é por hora, e risco não tem hora (null) — por isso vem
    // primeiro. O lembrete (hoje, ord 1) fica por último.
    const itens = montarAgenda([retorno], [risco], [lembrete], AGORA);
    expect(itens.map((i) => i.fonte)).toEqual(["risco", "retorno", "lembrete"]);
  });

  it("negócio em risco (atrasado por definição) nunca some da lista quando parado há mais dias", () => {
    const parado10Dias: RiscoRow = {
      ...risco,
      id: "cot-2",
      atualizado_em: new Date(AGORA.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const item = riscoParaItem(parado10Dias, AGORA);
    expect(item.texto).toContain("10 dias");
    expect(classificarUrgencia(item.data, AGORA).ord).toBe(0);
  });
});
