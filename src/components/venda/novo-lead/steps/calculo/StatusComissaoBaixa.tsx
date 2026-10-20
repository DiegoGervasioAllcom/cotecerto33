// Estado do pedido de comissão abaixo de 20% na linha da seguradora (Cálculo):
// aguardando / aprovada (calculando sozinho) / recusada (com motivo) + cancelar.
import type { AjusteGuardado } from "@/components/venda/novo-lead/hooks/useAjustesSeguradora";
import {
  useCancelarComissaoBaixa,
  type ComissaoSolicitacao,
} from "@/components/venda/novo-lead/hooks/useComissaoSolicitacoes";

const fmtPct = (n: number) => String(n).replace(".", ",");

type Props = {
  cotacaoId: string | null;
  solicitacao?: ComissaoSolicitacao;
  ajuste?: AjusteGuardado;
  /** Reabre o "Personalizar" para refazer com outro valor. */
  onRefazer: () => void;
  /** Abre o recálculo manual desta seguradora. */
  onRecalcular: () => void;
};

export function StatusComissaoBaixa({
  cotacaoId,
  solicitacao,
  ajuste,
  onRefazer,
  onRecalcular,
}: Props) {
  const cancelar = useCancelarComissaoBaixa(cotacaoId);
  if (!solicitacao) return null;
  const pct = fmtPct(solicitacao.comissaoPct);

  if (solicitacao.status === "pendente") {
    return (
      <div className="muted small" role="status" data-testid="comissao-baixa-pendente">
        <span className="chip chip-yellow">Comissão {pct}% aguardando aprovação</span>{" "}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void cancelar(solicitacao.id)}
        >
          Cancelar
        </button>
      </div>
    );
  }
  if (solicitacao.status === "aprovada") {
    const calculado = ajuste?.aplicadoEm != null;
    if (!calculado && solicitacao.calculoErro) {
      return (
        <div className="banner alert" role="alert" data-testid="comissao-baixa-calculo-falhou">
          <span className="chip chip-ok">Comissão {pct}% aprovada</span> Falha ao calcular
          automaticamente{" "}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRecalcular}>
            Recalcular
          </button>
        </div>
      );
    }
    return (
      <div className="muted small" role="status" data-testid="comissao-baixa-aprovada">
        <span className="chip chip-ok">Comissão {pct}% aprovada</span>{" "}
        {calculado ? "cálculo disparado" : "calculando automaticamente…"}
      </div>
    );
  }
  return (
    <div className="banner alert" role="alert" data-testid="comissao-baixa-recusada">
      Cotação recusada com {pct}%{solicitacao.motivoRecusa ? ` — ${solicitacao.motivoRecusa}` : ""}{" "}
      <button type="button" className="btn btn-ghost btn-sm" onClick={onRefazer}>
        Refazer com outro valor
      </button>
    </div>
  );
}
