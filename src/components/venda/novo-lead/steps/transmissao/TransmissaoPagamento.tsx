type Props = {
  subPassoLabel: string;
  enviando: boolean;
  erroEnvio: string | null;
  onVoltar: () => void;
  onEfetivar: () => void;
};

// Campos puramente ilustrativos (protótipo V12, `transmPagamento`) — nunca
// viram estado real nem são enviados a lugar nenhum. No sistema real os
// dados de cartão vão direto para a seguradora (ambiente PCI).
export function TransmissaoPagamento({
  subPassoLabel,
  enviando,
  erroEnvio,
  onVoltar,
  onEfetivar,
}: Props) {
  return (
    <div className="acc-sol">
      <div className="row" style={{ alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0 }}>Pagamento</h2>
          <div className="sub" style={{ margin: "4px 0 0" }}>
            Cartão de crédito · dados coletados diretamente pela seguradora.
          </div>
        </div>
        <span className="spacer" />
        <span className="chip chip-yellow">{subPassoLabel}</span>
      </div>

      <div className="wizard-grid cols-3">
        <div className="field-group full" style={{ gridColumn: "span 2" }}>
          <label>Número do cartão</label>
          <input className="input" value="•••• •••• •••• 4242" disabled />
        </div>
        <div className="field-group">
          <label>Bandeira</label>
          <input className="input" value="Visa" disabled />
        </div>
        <div className="field-group full" style={{ gridColumn: "span 2" }}>
          <label>Nome do titular</label>
          <input className="input" value="J••• S••••••" disabled />
        </div>
        <div className="field-group">
          <label>Validade</label>
          <input className="input" value="••/••" disabled />
        </div>
      </div>

      <div className="clt-note" style={{ marginTop: 12, borderColor: "var(--yellow)" }}>
        <svg width="15" height="15">
          <use href="#i-lock" />
        </svg>
        <div>
          <strong>Campos ilustrativos.</strong> No sistema real os dados do cartão vão direto para a
          seguradora (ambiente PCI), sem trafegar nem ficar guardados no CoteCerto.
        </div>
      </div>

      {erroEnvio && (
        <div className="clt-note" style={{ marginTop: 14 }}>
          {erroEnvio}
        </div>
      )}

      <div className="row" style={{ justifyContent: "space-between", marginTop: 24 }}>
        <button className="btn btn-ghost" type="button" onClick={onVoltar} disabled={enviando}>
          Voltar
        </button>
        <button className="btn btn-yellow" type="button" onClick={onEfetivar} disabled={enviando}>
          {enviando ? "Transmitindo…" : "Efetivar proposta"}
        </button>
      </div>
    </div>
  );
}
