import { describe, it, expect } from "vitest";
import {
  pipelineHeaderResumo,
  pontoExato,
  retornoLabel,
  veiculoResumo,
} from "@/components/venda/pipeline/pipeline-format";
import type { LeadEtapaBucket } from "@/lib/lead-etapa";
import type { PipelineLeadRow } from "@/lib/pipeline-data";

// Lógica pura do card/header do Pipeline (Kanban/Tabela) — T9. Roda offline.

describe("veiculoResumo", () => {
  it("junta marca, modelo e ano quando existem", () => {
    expect(veiculoResumo({ marca_nome: "Fiat", modelo_nome: "Argo", ano_modelo: "2022" })).toBe(
      "Fiat Argo 2022",
    );
  });

  it("ignora partes ausentes", () => {
    expect(veiculoResumo({ marca_nome: "Fiat", modelo_nome: null, ano_modelo: null })).toBe("Fiat");
  });

  it("retorna null sem veículo", () => {
    expect(veiculoResumo(null)).toBeNull();
    expect(veiculoResumo(undefined)).toBeNull();
  });
});

describe("pontoExato", () => {
  const casos: [LeadEtapaBucket, string | null][] = [
    ["novo", "aguardando o primeiro contato"],
    ["cotacao", "preenchendo a cotação"],
    ["negociacao", "no cálculo — comparando seguradoras"],
    ["finalizacao", "transmissão em andamento"],
    ["fechamento", "aguardando a seguradora"],
    ["perdido", null],
  ];
  it.each(casos)("%s -> %s", (etapa, esperado) => {
    expect(pontoExato(etapa)).toBe(esperado);
  });
});

describe("retornoLabel", () => {
  it("inclui a hora quando presente", () => {
    const hoje = new Date();
    const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    expect(retornoLabel({ leadId: "l1", data: iso, hora: "14:30:00" })).toBe(
      "Retorno hoje · 14:30",
    );
  });

  it("sem hora, mostra só a urgência", () => {
    const hoje = new Date();
    const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    expect(retornoLabel({ leadId: "l1", data: iso, hora: null })).toBe("Retorno hoje");
  });
});

describe("pipelineHeaderResumo", () => {
  function lead(etapa: LeadEtapaBucket): Pick<PipelineLeadRow, "etapa"> {
    return { etapa };
  }

  it("conta ativos, negociação e fechamento — perdido não entra nos totais", () => {
    const todos = [
      lead("novo"),
      lead("cotacao"),
      lead("negociacao"),
      lead("negociacao"),
      lead("fechamento"),
      lead("perdido"),
    ];
    const filtrados = [lead("novo"), lead("negociacao")];
    expect(pipelineHeaderResumo(todos, filtrados)).toBe(
      "2 de 5 leads em andamento · 2 em negociação · 1 em fechamento",
    );
  });
});
