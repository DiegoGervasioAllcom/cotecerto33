// Preview estático do passo Cálculo (lista comparativa) para o tutorial do
// vendedor (V12.3.10) — usado quando `useTutorialPreview()` volta
// "lead-calculo-lista". Segue o mesmo padrão de `aceite-tutorial-preview.tsx`
// / `extrato-tutorial-preview.tsx`: markup estático com as classes reais do
// protótipo V12 (`proto.css`), botões desabilitados, sem nenhum dado novo
// além do cliente de exemplo já usado nos outros previews (Fernanda Souza ·
// VW Polo 2023).
//
// Não reusa `CalculoLista`/`SegAcoes` reais porque eles dependem de
// `ResultadoCalculo` (retorno de verdade da Quiver) — aqui não há cotação
// calculada nenhuma, só o exemplo do tutorial.
const COBERTURAS = [
  ["Casco (Valor de Mercado)", "R$ 1.850,40", "R$ 1.792,00"],
  ["RCF Danos materiais/corporais", "100 mil / 100 mil", "100 mil / 100 mil"],
  ["Assistência 24h", "Padrão", "Ampliada"],
  ["Franquia", "R$ 3.000 (reduzida)", "R$ 3.500 (normal)"],
] as const;

function SegAcoesPreview() {
  return (
    <div className="seg-acoes" data-tour="seg-acoes" aria-readonly="true">
      <button type="button" className="ic-btn" title="Mensagens de retorno da seguradora" disabled>
        <svg width="15" height="15">
          <use href="#i-message" />
        </svg>
      </button>
      <button type="button" className="ic-btn" title="Solicitar desconto adicional" disabled>
        <svg width="15" height="15">
          <use href="#i-percent" />
        </svg>
      </button>
      <button type="button" className="ic-btn" title="Prêmio (Cliente VIP) — em breve" disabled>
        <svg width="15" height="15">
          <use href="#i-award" />
        </svg>
      </button>
      <button type="button" className="ic-btn" title="Opções: análise do envio" disabled>
        <svg width="15" height="15">
          <use href="#i-settings" />
        </svg>
      </button>
      <button type="button" className="ic-btn" title="Recalcular só esta seguradora" disabled>
        <svg width="15" height="15">
          <use href="#i-refresh" />
        </svg>
      </button>
    </div>
  );
}

export function CalculoListaTutorialPreview() {
  return (
    <div className="lead-shell" style={{ display: "block" }} aria-readonly="true">
      <div className="wizard-card">
        <div className="calc-ctx" data-tour="calc-ctx">
          <span className="cx-item">
            <span className="cx-k">Cotação</span>
            <strong>#COT-2026-00842</strong>
          </span>
          <span className="cx-item">
            <span className="cx-k">Cliente</span>
            <strong>Fernanda Souza</strong>
          </span>
          <span className="cx-item">
            <span className="cx-k">Padrão</span>
            <strong>Fácil</strong>
          </span>
          <span className="cx-item">
            <span className="cx-k">Válida até</span>
            <strong>28/09/2026</strong>
          </span>
          <span className="chip chip-outline">Exemplo do tutorial</span>
        </div>

        <div className="cob-filtro" data-tour="cob-filtro">
          <button type="button" className="cob-chip" disabled>
            Cotações para a cobertura Compreensiva
          </button>
          <button type="button" className="cob-chip" disabled>
            Ofertas adicionais
          </button>
          <button type="button" className="cob-chip on" disabled>
            Todas
          </button>
        </div>

        <div className="calc-bar">
          <div className="calc-bar-l" />
          <div className="calc-bar-r">
            <div className="calc-toolset" data-tour="calc-toolset">
              <button
                type="button"
                className="calc-tool on"
                title="Ver em lista comparativa"
                disabled
              >
                <svg width="15" height="15">
                  <use href="#i-list" />
                </svg>
              </button>
              <button type="button" className="calc-tool" title="Ver em cartões" disabled>
                <svg width="15" height="15">
                  <use href="#i-grid" />
                </svg>
              </button>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" disabled>
              <svg width="13" height="13">
                <use href="#i-download" />
              </svg>{" "}
              Imprimir
            </button>
          </div>
        </div>

        <div className="cl-nav" data-tour="cl-nav">
          <button type="button" className="cl-arrow" disabled>
            <svg width="16" height="16">
              <use href="#i-chevron-left" />
            </svg>
          </button>
          <span className="cl-cont">
            <strong>7</strong> à direita <span className="cl-de">de 9 seguradoras</span>
          </span>
          <button type="button" className="cl-arrow" disabled>
            <svg width="16" height="16">
              <use href="#i-chevron-right" />
            </svg>
          </button>
        </div>

        <div className="calc-lista" data-tour="calc-lista">
          <table className="calc-table">
            <thead>
              <tr>
                <th className="cl-lbl">Coberturas</th>
                <th>
                  <div className="cl-seg">
                    <strong>Porto Seguro</strong>
                    <small>Plano Fácil</small>
                  </div>
                </th>
                <th>
                  <div className="cl-seg">
                    <strong>Azul Seguros</strong>
                    <small>Plano Fácil</small>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {COBERTURAS.map(([label, a, b]) => (
                <tr key={label}>
                  <td className="cl-lbl">{label}</td>
                  <td>{a}</td>
                  <td>{b}</td>
                </tr>
              ))}
              <tr>
                <td className="cl-lbl">Ações</td>
                <td>
                  <SegAcoesPreview />
                </td>
                <td>
                  <SegAcoesPreview />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
