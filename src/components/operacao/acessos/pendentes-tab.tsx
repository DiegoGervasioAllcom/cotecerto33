// Aba "Pendentes de aprovação" — tabela de cadastros aguardando análise.
import { maskCpfCnpj, maskTelefone } from "@/lib/masks";
import { rotuloConvite } from "@/lib/convite-rotulo";
import { Icon } from "./icon";
import type { Pendente } from "./types";

export function PendentesTab({
  pendentes,
  onAnalisar,
}: {
  pendentes: Pendente[];
  onAnalisar?: (p: Pendente) => void;
}) {
  if (pendentes.length === 0) {
    return (
      <div className="card">
        <div className="card-b" style={{ textAlign: "center", padding: "48px 22px" }}>
          <div style={{ color: "var(--ok)", marginBottom: 8 }}>
            <Icon id="check-circle" size={40} />
          </div>
          <h3 style={{ margin: "0 0 4px", color: "var(--slate)" }}>Nenhum cadastro pendente</h3>
          <div className="muted small">
            Todos os cadastros foram analisados. Novos pedidos aparecem aqui automaticamente.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
        <table className="table-pipe">
          <thead>
            <tr>
              <th>Solicitante</th>
              <th>Tipo</th>
              <th>Documento</th>
              <th>Contato</th>
              <th>Enviado em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pendentes.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.nome}</strong>{" "}
                  {/* V11 · F6: origem do pedido — mesma marcação do protótipo
                      (accPendTable): via Convite (nominal, uso único) ou
                      manual · exceção (criação direta, registrada em log). */}
                  <span
                    className={`chip ${p.convite ? "chip-outline" : "chip-yellow"}`}
                    style={{ fontSize: "10px", verticalAlign: "middle" }}
                  >
                    {p.convite ? "via Convite" : "manual · exceção"}
                  </span>
                  <div className="small muted">
                    {p.cidade ? `${p.cidade}${p.uf ? " · " + p.uf : ""}` : "—"}
                  </div>
                </td>
                <td>
                  {p.tipo === "pj" ? (
                    <span className="chip chip-slate">Pessoa Jurídica</span>
                  ) : (
                    <span className="chip chip-outline">Pessoa Física</span>
                  )}
                  {/* O tipo declarado no convite — o modal de análise abre
                      travado nele (F7); aqui é só o chip informativo da fila. */}
                  {p.convite ? (
                    <div style={{ marginTop: 4 }}>
                      <span className="chip chip-yellow" style={{ fontSize: "10.5px" }}>
                        {rotuloConvite(p.convite)}
                      </span>
                    </div>
                  ) : (
                    <div className="small muted" style={{ marginTop: 4 }}>
                      {rotuloConvite(p.convite)}
                    </div>
                  )}
                </td>
                <td>{maskCpfCnpj(p.documento)}</td>
                <td>
                  {p.email ?? "—"}
                  <div className="small muted">{maskTelefone(p.celular ?? p.telefone ?? "")}</div>
                </td>
                <td>{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                {onAnalisar ? (
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-yellow btn-sm" onClick={() => onAnalisar(p)}>
                      <Icon id="shield" size={13} /> Analisar
                    </button>
                  </td>
                ) : (
                  <td style={{ textAlign: "right" }}>
                    <span className="chip chip-yellow">Aguardando matriz</span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
