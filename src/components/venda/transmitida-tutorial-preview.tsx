// Preview estático da proposta "Transmitida" (fim da Etapa 7) para o
// tutorial do vendedor (V12.3.10) — usado quando `useTutorialPreview()`
// volta "lead-transmitida" (equivalente a `tourLeadTransmitido()` do
// protótipo V12). Mesmo padrão de `aceite-tutorial-preview.tsx`: markup
// estático com as classes reais (`.acc-pills`, `.doc-li`, `.atalhos`), sem
// nenhum dado novo além do exemplo já usado nos outros previews (Fernanda
// Souza · VW Polo 2023 · Seguradora do exemplo).
const AVISO_EM_BREVE = "Em breve";

export function TransmitidaTutorialPreview() {
  return (
    <div className="lead-shell">
      <div className="wizard-card" aria-readonly="true">
        <div className="acc-sol" style={{ marginBottom: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: 16 }}>Proposta 0098231 · Seguradora do exemplo</strong>
            <span className="chip chip-yellow">Em análise</span>
          </div>
          <div className="small muted" style={{ marginTop: 3 }}>
            Fernanda Souza · transmitida em 20/05/2026
          </div>
          <span className="chip chip-outline" style={{ marginTop: 8, width: "fit-content" }}>
            Exemplo do tutorial
          </span>
        </div>

        <div className="wizard-grid cols-2" style={{ marginBottom: 16 }}>
          <div className="doc-li">
            <span>Cálculo</span>
            <strong>#COT-2026-00842</strong>
          </div>
          <div className="doc-li">
            <span>Segurado</span>
            <strong>FERNANDA SOUZA</strong>
          </div>
          <div className="doc-li">
            <span>Modelo</span>
            <strong>VW Polo Comfortline 2023</strong>
          </div>
          <div className="doc-li">
            <span>Seguradora / produto</span>
            <strong>SEGURADORA DO EXEMPLO</strong>
          </div>
        </div>

        <div className="wizard-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div>
            <div className="acc-sec-t">Proposta</div>
            <table className="table-pipe ff-table">
              <tbody>
                <tr>
                  <td className="muted small">Nº da proposta</td>
                  <td>
                    <strong>0098231</strong>
                  </td>
                </tr>
                <tr>
                  <td className="muted small">Protocolo</td>
                  <td>PR-8823401</td>
                </tr>
                <tr>
                  <td className="muted small">Vigência proposta</td>
                  <td>23/05/2026 a 23/05/2027</td>
                </tr>
                <tr>
                  <td className="muted small">Vigência aceita</td>
                  <td className="muted">aguardando a seguradora</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <div className="acc-sec-t">Prêmio e pagamento</div>
            <table className="table-pipe ff-table">
              <tbody>
                <tr>
                  <td className="muted small">Prêmio total</td>
                  <td>
                    <strong>R$ 3.510,00</strong>
                  </td>
                </tr>
                <tr>
                  <td className="muted small">Pagamento</td>
                  <td>Boleto Bancário · à vista</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="acc-sec-t" style={{ marginTop: 16 }}>
          Nesta proposta
        </div>
        <div className="acc-pills" data-tour="transmitida-acoes" aria-readonly="true">
          <button type="button" className="acc-pill" disabled title={AVISO_EM_BREVE}>
            <svg width={13} height={13}>
              <use href="#i-file" />
            </svg>{" "}
            Proposta (PDF)
          </button>
          <button type="button" className="acc-pill" disabled title={AVISO_EM_BREVE}>
            <svg width={13} height={13}>
              <use href="#i-refresh" />
            </svg>{" "}
            Consultar protocolo (em breve)
          </button>
        </div>

        <div className="atalhos" data-tour="transmitida-atalhos" aria-readonly="true">
          <span className="at-lbl">Ir para</span>
          <span className="at-btn" aria-disabled="true">
            <svg width={14} height={14}>
              <use href="#i-check-circle" />
            </svg>{" "}
            Emissão &amp; histórico
          </span>
          <span className="at-btn" aria-disabled="true">
            <svg width={14} height={14}>
              <use href="#i-kanban" />
            </svg>{" "}
            Pipeline
          </span>
          <span className="spacer" />
          <span className="btn btn-slate" aria-disabled="true">
            <svg width={14} height={14}>
              <use href="#i-plus" />
            </svg>{" "}
            Nova cotação
          </span>
        </div>
      </div>
    </div>
  );
}
