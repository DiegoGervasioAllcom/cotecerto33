/**
 * `selecionarSolicitacoesParaCancelar` (`useDescontoAdicional.tsx`) — parte
 * pura de "Recalcular esta seguradora" (V12.3.6 · `.seg-acoes`): decide quais
 * pedidos de desconto (`desconto_solicitacoes`) de OUTRAS seguradoras
 * precisam ser cancelados antes do recálculo. Só pendente/aguardando aceite
 * de seguradora diferente da escolhida entram na lista — os já resolvidos
 * (aprovado/negado/cancelado) e os da própria seguradora ficam de fora.
 */
import { describe, expect, it } from "vitest";
import {
  selecionarSolicitacoesParaCancelar,
  type SolicitacaoComparativo,
} from "@/components/venda/cotacoes/useDescontoAdicional";

function solicitacao(
  overrides: Partial<SolicitacaoComparativo> & { id: string },
): SolicitacaoComparativo {
  return {
    seguradora_id: "seg-outra",
    pct_pedido: 10,
    pct_concedido: null,
    status: "pendente",
    ...overrides,
  };
}

describe("selecionarSolicitacoesParaCancelar", () => {
  it("seleciona pendentes e aguardando aceite de outras seguradoras", () => {
    const solicitacoes = [
      solicitacao({ id: "1", seguradora_id: "seg-a", status: "pendente" }),
      solicitacao({ id: "2", seguradora_id: "seg-b", status: "aguardando_aceite" }),
    ];
    expect(selecionarSolicitacoesParaCancelar(solicitacoes, "seg-alvo")).toEqual(solicitacoes);
  });

  it("não seleciona pedidos da própria seguradora escolhida", () => {
    const solicitacoes = [
      solicitacao({ id: "1", seguradora_id: "seg-alvo", status: "pendente" }),
      solicitacao({ id: "2", seguradora_id: "seg-b", status: "pendente" }),
    ];
    const resultado = selecionarSolicitacoesParaCancelar(solicitacoes, "seg-alvo");
    expect(resultado.map((s) => s.id)).toEqual(["2"]);
  });

  it("ignora pedidos já resolvidos (aprovado/negado/cancelado)", () => {
    const solicitacoes = [
      solicitacao({ id: "1", seguradora_id: "seg-a", status: "aprovado" }),
      solicitacao({ id: "2", seguradora_id: "seg-b", status: "negado" }),
      solicitacao({ id: "3", seguradora_id: "seg-c", status: "cancelado" }),
      solicitacao({ id: "4", seguradora_id: "seg-d", status: "pendente" }),
    ];
    const resultado = selecionarSolicitacoesParaCancelar(solicitacoes, "seg-alvo");
    expect(resultado.map((s) => s.id)).toEqual(["4"]);
  });

  it("sem seguradora alvo resolvida (id nulo) ainda cancela as pendentes de terceiros", () => {
    const solicitacoes = [solicitacao({ id: "1", seguradora_id: "seg-a", status: "pendente" })];
    expect(selecionarSolicitacoesParaCancelar(solicitacoes, null)).toEqual(solicitacoes);
  });

  it("lista vazia quando não há pedidos em andamento", () => {
    const solicitacoes = [solicitacao({ id: "1", seguradora_id: "seg-a", status: "aprovado" })];
    expect(selecionarSolicitacoesParaCancelar(solicitacoes, "seg-alvo")).toEqual([]);
  });
});
