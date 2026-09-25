import type { RefObject } from "react";
import { cotNum, expiraChip, money } from "@/components/venda/cotacoes/lista-helpers";
import { docDadosDoBanco, docDadosDosPremios } from "@/components/venda/cotacoes/doc-dados";
import { useImprimirCotacaoModal } from "@/components/venda/cotacoes/ImprimirCotacaoModal";
import {
  ordenarResultados,
  parseQuiverResultado,
} from "@/components/venda/cotacoes/quiver-resultado";
import type { DocDados } from "@/lib/print";
import type { CotacaoFinalizadaRow } from "./queries";

function statusChip(s: string) {
  const label = s === "calculada" ? "Aberta" : s === "proposta" ? "Em ajuste" : s;
  const cls = s === "calculada" ? "chip-info" : s === "proposta" ? "chip-yellow" : "chip-outline";
  return <span className={`chip chip-status ${cls}`}>{label}</span>;
}

/** Monta os dados do modal "Imprimir cotação" (Frente 3 V12 · 7a) a partir da
 * linha da lista. Quando o Quiver devolveu o card completo (coberturas,
 * franquias, parcelas), o documento sai rico; sem isso, cai pro fallback só
 * com os prêmios já carregados nesta lista. */
function docDadosDaLinha(r: CotacaoFinalizadaRow): DocDados {
  const cabecalho = {
    cotacaoNumero: `#${cotNum(r.numero)}`,
    segurado: r.segurado,
    veiculo: r.veiculo,
  };
  const resultados = ordenarResultados(parseQuiverResultado(r.quiver_resultado_raw));
  if (resultados.length > 0) return docDadosDoBanco(cabecalho, resultados);
  return docDadosDosPremios(
    cabecalho,
    (r.premios ?? []).map((p) => ({ seguradora: p.seguradora, premio: Number(p.premio) })),
  );
}

/**
 * Lista "Cotação finalizada" de `/venda/em-negociacao` (V12.3.4): todas as
 * seguradoras já responderam, preço na mão — hora de negociar com o
 * cliente. Extraída do antigo corpo único da tela (T5, Pipeline V12).
 */
export function CotacaoFinalizadaLista({
  rows,
  selectedPropostaId,
  rowRefs,
  onAbrirCalculo,
  onNegociar,
}: {
  rows: CotacaoFinalizadaRow[];
  selectedPropostaId?: string;
  rowRefs: RefObject<Record<string, HTMLTableRowElement | null>>;
  onAbrirCalculo: (id: string) => void;
  onNegociar: (propostaId: string) => void;
}) {
  const imprimir = useImprimirCotacaoModal();

  if (rows.length === 0) {
    return (
      <div className="card-b muted" style={{ padding: 40, textAlign: "center" }}>
        Assim que as seguradoras responderem, a cotação desce para cá sozinha.
      </div>
    );
  }

  return (
    <>
      <table className="table-pipe">
        <thead>
          <tr>
            <th>Nº COTAÇÃO</th>
            <th>SEGURADO</th>
            <th>VEÍCULO</th>
            <th style={{ textAlign: "center" }}>SEGURADORAS</th>
            <th style={{ textAlign: "right" }}>MELHOR PREÇO</th>
            <th>STATUS</th>
            <th>CRIADA</th>
            <th>EXPIRA EM</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const best = r.premios?.length
              ? r.premios.reduce((m, p) => (Number(p.premio) < Number(m.premio) ? p : m))
              : null;
            const veic = r.veiculo
              ? `${r.veiculo.marca_nome ?? ""} ${r.veiculo.modelo_nome ?? ""} ${r.veiculo.ano_modelo ?? ""}`.trim()
              : "—";
            const propostaLigada = r.propostas?.find((p) => p.transmissao_status !== "transmitida");
            const nova = r.status === "calculada" && r.calculo_visto_em === null;
            return (
              <tr
                key={r.id}
                ref={(el) => {
                  rowRefs.current[r.id] = el;
                }}
                onClick={() => onAbrirCalculo(r.id)}
                style={{
                  cursor: "pointer",
                  ...(propostaLigada && selectedPropostaId === propostaLigada.id
                    ? {
                        outline: "2px solid var(--brand, #2563eb)",
                        background: "rgba(37,99,235,.06)",
                      }
                    : {}),
                }}
              >
                <td className="small muted" style={{ fontFamily: "ui-monospace,Menlo,monospace" }}>
                  #{cotNum(r.numero)}
                </td>
                <td>
                  <strong>{r.segurado?.nome || "—"}</strong>
                </td>
                <td>{veic}</td>
                <td style={{ textAlign: "center" }}>
                  <span className="chip chip-outline">{r.premios?.length || 0} cotadas</span>
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {best ? (
                    <>
                      <strong>{money(Number(best.premio))}</strong>
                      <br />
                      <span className="muted small">{best.seguradora}</span>
                    </>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  {nova && (
                    <span
                      className="chip chip-ok"
                      style={{ fontSize: "var(--fs-2xs)", marginRight: 6 }}
                    >
                      nova
                    </span>
                  )}
                  {statusChip(r.status)}
                </td>
                <td className="small muted">
                  {new Date(r.criado_em).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </td>
                <td>{expiraChip(r.criado_em)}</td>
                <td className="fase-acoes-td">
                  <div className="fase-acoes" data-tour="em-negociacao-fase-acoes">
                    {propostaLigada && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNegociar(propostaLigada.id);
                        }}
                      >
                        Negociar
                      </button>
                    )}
                    <button
                      className="btn btn-yellow btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAbrirCalculo(r.id);
                      }}
                    >
                      <svg width={13} height={13}>
                        <use href="#i-compare" />
                      </svg>{" "}
                      Abrir cálculo
                    </button>
                    <button
                      className="ic-btn"
                      title="Imprimir ou enviar a cotação ao cliente"
                      onClick={(e) => {
                        e.stopPropagation();
                        imprimir.abrir(docDadosDaLinha(r));
                      }}
                    >
                      <svg width={15} height={15}>
                        <use href="#i-printer" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {imprimir.modal}
    </>
  );
}
