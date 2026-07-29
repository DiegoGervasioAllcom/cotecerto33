export function NovoLeadHeader({ onClassificarPerda }: { onClassificarPerda: () => void }) {
  return (
    <div className="page-head">
      <div>
        <h1>
          Nova cotação{" "}
          <span className="chip chip-slate" style={{ marginLeft: 6, verticalAlign: "middle" }}>
            Novo
          </span>
        </h1>
        <div className="sub">
          Multi cálculo · Padrão Automóvel · espelha o fluxo de cotação do Quiver com a cara da
          Supper.
        </div>
      </div>
      <div className="tools">
        <button className="btn btn-ghost">
          <svg width="14" height="14">
            <use href="#i-message" />
          </svg>{" "}
          WhatsApp
        </button>
        <button className="btn btn-ghost" data-tour="lead-historico">
          <svg width="14" height="14">
            <use href="#i-history" />
          </svg>{" "}
          Histórico
        </button>
        <button className="btn btn-ghost" data-tour="lead-perda" onClick={onClassificarPerda}>
          <svg width="14" height="14">
            <use href="#i-flag" />
          </svg>{" "}
          Classificar perda
        </button>
      </div>
    </div>
  );
}
