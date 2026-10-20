import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusComissaoBaixa } from "@/components/venda/novo-lead/steps/calculo/StatusComissaoBaixa";
import type { ComissaoSolicitacao } from "@/components/venda/novo-lead/hooks/useComissaoSolicitacoes";

const sol = (calculoErro: string | null): ComissaoSolicitacao => ({
  id: "1",
  seguradora: "HDI",
  comissaoPct: 15,
  status: "aprovada",
  motivoRecusa: null,
  criadoEm: "2026-10-20T00:00:00Z",
  calculoErro,
});

function html(s: ComissaoSolicitacao, aplicadoEm: string | null) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <StatusComissaoBaixa
        cotacaoId="c"
        solicitacao={s}
        ajuste={{ aplicadoEm } as never}
        onRefazer={() => {}}
        onRecalcular={() => {}}
      />
    </QueryClientProvider>,
  );
}

describe("StatusComissaoBaixa", () => {
  it("aprovada sem erro: calculando automaticamente", () => {
    expect(html(sol(null), null)).toContain("calculando automaticamente");
  });
  it("aprovada com calculo_erro: falha + Recalcular", () => {
    const h = html(sol("timeout"), null);
    expect(h).toContain("Falha ao calcular");
    expect(h).toContain("Recalcular");
    expect(h).not.toContain("calculando automaticamente");
  });
  it("já aplicado ignora o erro antigo", () => {
    expect(html(sol("timeout"), "2026-10-20")).toContain("cálculo disparado");
  });
});
