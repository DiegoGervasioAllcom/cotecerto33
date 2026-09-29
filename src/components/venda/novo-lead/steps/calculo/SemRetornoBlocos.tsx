// Blocos de "sem retorno" do passo Cálculo (V12.4.2). Classes do protótipo V12
// (`.calc-card.sem-ret`, `.sem-retorno`, `.msg-bloco.erro`). O motivo é sempre
// a mensagem real do portal (texto puro), nunca texto inventado.
import { SeguradoraBadge } from "@/components/venda/novo-lead/SeguradoraBadge";
import type { SeguradoraSemRetorno } from "@/components/venda/cotacoes/quiver-resultado";

export function CardSeguradoraSemRetorno({ item }: { item: SeguradoraSemRetorno }) {
  return (
    <div className="calc-card sem-ret">
      <div className="calc-head">
        <div className="calc-ins">
          <SeguradoraBadge nome={item.seguradora} tam="sm" /> {item.seguradora}
        </div>
        {item.produto && <span className="chip chip-slate">{item.produto}</span>}
      </div>
      <div className="sem-retorno">
        <svg width="18" height="18">
          <use href="#i-alert-triangle" />
        </svg>
        <div>
          <strong>Sem retorno da cotação</strong>
          {item.motivo && <div className="muted small">{item.motivo}</div>}
        </div>
      </div>
    </div>
  );
}

export function FaixasSemRetorno({ faixas }: { faixas: Array<{ faixa: string; motivo: string }> }) {
  if (faixas.length === 0) return null;
  return (
    <div className="calc-tiers">
      {faixas.map((item) => (
        <div className="msg-bloco erro" key={item.faixa}>
          <div className="mb-h">
            <div>
              <strong>{item.faixa} — sem retorno</strong>
            </div>
          </div>
          <div className="small muted">{item.motivo}</div>
        </div>
      ))}
    </div>
  );
}
