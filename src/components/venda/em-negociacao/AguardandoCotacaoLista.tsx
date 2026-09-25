import { cotNum } from "@/components/venda/cotacoes/lista-helpers";
import { formatElapsed } from "@/lib/nav-badges";
import type { AguardandoCotacaoRow } from "./queries";

/**
 * Lista "Aguardando cotação" de `/venda/em-negociacao` (V12.3.4): cotações
 * já enviadas à Quiver mas ainda sem preço final. O robô real não expõe
 * quantas/quais seguradoras já responderam (diferente do protótipo, que
 * simula um contador "X de Y") — por isso mostramos só há quanto tempo a
 * cotação está esperando, mais o chip de erro quando o robô devolveu falha.
 * Sem retry automático: `erro_quiver` só oferece reabrir a cotação para o
 * vendedor corrigir o que travou e reenviar manualmente.
 */
export function AguardandoCotacaoLista({
  rows,
  onReabrir,
}: {
  rows: AguardandoCotacaoRow[];
  onReabrir: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="card-b muted" style={{ padding: 40, textAlign: "center" }}>
        Nenhuma cotação esperando retorno de seguradora.
      </div>
    );
  }

  return (
    <table className="table-pipe">
      <thead>
        <tr>
          <th>Nº COTAÇÃO</th>
          <th>SEGURADO</th>
          <th>VEÍCULO</th>
          <th>ESPERANDO HÁ</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const veic = r.veiculo
            ? `${r.veiculo.marca_nome ?? ""} ${r.veiculo.modelo_nome ?? ""} ${r.veiculo.ano_modelo ?? ""}`.trim()
            : "—";
          const desde = r.quiver_enviado_em ?? r.criado_em;
          const segundos = (Date.now() - new Date(desde).getTime()) / 1000;
          const comErro = r.status === "erro_quiver";
          return (
            <tr key={r.id}>
              <td className="small muted" style={{ fontFamily: "ui-monospace,Menlo,monospace" }}>
                #{cotNum(r.numero)}
              </td>
              <td>
                <strong>{r.segurado?.nome || "—"}</strong>
              </td>
              <td>{veic}</td>
              <td className="small muted">
                <span className="chip chip-slate" style={{ fontSize: "var(--fs-2xs)" }}>
                  {formatElapsed(segundos)}
                </span>
                {comErro && (
                  <div style={{ marginTop: 4 }}>
                    <span className="chip chip-alert" style={{ marginRight: 6 }}>
                      Erro no cálculo
                    </span>
                    {r.quiver_mensagem && <span className="small muted">{r.quiver_mensagem}</span>}
                  </div>
                )}
              </td>
              <td className="fase-acoes-td">
                {comErro && (
                  <div className="fase-acoes" data-tour="em-negociacao-fase-acoes">
                    <button
                      className="btn btn-yellow btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReabrir(r.id);
                      }}
                    >
                      <svg width={13} height={13}>
                        <use href="#i-edit" />
                      </svg>{" "}
                      Reabrir e corrigir
                    </button>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
