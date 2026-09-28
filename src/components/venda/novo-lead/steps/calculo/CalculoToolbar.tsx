/**
 * Barra de ferramentas do passo Cálculo (`.calc-bar` no protótipo V12 ·
 * `calcBarra()`, cotecerto_prototipo_v12 linha ~4558): faixa de preço,
 * ordenação, alternância lista/cartões (`.calc-toolset`) e as ações
 * Imprimir/Recalcular que já existiam no topo da tela.
 *
 * O filtro de tipo de cobertura (`.cob-filtro` Compreensiva/Demais/Todas) do
 * protótipo fica fora — decisão do usuário (V12.3.12): não há dado real de
 * tipo de cobertura por oferta hoje.
 */
import {
  FAIXAS_PRECO_CALCULO,
  ORDEM_CALCULO_OPCOES,
  type FaixaPrecoCalculo,
  type OrdemCalculo,
} from "@/components/venda/cotacoes/quiver-resultado";

export type CalcView = "lista" | "cards";

type Props = {
  view: CalcView;
  onSetView: (view: CalcView) => void;
  ordem: OrdemCalculo;
  onSetOrdem: (ordem: OrdemCalculo) => void;
  faixa: FaixaPrecoCalculo;
  onSetFaixa: (faixa: FaixaPrecoCalculo) => void;
  podeImprimir: boolean;
  onImprimir: () => void;
  podeRecalcular: boolean;
  calculando: boolean;
  onRecalcular: () => void;
  tituloRecalcular?: string;
};

export function CalculoToolbar({
  view,
  onSetView,
  ordem,
  onSetOrdem,
  faixa,
  onSetFaixa,
  podeImprimir,
  onImprimir,
  podeRecalcular,
  calculando,
  onRecalcular,
  tituloRecalcular,
}: Props) {
  return (
    <div className="calc-bar">
      <div className="calc-bar-l">
        {faixa && (
          <span className="chip chip-yellow" style={{ fontSize: "var(--fs-xs)" }}>
            filtro de preço ativo
          </span>
        )}
      </div>
      <div className="calc-bar-r">
        <select
          className="select-mini"
          aria-label="Faixa de preço"
          value={faixa}
          onChange={(e) => onSetFaixa(e.target.value as FaixaPrecoCalculo)}
        >
          {FAIXAS_PRECO_CALCULO.map(([valor, label]) => (
            <option key={valor || "todas"} value={valor}>
              {label}
            </option>
          ))}
        </select>
        <select
          className="select-mini"
          aria-label="Ordenação"
          value={ordem}
          onChange={(e) => onSetOrdem(e.target.value as OrdemCalculo)}
        >
          {ORDEM_CALCULO_OPCOES.map(([valor, label]) => (
            <option key={valor} value={valor}>
              {label}
            </option>
          ))}
        </select>
        <div className="calc-toolset" data-tour="calc-toolset">
          <button
            type="button"
            className={`calc-tool ${view === "cards" ? "on" : ""}`.trim()}
            title="Ver em cartões"
            onClick={() => onSetView("cards")}
          >
            <svg width="15" height="15">
              <use href="#i-grid" />
            </svg>
          </button>
          <button
            type="button"
            className={`calc-tool ${view === "lista" ? "on" : ""}`.trim()}
            title="Ver em lista comparativa"
            onClick={() => onSetView("lista")}
          >
            <svg width="15" height="15">
              <use href="#i-list" />
            </svg>
          </button>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          data-tour="calc-imprimir"
          disabled={!podeImprimir}
          onClick={onImprimir}
        >
          <svg width="13" height="13">
            <use href="#i-download" />
          </svg>{" "}
          Imprimir
        </button>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          disabled={!podeRecalcular || calculando}
          title={tituloRecalcular}
          onClick={onRecalcular}
        >
          <svg width="13" height="13">
            <use href="#i-refresh" />
          </svg>{" "}
          {calculando ? "Calculando…" : "Recalcular"}
        </button>
      </div>
    </div>
  );
}
