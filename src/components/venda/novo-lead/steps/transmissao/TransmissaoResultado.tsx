import { Link } from "@tanstack/react-router";
import { SeguradoraBadge } from "@/components/venda/novo-lead/SeguradoraBadge";

export type ResultadoTransmissaoEstado = {
  status: "enviada" | "transmitida" | "falha";
  motivo: string | null;
  mensagem: string | null;
  propostaId: string | null;
};

type Props = {
  seguradora: string;
  resultado: ResultadoTransmissaoEstado | null;
  tentarNovamente: () => void;
};

// Onda 3 (T.10): o resultado real (transmitido / recusado pelo portal) só
// chega depois, pelo webhook do robô — esta tela só reflete o polling de
// `cotacao_transmissoes` (mesmo padrão de `useSimulacaoCalculo`). Movida de
// `StepCalculo.tsx` quase sem mudança visual.
export function TransmissaoResultado({ seguradora, resultado, tentarNovamente }: Props) {
  return (
    <div className="card" style={{ padding: 20, marginBottom: 12, textAlign: "center" }}>
      <div className="calc-ins" style={{ justifyContent: "center", marginBottom: 12 }}>
        <SeguradoraBadge nome={seguradora} tam="sm" /> {seguradora}
      </div>

      {!resultado && (
        <>
          <svg width="28" height="28" className="pulse" style={{ margin: "0 auto 12px" }}>
            <use href="#i-clock" />
          </svg>
          <div>Aguardando confirmação da seguradora…</div>
          <div className="sub" style={{ marginTop: 4 }}>
            O robô já enviou a proposta ao portal — o resultado costuma chegar em instantes.
          </div>
        </>
      )}

      {resultado?.status === "transmitida" && (
        <>
          <svg width="28" height="28" style={{ color: "var(--ok, #16a34a)" }}>
            <use href="#i-check" />
          </svg>
          <div style={{ marginTop: 8, fontWeight: 600 }}>Proposta transmitida com sucesso</div>
          <Link to="/venda/aceite" className="btn btn-yellow" style={{ marginTop: 12 }}>
            Ir para Aceite &amp; Transmissão
          </Link>
        </>
      )}

      {resultado?.status === "falha" && (
        <>
          <div
            style={{
              marginTop: 8,
              padding: "10px 14px",
              borderRadius: 8,
              background: "var(--alert-soft)",
              color: "var(--alert)",
              fontSize: 13,
              textAlign: "left",
            }}
          >
            {resultado.motivo && (
              <span className="chip chip-slate" style={{ marginRight: 8 }}>
                {resultado.motivo}
              </span>
            )}
            {resultado.mensagem || "A seguradora recusou a transmissão desta proposta."}
          </div>
          <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 12 }}>
            {/* RECUSADA_PELO_PORTAL é rejeição de regra de negócio do portal (ex.:
                duplicidade) — reenviar os mesmos dados não muda o resultado, então
                "Tentar novamente" não faz sentido aqui. A proposta já foi registrada
                como negociação recusada (com o motivo no histórico de versão), então
                o link certo é a tela de Propostas, não Aceite & Transmissão. */}
            {resultado.motivo === "RECUSADA_PELO_PORTAL" ? (
              resultado.propostaId && (
                <Link
                  to="/venda/propostas"
                  search={{ selected: resultado.propostaId }}
                  className="btn btn-slate"
                >
                  Ver proposta
                </Link>
              )
            ) : (
              <>
                <button className="btn btn-ghost" onClick={tentarNovamente}>
                  Tentar novamente
                </button>
                {resultado.propostaId && (
                  <Link
                    to="/venda/aceite"
                    search={{ selected: resultado.propostaId }}
                    className="btn btn-slate"
                  >
                    Ver proposta
                  </Link>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
