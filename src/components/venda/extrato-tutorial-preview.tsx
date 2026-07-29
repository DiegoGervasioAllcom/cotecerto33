import { useTutorialPreview } from "@/components/tutorial/tutorial-preview-context";

export function ExtratoTutorialPreview() {
  const tutorialPreview = useTutorialPreview();

  if (tutorialPreview !== "extrato-campanha" && tutorialPreview !== "extrato-pagamentos") {
    return null;
  }

  return (
    <div
      className="extrato-footer-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 16,
        marginTop: 16,
      }}
      aria-readonly="true"
    >
      <div
        className="card extrato-campanha"
        data-tour="extrato-campanha"
        style={{
          padding: "16px 22px",
          background: "var(--slate)",
          color: "var(--white)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span className="chip chip-outline">Exemplo do tutorial</span>
        <div
          className="row"
          style={{
            gap: 8,
            color: "var(--yellow)",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: ".22em",
          }}
        >
          <svg width="14" height="14">
            <use href="#i-spark" />
          </svg>
          CAMPANHA PORTO · MAIO
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5 }}>
          Você já bateu <strong style={{ color: "var(--yellow)" }}>3 das 5 apólices</strong>{" "}
          exigidas pra ganhar o bônus extra de 2% nas próximas Porto. Faltam{" "}
          <strong>2 apólices</strong> até 31/05.
        </p>
      </div>

      <div
        className="card extrato-pagamentos"
        data-tour="extrato-pagamentos"
        style={{ padding: "16px 22px" }}
      >
        <span className="chip chip-outline">Exemplo do tutorial</span>
        <div
          className="row"
          style={{
            gap: 8,
            color: "var(--slate)",
            fontWeight: 700,
            fontSize: 13,
            marginBottom: 6,
          }}
        >
          <svg width="14" height="14">
            <use href="#i-info" />
          </svg>
          Próximos pagamentos
        </div>
        <p className="small muted" style={{ margin: "0 0 10px" }}>
          Previsão da seguradora para depósito da comissão.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { seguradora: "Seguradora A", data: "04 de junho", valor: "R$ 1.980,00" },
            { seguradora: "Seguradora B", data: "18 de junho", valor: "R$ 1.080,00" },
            { seguradora: "Seguradora C", data: "02 de julho", valor: "R$ 540,00" },
          ].map((pagamento) => (
            <div
              className="row"
              key={pagamento.seguradora}
              style={{
                fontSize: 13,
                padding: "6px 10px",
                background: "var(--offwhite)",
                borderRadius: 8,
              }}
            >
              <span>
                <strong>{pagamento.seguradora}</strong> · {pagamento.data}
              </span>
              <span className="spacer" />
              <strong style={{ color: "var(--slate)", whiteSpace: "nowrap" }}>
                {pagamento.valor}
              </strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ExtratoTutorialSalePreview() {
  const tutorialPreview = useTutorialPreview();
  if (tutorialPreview !== "extrato-venda") return null;

  return (
    <div
      className="card extrato-table-card"
      style={{ padding: 0, overflow: "hidden" }}
      aria-readonly="true"
    >
      <table className="table-pipe extrato-table">
        <thead>
          <tr>
            <th>DATA</th>
            <th>APÓLICE</th>
            <th>SEGURADO</th>
            <th>SEGURADORA</th>
            <th>TIPO</th>
            <th style={{ textAlign: "right" }}>VALOR</th>
            <th style={{ textAlign: "right" }}>% COM.</th>
            <th style={{ textAlign: "right" }}>R$ COMISSÃO</th>
            <th>PARCELAS</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          <tr data-tour="extrato-venda-exemplo">
            <td className="small">20/05/2026</td>
            <td className="small muted">EXEMPLO-001</td>
            <td>
              <strong>Exemplo do tutorial</strong>
            </td>
            <td>Seguradora A</td>
            <td>
              <span className="chip chip-info">NOVO</span>
            </td>
            <td style={{ textAlign: "right", fontWeight: 700 }}>R$ 3.510,00</td>
            <td style={{ textAlign: "right" }}>Exemplo</td>
            <td style={{ textAlign: "right", fontWeight: 700, color: "var(--ok)" }}>R$ 360,00</td>
            <td className="small muted">12x</td>
            <td>
              <span className="chip chip-outline">Exemplo do tutorial</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
