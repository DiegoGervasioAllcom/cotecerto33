import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChannelFunnels, type ChannelFunnel } from "@/components/comando/channel-funnels";

function makeFunnel(order: number, indications = 20): ChannelFunnel {
  return {
    canal_id: `4b3a9f11-3e90-4d17-9dad-e398f53bdb9${order}`,
    canal_nome: `Canal renomeado ${order}`,
    ordem: order,
    indicacoes: indications,
    contatos: indications ? 16 : 0,
    cotacoes: indications ? 12 : 0,
    negociacoes: indications ? 10 : 0,
    transmissoes: indications ? 8 : 0,
    pendentes: indications ? 3 : 0,
    vendas_emitidas: indications ? 5 : 0,
  };
}

describe("funis por canal", () => {
  it("renderiza quatro cards com nomes vindos do banco e todas as etapas", () => {
    const html = renderToStaticMarkup(
      createElement(ChannelFunnels, {
        funnels: [makeFunnel(1), makeFunnel(2), makeFunnel(3), makeFunnel(4)],
        periodLabel: "mês atual",
        isLoading: false,
        error: null,
      }),
    );

    expect(html.match(/class="card"/g)).toHaveLength(4);
    expect(html).toContain("Canal renomeado 4");
    for (const stage of [
      "Indicações",
      "Contato",
      "Cotação",
      "Negociação",
      "Transmissão",
      "Pendentes",
      "Venda emitida",
    ]) {
      expect(html).toContain(stage);
    }
    expect(html).toContain("25% conv.");
  });

  it("mantém o card zerado e evita percentuais inválidos", () => {
    const html = renderToStaticMarkup(
      createElement(ChannelFunnels, {
        funnels: [makeFunnel(1, 0), makeFunnel(2), makeFunnel(3), makeFunnel(4)],
        periodLabel: "hoje",
        isLoading: false,
        error: null,
      }),
    );

    expect(html).toContain("Canal renomeado 1");
    expect(html).toContain("0% conv.");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });
});
