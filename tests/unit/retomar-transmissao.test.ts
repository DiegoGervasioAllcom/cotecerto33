import { describe, expect, it } from "vitest";
import {
  parseTransmissaoOfertaSnapshot,
  resolverEstadoTransmissao,
  type TransmissaoOfertaSnapshot,
  type TransmissaoTentativaResumo,
} from "@/components/venda/novo-lead/hooks/useRetomarTransmissao";

function tentativa(overrides: Partial<TransmissaoTentativaResumo>): TransmissaoTentativaResumo {
  return {
    id: "tentativa-1",
    seguradora: "Mapfre",
    produto_id: "10290_81",
    produto: "Auto Fácil",
    forma_pagamento: "Boleto",
    parcelas: "6x",
    premio: 1234.56,
    status: "enviada",
    motivo: null,
    mensagem: null,
    proposta_id: null,
    ...overrides,
  };
}

const snapshot: TransmissaoOfertaSnapshot = {
  seguradora: "Aliro",
  produto_id: "aliro-1",
  produto: "Aliro Compreensivo",
  forma_pagamento: "Cartão de crédito",
  parcelas: "3x",
  premio: 987.65,
};

describe("resolverEstadoTransmissao", () => {
  it("sem tentativa e sem snapshot: nada pra retomar (comportamento atual — Cálculo)", () => {
    expect(resolverEstadoTransmissao(null, null)).toEqual({ tipo: "nenhum" });
  });

  it("sem tentativa, só snapshot: reabre em Dados complementares com a oferta do snapshot", () => {
    const estado = resolverEstadoTransmissao(null, snapshot);
    expect(estado.tipo).toBe("dados");
    if (estado.tipo !== "dados") throw new Error("esperava tipo dados");
    expect(estado.oferta.resultado.seguradora).toBe("Aliro");
    expect(estado.oferta.resultado.produtoId).toBe("aliro-1");
    expect(estado.oferta.resultado.produto).toBe("Aliro Compreensivo");
    expect(estado.oferta.formaPagamento).toBe("Cartão de crédito");
    expect(estado.oferta.parcelas).toBe("3x");
    expect(estado.oferta.premio).toBe(987.65);
  });

  it("tentativa enviada: aguardando, com o id da tentativa pro polling", () => {
    const estado = resolverEstadoTransmissao(tentativa({ status: "enviada" }), null);
    expect(estado.tipo).toBe("aguardando");
    if (estado.tipo !== "aguardando") throw new Error("esperava tipo aguardando");
    expect(estado.tentativaId).toBe("tentativa-1");
    expect(estado.oferta.resultado.seguradora).toBe("Mapfre");
    expect(estado.oferta.formaPagamento).toBe("Boleto");
  });

  it("tentativa falha: card de resultado com motivo/mensagem, sem polling", () => {
    const estado = resolverEstadoTransmissao(
      tentativa({ status: "falha", motivo: "Dado inconsistente", mensagem: "CEP inválido" }),
      null,
    );
    expect(estado.tipo).toBe("resultado");
    if (estado.tipo !== "resultado") throw new Error("esperava tipo resultado");
    expect(estado.resultado.status).toBe("falha");
    expect(estado.resultado.motivo).toBe("Dado inconsistente");
    expect(estado.resultado.mensagem).toBe("CEP inválido");
  });

  it("tentativa transmitida: card de resultado com o id da proposta", () => {
    const estado = resolverEstadoTransmissao(
      tentativa({ status: "transmitida", proposta_id: "proposta-9" }),
      null,
    );
    expect(estado.tipo).toBe("resultado");
    if (estado.tipo !== "resultado") throw new Error("esperava tipo resultado");
    expect(estado.resultado.status).toBe("transmitida");
    expect(estado.resultado.propostaId).toBe("proposta-9");
  });

  it("tentativa sem seguradora/forma de pagamento e sem snapshot: não inventa oferta", () => {
    const estado = resolverEstadoTransmissao(
      tentativa({ seguradora: null, forma_pagamento: null, status: "falha" }),
      null,
    );
    expect(estado).toEqual({ tipo: "nenhum" });
  });

  it("status fora do esperado (defensivo): cai pra nenhum em vez de travar o wizard", () => {
    const estado = resolverEstadoTransmissao(
      tentativa({ status: "cancelada" as unknown as string }),
      null,
    );
    expect(estado).toEqual({ tipo: "nenhum" });
  });
});

describe("parseTransmissaoOfertaSnapshot", () => {
  it("aceita um snapshot válido", () => {
    expect(parseTransmissaoOfertaSnapshot(snapshot)).toEqual(snapshot);
  });

  it("rejeita null/undefined", () => {
    expect(parseTransmissaoOfertaSnapshot(null)).toBeNull();
    expect(parseTransmissaoOfertaSnapshot(undefined)).toBeNull();
  });

  it("rejeita objeto sem seguradora/forma_pagamento", () => {
    expect(parseTransmissaoOfertaSnapshot({ produto: "X" })).toBeNull();
  });

  it("rejeita shape inesperado (ex.: string solta)", () => {
    expect(parseTransmissaoOfertaSnapshot("não é objeto")).toBeNull();
  });
});
