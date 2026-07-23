// Fold "Comissões" do Passo 5 — % de comissão por seguradora (protótipo
// v10, função commRow). Não faz parte do objeto `cobertura` da API Quiver
// — uso interno, guardado em cotacao_coberturas.comissoes.
//
// O botão "Solicitar desconto adicional à matriz" do protótipo não é
// funcional aqui: o fluxo real (SolicitarDescontoModal, RPC
// solicitar_desconto) exige um prêmio já calculado por seguradora, que só
// existe depois do cálculo (Passo 6). Fica visível para fidelidade visual;
// a ligação com o fluxo real acontece na Fase 5, por card de resultado.
import { useState } from "react";
import { maskBRL } from "@/components/venda/novo-lead/masks";
import type { Form } from "@/components/venda/novo-lead/types";

type Props = {
  f: Form;
  up: <K extends keyof Form>(k: K, v: Form[K]) => void;
  seguradoras: readonly string[];
};

export function ComissoesFold({ f, up, seguradoras }: Props) {
  const [open, setOpen] = useState(false);

  function setComissao(seguradora: string, valor: string) {
    up("comissoes", { ...f.comissoes, [seguradora]: valor });
  }

  return (
    <div className={`fold${open ? " open" : ""}`}>
      <div className="fold-h" onClick={() => setOpen((v) => !v)}>
        Comissões <span className="lbl-soft">% de comissão por seguradora</span>
        <svg className="chev" width="14" height="14">
          <use href="#i-chevron-down" />
        </svg>
      </div>
      <div className="fold-b">
        {seguradoras.map((s) => (
          <div
            key={s}
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 14,
              padding: "8px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                minWidth: 130,
                fontWeight: 700,
                color: "var(--slate)",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="13" height="13">
                <use href="#i-shield" />
              </svg>
              {s}
            </div>
            <div className="field-group" style={{ margin: 0, maxWidth: 160 }}>
              <label>Comissão (%)</label>
              <input
                className="input"
                value={f.comissoes[s] ?? "25,00"}
                onChange={(e) => setComissao(s, maskBRL(e.target.value))}
              />
            </div>
            <button
              type="button"
              className="ic-btn"
              title="Observação da comissão"
              onClick={() => window.alert(`Observação de comissão · ${s}`)}
            >
              <svg width="14" height="14">
                <use href="#i-message" />
              </svg>
            </button>
          </div>
        ))}
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            borderTop: "1px solid var(--border-soft)",
            paddingTop: 12,
          }}
        >
          <span className="muted small">Precisa de uma condição especial? Peça à matriz.</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled>
            Solicitar desconto adicional à matriz
          </button>
        </div>
      </div>
    </div>
  );
}
