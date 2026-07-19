import type {
  PerdaMotivo,
  PerdaSubmotivo,
} from "@/components/venda/novo-lead/hooks/useClassificarPerda";

type PerdaForm = { motivo: string; sub: string; obs: string };

type Props = {
  nomeSegurado: string;
  perdaMotivos: PerdaMotivo[];
  perdaSubs: PerdaSubmotivo[];
  perdaForm: PerdaForm;
  setPerdaForm: (f: PerdaForm) => void;
  perdaSaving: boolean;
  setPerdaOpen: (open: boolean) => void;
  confirmarPerda: () => Promise<void>;
};

export function ClassificarPerdaModal({
  nomeSegurado,
  perdaMotivos,
  perdaSubs,
  perdaForm,
  setPerdaForm,
  perdaSaving,
  setPerdaOpen,
  confirmarPerda,
}: Props) {
  const motivoObj = perdaMotivos.find((m) => m.nome === perdaForm.motivo);
  const subs = motivoObj ? perdaSubs.filter((s) => s.motivo_id === motivoObj.id) : [];
  const ready = !!(perdaForm.motivo && perdaForm.sub);
  return (
    <div
      onClick={() => setPerdaOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-box"
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 22,
          width: "100%",
          maxWidth: 600,
          textAlign: "left",
          boxShadow: "0 24px 48px rgba(15,23,42,.25)",
        }}
      >
        <div className="row" style={{ alignItems: "center", marginBottom: 4, display: "flex" }}>
          <strong
            style={{
              color: "var(--slate)",
              fontSize: 17,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg width="16" height="16">
              <use href="#i-flag" />
            </svg>{" "}
            Classificar perda
          </strong>
          <span style={{ flex: 1 }} />
          <button className="ic-btn" onClick={() => setPerdaOpen(false)} title="Fechar">
            <svg width="16" height="16">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
        <div className="muted small" style={{ marginBottom: 14 }}>
          O lead
          {nomeSegurado ? (
            <>
              {" "}
              de <strong>{nomeSegurado}</strong>
            </>
          ) : null}{" "}
          volta para a matriz com o motivo registrado. A <strong>central de distribuição</strong>{" "}
          faz a triagem final (remalho ou descarte). A classificação fica visível e filtrável.
        </div>

        <label
          style={{
            display: "block",
            fontWeight: 700,
            color: "var(--slate)",
            fontSize: 12,
            marginBottom: 6,
          }}
        >
          Motivo
        </label>
        <div
          className="row"
          style={{ flexWrap: "wrap", gap: 8, marginBottom: 14, display: "flex" }}
        >
          {perdaMotivos.map((m) => (
            <span
              key={m.id}
              className={`chip ${perdaForm.motivo === m.nome ? "chip-yellow" : "chip-outline"}`}
              style={{ cursor: "pointer" }}
              onClick={() => setPerdaForm({ motivo: m.nome, sub: "", obs: perdaForm.obs })}
            >
              {m.nome}
            </span>
          ))}
        </div>

        {perdaForm.motivo && (
          <>
            <label
              style={{
                display: "block",
                fontWeight: 700,
                color: "var(--slate)",
                fontSize: 12,
                marginBottom: 6,
              }}
            >
              Sub-motivo
            </label>
            <div
              className="row"
              style={{ flexWrap: "wrap", gap: 8, marginBottom: 14, display: "flex" }}
            >
              {subs.map((s) => (
                <span
                  key={s.id}
                  className={`chip ${perdaForm.sub === s.nome ? "chip-yellow" : "chip-outline"}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => setPerdaForm({ ...perdaForm, sub: s.nome })}
                >
                  {s.nome}
                </span>
              ))}
            </div>
          </>
        )}

        {perdaForm.sub && (
          <>
            <div className="wizard-grid" style={{ marginBottom: 6 }}>
              <div className="field-group full">
                <label>
                  Observação <span className="hint">opcional</span>
                </label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Detalhe livre para a matriz"
                  value={perdaForm.obs}
                  onChange={(e) => setPerdaForm({ ...perdaForm, obs: e.target.value })}
                />
              </div>
            </div>
            <div className="audit-note" style={{ marginTop: 4 }}>
              <svg width="15" height="15">
                <use href="#i-info" />
              </svg>{" "}
              A triagem <strong style={{ margin: "0 4px" }}>remalho × descarte</strong> é feita pela
              central de distribuição (Matriz).
            </div>
          </>
        )}

        <div
          className="row"
          style={{ marginTop: 16, gap: 10, justifyContent: "flex-end", display: "flex" }}
        >
          <button className="btn btn-ghost" onClick={() => setPerdaOpen(false)}>
            Cancelar
          </button>
          <button
            className={`btn ${ready ? "btn-slate" : ""}`}
            disabled={!ready || perdaSaving}
            style={!ready || perdaSaving ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            onClick={() => void confirmarPerda()}
          >
            <svg width="14" height="14">
              <use href="#i-send" />
            </svg>{" "}
            {perdaSaving ? " Enviando…" : " Devolver à matriz"}
          </button>
        </div>
      </div>
    </div>
  );
}
